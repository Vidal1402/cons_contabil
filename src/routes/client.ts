import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getColl, byId } from "../db";
import * as gridfs from "../storage/gridfs";
import { errorPayload } from "../utils/response";

export const clientRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireClient);

  app.get("/me", async (req) => {
    return { userId: req.user!.id, clientId: req.user!.clientId, cnpj: req.user!.cnpj };
  });

  app.get<{ Querystring: { parentId?: string } }>("/folders", async (req, reply) => {
    const clientId = req.user!.clientId!;
    const parentId = req.query.parentId
      ? (() => {
          const p = z.string().uuid().safeParse(req.query.parentId);
          return p.success ? p.data : null;
        })()
      : null;
    if (req.query.parentId && parentId === null) return reply.code(400).send(errorPayload("Erro ao listar pastas: ID da pasta pai inválido."));

    const filter: Record<string, unknown> = { client_id: clientId };
    filter.parent_id = parentId ?? null;

    const rows = await getColl("folders")
      .find(filter)
      .sort({ name: 1 })
      .toArray();
    return {
      folders: (rows as Array<Record<string, unknown>>).map((r) => ({
        id: r._id,
        parent_id: r.parent_id,
        name: r.name,
        created_at: r.created_at,
        updated_at: r.updated_at
      }))
    };
  });

  app.get<{ Querystring: { folderId: string } }>("/files", async (req, reply) => {
    const clientId = req.user!.clientId!;
    const folderIdParse = z.string().uuid().safeParse(req.query.folderId);
    if (!folderIdParse.success) return reply.code(400).send(errorPayload("Erro ao listar arquivos: ID da pasta inválido."));
    const folderId = folderIdParse.data;

    const folder = await getColl("folders").findOne({ _id: folderId, client_id: clientId });
    if (!folder) return reply.code(404).send(errorPayload("Pasta não encontrada."));

    const rows = await getColl("file_objects")
      .find({ client_id: clientId, folder_id: folderId, deleted_at: null })
      .sort({ created_at: -1 })
      .toArray();
    return reply.send({
      files: (rows as Array<Record<string, unknown>>).map((r) => ({
        id: r._id,
        original_filename: r.original_filename,
        content_type: r.content_type,
        size_bytes: r.size_bytes,
        sha256_hex: r.sha256_hex,
        created_at: r.created_at
      }))
    });
  });

  app.get<{ Params: { id: string } }>("/files/:id/signed-url", async (req, reply) => {
    const clientId = req.user!.clientId!;
    const idParse = z.string().uuid().safeParse(req.params.id);
    if (!idParse.success) return reply.code(400).send(errorPayload("Erro ao obter link: ID do arquivo inválido."));
    const id = idParse.data;
    const file = await getColl("file_objects").findOne({ ...byId(id), client_id: clientId, deleted_at: null } as any);
    if (!file) return reply.code(404).send(errorPayload("Arquivo não encontrado."));
    return reply.send({
      url: `/client/files/${id}/stream`,
      expiresIn: 60
    });
  });

  app.get<{ Params: { id: string } }>("/files/:id/stream", async (req, reply) => {
    const clientId = req.user!.clientId!;
    const idParse = z.string().uuid().safeParse(req.params.id);
    if (!idParse.success) return reply.code(400).send(errorPayload("Erro ao baixar: ID do arquivo inválido."));
    const id = idParse.data;
    const file = await getColl("file_objects").findOne({ ...byId(id), client_id: clientId, deleted_at: null } as any) as { gridfs_id: string; original_filename: string; content_type: string } | null;
    if (!file) return reply.code(404).send(errorPayload("Arquivo não encontrado."));
    const stream = gridfs.getDownloadStream(file.gridfs_id);
    reply.header("Content-Type", file.content_type);
    reply.header("Content-Disposition", `inline; filename="${file.original_filename}"`);
    return reply.send(stream);
  });
};
