import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getColl, byId } from "../db";
import { supabase, storageBucket } from "../storage/supabase";

export const clientRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireClient);

  app.get("/me", async (req) => {
    return { userId: req.user!.id, clientId: req.user!.clientId, cnpj: req.user!.cnpj };
  });

  app.get<{ Querystring: { parentId?: string } }>("/folders", async (req) => {
    const clientId = req.user!.clientId!;
    const parentId = req.query.parentId ? z.string().uuid().parse(req.query.parentId) : null;

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
    const folderId = z.string().uuid().parse(req.query.folderId);

    const folder = await getColl("folders").findOne({ _id: folderId, client_id: clientId });
    if (!folder) return reply.notFound("Pasta não encontrada");

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
    const id = z.string().uuid().parse(req.params.id);

    const file = await getColl("file_objects").findOne({ ...byId(id), client_id: clientId, deleted_at: null } as any) as { storage_key: string } | null;
    if (!file) return reply.notFound("Arquivo não encontrado");

    const signed = await supabase.storage.from(storageBucket).createSignedUrl(file.storage_key, 60);
    if (signed.error || !signed.data?.signedUrl) return reply.internalServerError("Falha ao gerar link");
    return reply.send({ url: signed.data.signedUrl, expiresIn: 60 });
  });
};
