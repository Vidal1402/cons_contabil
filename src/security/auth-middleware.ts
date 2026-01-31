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

  app.decorate("authenticate", async (req) => {
    const header = req.headers.authorization || "";
    const [, token] = header.split(" ");
    if (!token) throw app.httpErrors.unauthorized("Não autenticado");

    try {
      const claims = await verifyAccessToken(token);
      req.user = {
        id: claims.sub,
        role: claims.role,
        clientId: claims.clientId,
        cnpj: claims.cnpj
      };
    } catch {
      throw app.httpErrors.unauthorized("Token inválido");
    }
  });

  app.decorate("requireAdmin", async (req) => {
    await app.authenticate(req, {} as FastifyReply);
    if (!req.user) return;
    if (req.user.role !== "ADMIN") throw app.httpErrors.forbidden("Apenas administrador");
  });

  app.decorate("requireClient", async (req) => {
    await app.authenticate(req, {} as FastifyReply);
    if (!req.user) return;
    if (req.user.role !== "CLIENT") throw app.httpErrors.forbidden("Apenas cliente");
    if (!req.user.clientId) throw app.httpErrors.forbidden("Cliente sem vínculo");
  });
});

