import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../config";
import { normalizeCnpj, isValidCnpjDigitsOnly } from "../utils/cnpj";
import { formatZodError } from "../utils/validation";
import { errorPayload } from "../utils/response";
import { verifyPassword } from "../security/password";
import {
  findAdminByEmail,
  findClientByCnpj,
  touchLastLogin,
  getUserRoleAndClient,
  isClientActive
} from "../repos/users";
import { randomToken, sha256Hex } from "../utils/crypto";
import { insertRefreshToken, findRefreshTokenByHash, revokeRefreshToken, rotateRefreshToken } from "../repos/refreshTokens";
import { signAccessToken } from "../security/jwt";

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

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/login-admin",
    {
      config: { rateLimit: { max: env.LOGIN_RATE_LIMIT_MAX, timeWindow: `${env.LOGIN_RATE_LIMIT_WINDOW} second` } }
    },
    async (req, reply) => {
      const parsed = loginAdminSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send(errorPayload("Erro ao fazer login: " + formatZodError(parsed.error)));
      }
      const body = parsed.data;
      const email = body.email.toLowerCase();
      const user = await findAdminByEmail(email);
      if (!user || !user.is_active) return reply.code(401).send(errorPayload("Erro ao fazer login: e-mail ou senha incorretos."));
      const ok = await verifyPassword(user.password_hash, body.password);
      if (!ok) return reply.code(401).send(errorPayload("Erro ao fazer login: e-mail ou senha incorretos."));

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
      const parsed = loginClientSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send(errorPayload("Erro ao fazer login: " + formatZodError(parsed.error)));
      }
      const body = parsed.data;
      const cnpj = normalizeCnpj(body.cnpj);
      if (!isValidCnpjDigitsOnly(cnpj)) return reply.code(400).send(errorPayload("Erro ao fazer login: CNPJ inválido."));

      const row = await findClientByCnpj(cnpj);
      if (!row || !row.user_active || !row.client_active) return reply.code(401).send(errorPayload("Erro ao fazer login: CNPJ ou senha incorretos."));

      const ok = await verifyPassword(row.password_hash, body.password);
      if (!ok) return reply.code(401).send(errorPayload("Erro ao fazer login: CNPJ ou senha incorretos."));

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
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send(errorPayload("Erro ao atualizar token: " + formatZodError(parsed.error)));
    }
    const body = parsed.data;
    const tokenHash = sha256Hex(body.refreshToken);
    const existing = await findRefreshTokenByHash(tokenHash);
    if (!existing) return reply.code(401).send(errorPayload("Erro ao atualizar token: token de atualização inválido. Faça login novamente."));
    if (existing.revoked_at) return reply.code(401).send(errorPayload("Erro ao atualizar token: sessão encerrada. Faça login novamente."));
    if (new Date(existing.expires_at).getTime() <= Date.now()) return reply.code(401).send(errorPayload("Erro ao atualizar token: token expirado. Faça login novamente."));

    const info = await getUserRoleAndClient(existing.user_id);
    if (!info || !info.is_active) return reply.code(401).send(errorPayload("Erro ao atualizar token: usuário inativo. Faça login novamente."));

    if (info.role === "CLIENT") {
      if (!info.client_id) return reply.code(401).send(errorPayload("Erro ao atualizar token: cliente inválido. Faça login novamente."));
      const ok = await isClientActive(info.client_id);
      if (!ok) return reply.code(401).send(errorPayload("Erro ao atualizar token: cliente inativo. Faça login novamente."));
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
      return reply.code(401).send(errorPayload("Erro ao atualizar token: token inválido ou já usado. Faça login novamente."));
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
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send(errorPayload("Erro ao sair: " + formatZodError(parsed.error)));
    }
    const body = parsed.data;
    const tokenHash = sha256Hex(body.refreshToken);
    const existing = await findRefreshTokenByHash(tokenHash);
    if (existing) await revokeRefreshToken(existing.id);
    return reply.send({ ok: true });
  });
};

