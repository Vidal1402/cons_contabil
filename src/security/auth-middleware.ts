import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { verifyAccessToken } from "./jwt";

export type AuthUser = {
  id: string;
  role: "ADMIN" | "CLIENT";
  clientId?: string;
  cnpj?: string;
};

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
  }

  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireClient: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authPlugin: FastifyPluginAsync = fp(async (app) => {
  app.decorateRequest("user", null);

  app.decorate("authenticate", async (req, reply) => {
    const header = req.headers.authorization || "";
    const [, token] = header.split(" ");
    if (!token) return reply.unauthorized("Não autenticado");

    try {
      const claims = await verifyAccessToken(token);
      req.user = {
        id: claims.sub,
        role: claims.role,
        clientId: claims.clientId,
        cnpj: claims.cnpj
      };
    } catch {
      return reply.unauthorized("Token inválido");
    }
  });

  app.decorate("requireAdmin", async (req, reply) => {
    await app.authenticate(req, reply);
    if (!req.user) return;
    if (req.user.role !== "ADMIN") return reply.forbidden("Apenas administrador");
  });

  app.decorate("requireClient", async (req, reply) => {
    await app.authenticate(req, reply);
    if (!req.user) return;
    if (req.user.role !== "CLIENT") return reply.forbidden("Apenas cliente");
    if (!req.user.clientId) return reply.forbidden("Cliente sem vínculo");
  });
});

