import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { query } from "../db";
import { supabase, storageBucket } from "../storage/supabase";

export const clientRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireClient);

  app.get("/me", async (req) => {
    return { userId: req.user!.id, clientId: req.user!.clientId, cnpj: req.user!.cnpj };
  });

  app.get<{ Querystring: { parentId?: string } }>("/folders", async (req) => {
    const clientId = req.user!.clientId!;
    const parentId = req.query.parentId ? z.string().uuid().parse(req.query.parentId) : null;

    const res = await query(
      `SELECT id, parent_id, name, created_at, updated_at
       FROM folder
       WHERE client_id = $1 AND parent_id IS NOT DISTINCT FROM $2
       ORDER BY name ASC`,
      [clientId, parentId]
    );
    return { folders: res.rows };
  });

  app.get<{ Querystring: { folderId: string } }>("/files", async (req, reply) => {
    const clientId = req.user!.clientId!;
    const folderId = z.string().uuid().parse(req.query.folderId);

    const folder = await query("SELECT id FROM folder WHERE id = $1 AND client_id = $2 LIMIT 1", [folderId, clientId]);
    if (folder.rowCount === 0) return reply.notFound("Pasta não encontrada");

    const res = await query(
      `SELECT id, original_filename, content_type, size_bytes, sha256_hex, created_at
       FROM file_object
       WHERE client_id = $1 AND folder_id = $2 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [clientId, folderId]
    );
    return reply.send({ files: res.rows });
  });

  app.get<{ Params: { id: string } }>("/files/:id/signed-url", async (req, reply) => {
    const clientId = req.user!.clientId!;
    const id = z.string().uuid().parse(req.params.id);

    const res = await query<{ storage_key: string }>(
      "SELECT storage_key FROM file_object WHERE id = $1 AND client_id = $2 AND deleted_at IS NULL LIMIT 1",
      [id, clientId]
    );
    if (res.rowCount === 0) return reply.notFound("Arquivo não encontrado");

    const signed = await supabase.storage.from(storageBucket).createSignedUrl(res.rows[0]!.storage_key, 60);
    if (signed.error || !signed.data?.signedUrl) return reply.internalServerError("Falha ao gerar link");
    return reply.send({ url: signed.data.signedUrl, expiresIn: 60 });
  });
};

