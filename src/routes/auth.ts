import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../config";
import { normalizeCnpj, isValidCnpjDigitsOnly } from "../utils/cnpj";
import { verifyPassword } from "../security/password";
import { findAdminByEmail, findClientByCnpj, touchLastLogin } from "../repos/users";
import { randomToken, sha256Hex } from "../utils/crypto";
import { insertRefreshToken, findRefreshTokenByHash, revokeRefreshToken, rotateRefreshToken } from "../repos/refreshTokens";
import { signAccessToken } from "../security/jwt";
import { query } from "../db";

const loginAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const loginClientSchema = z.object({
  cnpj: z.string().min(1),
  password: z.string().min(1)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20)
});

async function getUserRoleAndClient(userId: string) {
  const res = await query<{ role: "ADMIN" | "CLIENT"; is_active: boolean; cnpj: string | null; client_id: string | null }>(
    `SELECT
        u.role,
        u.is_active,
        u.cnpj,
        c.id AS client_id
     FROM app_user u
     LEFT JOIN client c ON c.user_id = u.id
     WHERE u.id = $1
     LIMIT 1`,
    [userId]
  );
  return res.rows[0] ?? null;
}

async function isClientActive(clientId: string) {
  const res = await query<{ is_active: boolean }>("SELECT is_active FROM client WHERE id = $1 LIMIT 1", [clientId]);
  return res.rows[0]?.is_active ?? false;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/login-admin",
    {
      config: { rateLimit: { max: env.LOGIN_RATE_LIMIT_MAX, timeWindow: `${env.LOGIN_RATE_LIMIT_WINDOW} second` } }
    },
    async (req, reply) => {
      const body = loginAdminSchema.parse(req.body);
      const email = body.email.toLowerCase();
      const user = await findAdminByEmail(email);
      if (!user || !user.is_active) return reply.unauthorized("Credenciais inválidas");
      const ok = await verifyPassword(user.password_hash, body.password);
      if (!ok) return reply.unauthorized("Credenciais inválidas");

      await touchLastLogin(user.id);
      const accessToken = await signAccessToken({ sub: user.id, role: "ADMIN" });

      const refreshToken = randomToken(48);
      const tokenHash = sha256Hex(refreshToken);
      const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_SECONDS * 1000);
      await insertRefreshToken({
        userId: user.id,
        tokenHash,
        expiresAt,
        ip: req.ip,
        userAgent: req.headers["user-agent"]
      });

      return reply.send({
        tokenType: "Bearer",
        accessToken,
        expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
        refreshToken
      });
    }
  );

  app.post(
    "/login-client",
    {
      config: { rateLimit: { max: env.LOGIN_RATE_LIMIT_MAX, timeWindow: `${env.LOGIN_RATE_LIMIT_WINDOW} second` } }
    },
    async (req, reply) => {
      const body = loginClientSchema.parse(req.body);
      const cnpj = normalizeCnpj(body.cnpj);
      if (!isValidCnpjDigitsOnly(cnpj)) return reply.badRequest("CNPJ inválido");

      const row = await findClientByCnpj(cnpj);
      if (!row || !row.user_active || !row.client_active) return reply.unauthorized("Credenciais inválidas");

      const ok = await verifyPassword(row.password_hash, body.password);
      if (!ok) return reply.unauthorized("Credenciais inválidas");

      await touchLastLogin(row.user_id);
      const accessToken = await signAccessToken({ sub: row.user_id, role: "CLIENT", clientId: row.client_id, cnpj });

      const refreshToken = randomToken(48);
      const tokenHash = sha256Hex(refreshToken);
      const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_SECONDS * 1000);
      await insertRefreshToken({
        userId: row.user_id,
        tokenHash,
        expiresAt,
        ip: req.ip,
        userAgent: req.headers["user-agent"]
      });

      return reply.send({
        tokenType: "Bearer",
        accessToken,
        expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
        refreshToken
      });
    }
  );

  app.post("/refresh", async (req, reply) => {
    const body = refreshSchema.parse(req.body);
    const tokenHash = sha256Hex(body.refreshToken);
    const existing = await findRefreshTokenByHash(tokenHash);
    if (!existing) return reply.unauthorized("Refresh inválido");
    if (existing.revoked_at) return reply.unauthorized("Refresh revogado");
    if (new Date(existing.expires_at).getTime() <= Date.now()) return reply.unauthorized("Refresh expirado");

    const info = await getUserRoleAndClient(existing.user_id);
    if (!info || !info.is_active) return reply.unauthorized("Usuário inativo");

    if (info.role === "CLIENT") {
      if (!info.client_id) return reply.unauthorized("Cliente inválido");
      const ok = await isClientActive(info.client_id);
      if (!ok) return reply.unauthorized("Cliente inativo");
    }

    const newRefreshToken = randomToken(48);
    const newHash = sha256Hex(newRefreshToken);
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_SECONDS * 1000);
    try {
      await rotateRefreshToken({
        oldId: existing.id,
        userId: existing.user_id,
        newHash,
        expiresAt,
        ip: req.ip,
        userAgent: req.headers["user-agent"]
      });
    } catch {
      // evita reutilização (token replay) e condições de corrida
      return reply.unauthorized("Refresh inválido");
    }

    const accessToken =
      info.role === "ADMIN"
        ? await signAccessToken({ sub: existing.user_id, role: "ADMIN" })
        : await signAccessToken({ sub: existing.user_id, role: "CLIENT", clientId: info.client_id ?? undefined, cnpj: info.cnpj ?? undefined });

    return reply.send({
      tokenType: "Bearer",
      accessToken,
      expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: newRefreshToken
    });
  });

  app.post("/logout", async (req, reply) => {
    const body = refreshSchema.parse(req.body);
    const tokenHash = sha256Hex(body.refreshToken);
    const existing = await findRefreshTokenByHash(tokenHash);
    if (existing) await revokeRefreshToken(existing.id);
    return reply.send({ ok: true });
  });
};

