import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { normalizeCnpj, isValidCnpjDigitsOnly } from "../utils/cnpj";
import { hashPassword } from "../security/password";
import { withTx, query } from "../db";
import { supabase, storageBucket } from "../storage/supabase";
import { sanitizeFilename } from "../utils/filename";
import { randomUUID } from "node:crypto";
import crypto from "node:crypto";

const createClientSchema = z.object({
  cnpj: z.string().min(1),
  name: z.string().min(1).max(200),
  password: z.string().min(12).max(200)
});

const updateClientSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional()
});

const createFolderSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200)
});

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireAdmin);

  app.get("/clients", async () => {
    const res = await query<{ id: string; cnpj: string; name: string; is_active: boolean; created_at: string }>(
      `SELECT id, cnpj, name, is_active, created_at
       FROM client
       ORDER BY created_at DESC`
    );
    return { clients: res.rows };
  });

  app.get<{ Params: { id: string } }>("/clients/:id", async (req, reply) => {
    const id = z.string().uuid().parse(req.params.id);
    const res = await query(
      `SELECT c.id, c.cnpj, c.name, c.is_active, c.created_at, u.id AS user_id, u.is_active AS user_active, u.last_login_at
       FROM client c
       JOIN app_user u ON u.id = c.user_id
       WHERE c.id = $1
       LIMIT 1`,
      [id]
    );
    if (res.rowCount === 0) return reply.notFound("Cliente não encontrado");
    return { client: res.rows[0] };
  });

  app.post("/clients", async (req, reply) => {
    const body = createClientSchema.parse(req.body);
    const cnpj = normalizeCnpj(body.cnpj);
    if (!isValidCnpjDigitsOnly(cnpj)) return reply.badRequest("CNPJ inválido");

    const passwordHash = await hashPassword(body.password);

    const created = await withTx(async (client) => {
      const userRes = await client.query<{ id: string }>(
        `INSERT INTO app_user (role, cnpj, password_hash, is_active)
         VALUES ('CLIENT', $1, $2, true)
         RETURNING id`,
        [cnpj, passwordHash]
      );
      const userId = userRes.rows[0]!.id;

      const clientRes = await client.query<{ id: string }>(
        `INSERT INTO client (cnpj, name, user_id, is_active)
         VALUES ($1, $2, $3, true)
         RETURNING id`,
        [cnpj, body.name, userId]
      );

      await client.query(
        `INSERT INTO audit_log (actor_user_id, client_id, action, entity, entity_id, meta, ip, user_agent)
         VALUES ($1, $2, 'CREATE', 'client', $2, jsonb_build_object('cnpj', $3), $4, $5)`,
        [req.user!.id, clientRes.rows[0]!.id, cnpj, req.ip, req.headers["user-agent"] ?? null]
      );

      return { clientId: clientRes.rows[0]!.id, userId };
    });

    return reply.code(201).send({ id: created.clientId });
  });

  app.patch<{ Params: { id: string } }>("/clients/:id", async (req, reply) => {
    const id = z.string().uuid().parse(req.params.id);
    const body = updateClientSchema.parse(req.body);

    const existing = await query<{ user_id: string }>("SELECT user_id FROM client WHERE id = $1 LIMIT 1", [id]);
    if (existing.rowCount === 0) return reply.notFound("Cliente não encontrado");
    const userId = existing.rows[0]!.user_id;

    await withTx(async (client) => {
      if (typeof body.name === "string") {
        await client.query("UPDATE client SET name = $2 WHERE id = $1", [id, body.name]);
      }
      if (typeof body.isActive === "boolean") {
        await client.query("UPDATE client SET is_active = $2 WHERE id = $1", [id, body.isActive]);
        await client.query("UPDATE app_user SET is_active = $2 WHERE id = $1", [userId, body.isActive]);
      }
      await client.query(
        `INSERT INTO audit_log (actor_user_id, client_id, action, entity, entity_id, meta, ip, user_agent)
         VALUES ($1, $2, 'UPDATE', 'client', $2, $3::jsonb, $4, $5)`,
        [
          req.user!.id,
          id,
          JSON.stringify(body),
          req.ip,
          req.headers["user-agent"] ?? null
        ]
      );
    });

    return { ok: true };
  });

  app.post<{ Params: { clientId: string } }>("/clients/:clientId/folders", async (req, reply) => {
    const clientId = z.string().uuid().parse(req.params.clientId);
    const body = createFolderSchema.parse(req.body);
    const parentId = body.parentId ?? null;

    const exists = await query("SELECT id FROM client WHERE id = $1 LIMIT 1", [clientId]);
    if (exists.rowCount === 0) return reply.notFound("Cliente não encontrado");

    if (parentId) {
      const parent = await query<{ id: string }>(
        "SELECT id FROM folder WHERE id = $1 AND client_id = $2 LIMIT 1",
        [parentId, clientId]
      );
      if (parent.rowCount === 0) return reply.badRequest("Pasta pai inválida");
    }

    const res = await query<{ id: string }>(
      `INSERT INTO folder (client_id, parent_id, name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [clientId, parentId, body.name]
    );
    return reply.code(201).send({ id: res.rows[0]!.id });
  });

  app.get<{ Params: { clientId: string }; Querystring: { parentId?: string } }>(
    "/clients/:clientId/folders",
    async (req, reply) => {
      const clientId = z.string().uuid().parse(req.params.clientId);
      const parentId = req.query.parentId ? z.string().uuid().parse(req.query.parentId) : null;

      const res = await query(
        `SELECT id, client_id, parent_id, name, created_at, updated_at
         FROM folder
         WHERE client_id = $1 AND parent_id IS NOT DISTINCT FROM $2
         ORDER BY name ASC`,
        [clientId, parentId]
      );
      return reply.send({ folders: res.rows });
    }
  );

  app.post<{ Params: { folderId: string } }>("/folders/:folderId/files", async (req, reply) => {
    const folderId = z.string().uuid().parse(req.params.folderId);
    const folderRes = await query<{ client_id: string }>("SELECT client_id FROM folder WHERE id = $1 LIMIT 1", [folderId]);
    if (folderRes.rowCount === 0) return reply.notFound("Pasta não encontrada");
    const clientId = folderRes.rows[0]!.client_id;

    const part = await req.file();
    if (!part) return reply.badRequest("Arquivo obrigatório (multipart field: file)");

    const original = sanitizeFilename(part.filename);
    const buf = await part.toBuffer();
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
    const objectId = randomUUID();
    const storageKey = `clients/${clientId}/folders/${folderId}/${objectId}-${original}`;

    const upload = await supabase.storage.from(storageBucket).upload(storageKey, buf, {
      contentType: part.mimetype,
      upsert: false
    });
    if (upload.error) {
      req.log.error({ err: upload.error }, "storage_upload_failed");
      return reply.internalServerError("Falha no upload");
    }

    const inserted = await query<{ id: string }>(
      `INSERT INTO file_object (client_id, folder_id, storage_key, original_filename, content_type, size_bytes, sha256_hex)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [clientId, folderId, storageKey, original, part.mimetype, buf.length, sha256]
    );

    return reply.code(201).send({ id: inserted.rows[0]!.id });
  });

  app.get<{ Params: { folderId: string } }>("/folders/:folderId/files", async (req, reply) => {
    const folderId = z.string().uuid().parse(req.params.folderId);
    const folderRes = await query<{ client_id: string }>("SELECT client_id FROM folder WHERE id = $1 LIMIT 1", [folderId]);
    if (folderRes.rowCount === 0) return reply.notFound("Pasta não encontrada");
    const clientId = folderRes.rows[0]!.client_id;

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
    const id = z.string().uuid().parse(req.params.id);
    const res = await query<{ storage_key: string }>(
      "SELECT storage_key FROM file_object WHERE id = $1 AND deleted_at IS NULL LIMIT 1",
      [id]
    );
    if (res.rowCount === 0) return reply.notFound("Arquivo não encontrado");
    const storageKey = res.rows[0]!.storage_key;

    const signed = await supabase.storage.from(storageBucket).createSignedUrl(storageKey, 60);
    if (signed.error || !signed.data?.signedUrl) return reply.internalServerError("Falha ao gerar link");
    return reply.send({ url: signed.data.signedUrl, expiresIn: 60 });
  });

  app.delete<{ Params: { id: string } }>("/files/:id", async (req, reply) => {
    const id = z.string().uuid().parse(req.params.id);
    const res = await query<{ storage_key: string }>(
      "SELECT storage_key FROM file_object WHERE id = $1 AND deleted_at IS NULL LIMIT 1",
      [id]
    );
    if (res.rowCount === 0) return reply.notFound("Arquivo não encontrado");
    const storageKey = res.rows[0]!.storage_key;

    const removed = await supabase.storage.from(storageBucket).remove([storageKey]);
    if (removed.error) {
      req.log.error({ err: removed.error }, "storage_remove_failed");
      return reply.internalServerError("Falha ao excluir no storage");
    }

    await query("UPDATE file_object SET deleted_at = now() WHERE id = $1", [id]);
    return reply.send({ ok: true });
  });
};

