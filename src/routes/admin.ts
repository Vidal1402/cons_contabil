import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import crypto from "node:crypto";
import { normalizeCnpj, isValidCnpjDigitsOnly } from "../utils/cnpj";
import { hashPassword } from "../security/password";
import { getColl, byId } from "../db";
import * as gridfs from "../storage/gridfs";
import { sanitizeFilename } from "../utils/filename";

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
    const rows = await getColl("clients")
      .find({})
      .sort({ created_at: -1 })
      .toArray() as Array<{ _id: string; cnpj: string; name: string; is_active: boolean; created_at: Date }>;
    return {
      clients: rows.map((r) => ({
        id: r._id,
        cnpj: r.cnpj,
        name: r.name,
        is_active: r.is_active,
        created_at: r.created_at
      }))
    };
  });

  app.get<{ Params: { id: string } }>("/clients/:id", async (req, reply) => {
    const id = z.string().uuid().parse(req.params.id);
    const client = await getColl("clients").findOne(byId(id)) as Record<string, unknown> | null;
    if (!client) return reply.notFound("Cliente não encontrado");
    const user = await getColl("users").findOne(byId(client.user_id as string)) as Record<string, unknown> | null;
    if (!user) return reply.notFound("Cliente não encontrado");
    return {
      client: {
        id: client._id,
        cnpj: client.cnpj,
        name: client.name,
        is_active: client.is_active,
        created_at: client.created_at,
        user_id: client.user_id,
        user_active: user.is_active,
        last_login_at: user.last_login_at ?? null
      }
    };
  });

  app.post("/clients", async (req, reply) => {
    const body = createClientSchema.parse(req.body);
    const cnpj = normalizeCnpj(body.cnpj);
    if (!isValidCnpjDigitsOnly(cnpj)) return reply.badRequest("CNPJ inválido");

    const passwordHash = await hashPassword(body.password);
    const userId = randomUUID();
    const clientId = randomUUID();
    const now = new Date();

    await getColl("users").insertOne({
      _id: userId,
      role: "CLIENT",
      cnpj,
      password_hash: passwordHash,
      is_active: true,
      created_at: now,
      updated_at: now
    });
    await getColl("clients").insertOne({
      _id: clientId,
      cnpj,
      name: body.name,
      user_id: userId,
      is_active: true,
      created_at: now,
      updated_at: now
    });
    await getColl("audit_logs").insertOne({
      _id: randomUUID(),
      actor_user_id: req.user!.id,
      client_id: clientId,
      action: "CREATE",
      entity: "client",
      entity_id: clientId,
      meta: { cnpj },
      ip: req.ip,
      user_agent: req.headers["user-agent"] ?? null,
      created_at: now
    } as any);

    return reply.code(201).send({ id: clientId });
  });

  app.patch<{ Params: { id: string } }>("/clients/:id", async (req, reply) => {
    const id = z.string().uuid().parse(req.params.id);
    const body = updateClientSchema.parse(req.body);

    const client = await getColl("clients").findOne(byId(id)) as { user_id: string } | null;
    if (!client) return reply.notFound("Cliente não encontrado");
    const userId = client.user_id;

    if (typeof body.name === "string") {
      await getColl("clients").updateOne({ _id: id }, { $set: { name: body.name, updated_at: new Date() } });
    }
    if (typeof body.isActive === "boolean") {
      await getColl("clients").updateOne({ _id: id }, { $set: { is_active: body.isActive, updated_at: new Date() } });
      await getColl("users").updateOne({ _id: userId }, { $set: { is_active: body.isActive, updated_at: new Date() } });
    }
    await getColl("audit_logs").insertOne({
      _id: randomUUID(),
      actor_user_id: req.user!.id,
      client_id: id,
      action: "UPDATE",
      entity: "client",
      entity_id: id,
      meta: body,
      ip: req.ip,
      user_agent: req.headers["user-agent"] ?? null,
      created_at: new Date()
    } as any);

    return { ok: true };
  });

  app.post<{ Params: { clientId: string } }>("/clients/:clientId/folders", async (req, reply) => {
    const clientId = z.string().uuid().parse(req.params.clientId);
    const body = createFolderSchema.parse(req.body);
    const parentId = body.parentId ?? null;

    const client = await getColl("clients").findOne(byId(clientId));
    if (!client) return reply.notFound("Cliente não encontrado");

    if (parentId) {
      const parent = await getColl("folders").findOne({ _id: parentId, client_id: clientId } as any);
      if (!parent) return reply.badRequest("Pasta pai inválida");
    }

    const folderId = randomUUID();
    const now = new Date();
    await getColl("folders").insertOne({
      _id: folderId,
      client_id: clientId,
      parent_id: parentId,
      name: body.name,
      created_at: now,
      updated_at: now
    } as any);
    return reply.code(201).send({ id: folderId });
  });

  app.get<{ Params: { clientId: string }; Querystring: { parentId?: string } }>(
    "/clients/:clientId/folders",
    async (req, reply) => {
      const clientId = z.string().uuid().parse(req.params.clientId);
      const parentId = req.query.parentId ? z.string().uuid().parse(req.query.parentId) : null;

      const filter: Record<string, unknown> = { client_id: clientId };
      filter.parent_id = parentId ?? null;

      const rows = await getColl("folders")
        .find(filter)
        .sort({ name: 1 })
        .toArray();
      return reply.send({
        folders: rows.map((r) => ({
          id: r._id,
          client_id: r.client_id,
          parent_id: r.parent_id,
          name: r.name,
          created_at: r.created_at,
          updated_at: r.updated_at
        }))
      });
    }
  );

  app.post<{ Params: { folderId: string } }>("/folders/:folderId/files", async (req, reply) => {
    const folderId = z.string().uuid().parse(req.params.folderId);
    const folder = await getColl("folders").findOne(byId(folderId) as any) as { client_id: string } | null;
    if (!folder) return reply.notFound("Pasta não encontrada");
    const clientId = folder.client_id;

    const part = await req.file();
    if (!part) return reply.badRequest("Arquivo obrigatório (multipart field: file)");

    const original = sanitizeFilename(part.filename);
    const buf = await part.toBuffer();
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

    let gridfsId: string;
    try {
      gridfsId = await gridfs.upload(buf, original, part.mimetype);
    } catch (err) {
      req.log.error({ err }, "storage_upload_failed");
      return reply.internalServerError("Falha no upload");
    }

    const fileId = randomUUID();
    const now = new Date();
    await getColl("file_objects").insertOne({
      _id: fileId,
      client_id: clientId,
      folder_id: folderId,
      gridfs_id: gridfsId,
      original_filename: original,
      content_type: part.mimetype,
      size_bytes: buf.length,
      sha256_hex: sha256,
      created_at: now
    } as any);

    return reply.code(201).send({ id: fileId });
  });

  app.get<{ Params: { folderId: string } }>("/folders/:folderId/files", async (req, reply) => {
    const folderId = z.string().uuid().parse(req.params.folderId);
    const folder = await getColl("folders").findOne(byId(folderId)) as { client_id: string } | null;
    if (!folder) return reply.notFound("Pasta não encontrada");
    const clientId = folder.client_id;

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
    const id = z.string().uuid().parse(req.params.id);
    const file = await getColl("file_objects").findOne({ _id: id, deleted_at: null } as any);
    if (!file) return reply.notFound("Arquivo não encontrado");
    return reply.send({
      url: `/admin/files/${id}/stream`,
      expiresIn: 60
    });
  });

  app.get<{ Params: { id: string } }>("/files/:id/stream", async (req, reply) => {
    const id = z.string().uuid().parse(req.params.id);
    const file = await getColl("file_objects").findOne({ _id: id, deleted_at: null } as any) as { gridfs_id: string; original_filename: string; content_type: string } | null;
    if (!file) return reply.notFound("Arquivo não encontrado");
    const stream = gridfs.getDownloadStream(file.gridfs_id);
    reply.header("Content-Type", file.content_type);
    reply.header("Content-Disposition", `inline; filename="${file.original_filename}"`);
    return reply.send(stream);
  });

  app.delete<{ Params: { id: string } }>("/files/:id", async (req, reply) => {
    const id = z.string().uuid().parse(req.params.id);
    const file = await getColl("file_objects").findOne({ _id: id, deleted_at: null } as any) as { gridfs_id: string } | null;
    if (!file) return reply.notFound("Arquivo não encontrado");
    try {
      await gridfs.remove(file.gridfs_id);
    } catch (err) {
      req.log.error({ err }, "storage_remove_failed");
      return reply.internalServerError("Falha ao excluir arquivo");
    }
    await getColl("file_objects").updateOne(byId(id), { $set: { deleted_at: new Date() } });
    return reply.send({ ok: true });
  });
};
