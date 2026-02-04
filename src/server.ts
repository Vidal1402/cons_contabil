import Fastify, { type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import sensible from "@fastify/sensible";
import { env } from "./config";
import { authPlugin } from "./security/auth-middleware";
import { authRoutes } from "./routes/auth";
import { adminRoutes } from "./routes/admin";
import { clientRoutes } from "./routes/client";
import { errorPayload, successPayload, statusFromMessage } from "./utils/response";

export function buildServer() {
  const app = Fastify({
    trustProxy: env.NODE_ENV === "production",
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.body.password",
          "req.body.refreshToken",
          "reply.headers['set-cookie']"
        ],
        remove: true
      }
    },
    ajv: { customOptions: { removeAdditional: "all", coerceTypes: true } }
  });

  app.register(sensible);

  // Troca o parser padrão de application/json para aceitar body vazio (DELETE sem body)
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser<string>(
    "application/json",
    { parseAs: "string" },
    async (_req: FastifyRequest, body: string) => {
      if (typeof body !== "string" || body.trim() === "") return {};
      return JSON.parse(body) as object;
    }
  );

  app.register(helmet, {
    global: true,
    contentSecurityPolicy: false // API only
  });

  app.register(cors, {
    origin: true,
    credentials: false,
    methods: "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
    allowedHeaders: ["Content-Type", "Authorization"],
    preflight: true,
    optionsSuccessStatus: 204
  });

  app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: "1 minute"
  });

  app.register(multipart, {
    limits: {
      fileSize: env.MAX_UPLOAD_BYTES,
      files: 1
    }
  });

  // Healthcheck
  app.get("/health", async () => ({ ok: true }));

  // Auth is public; all others require JWT (middleware enforces per-route).
  app.register(authRoutes, { prefix: "/auth" });
  app.register(authPlugin);
  app.register(adminRoutes, { prefix: "/admin" });
  app.register(clientRoutes, { prefix: "/client" });

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, "request_error");
    if (reply.sent) return;
    const msg = (err as any)?.message ?? "";
    // Priorizar status derivado da mensagem para erros conhecidos (evita 500 para "Não autenticado" etc.)
    const fromMessage = statusFromMessage(msg);
    const fromErr = (err as any)?.statusCode ?? (err as any)?.status;
    let statusCode =
      typeof fromErr === "number" && fromErr >= 400 && fromErr < 600
        ? fromErr
        : fromMessage;
    // Se a mensagem é de auth/validação, forçar 4xx (nunca devolver 500 para "Não autenticado")
    if (fromMessage < 500 && statusCode >= 500) statusCode = fromMessage;
    const safeStatus = Math.min(599, Math.max(400, statusCode));
    const message = safeStatus >= 500 ? "Erro interno. Tente novamente." : msg || "Erro";
    reply.status(safeStatus).send(errorPayload(message));
  });

  app.addHook("onSend", (request, reply, payload, done) => {
    if (reply.sent) return done(null, payload);
    try {
      const body = typeof payload === "string" ? JSON.parse(payload) : payload;
      if (body && typeof body === "object" && body.success === false) {
        return done(null, payload);
      }
      if (body && typeof body === "object" && body.success === true) {
        return done(null, payload);
      }
      // Login/refresh: manter formato { tokenType, accessToken, expiresIn, refreshToken } para o frontend
      if (
        body &&
        typeof body === "object" &&
        "accessToken" in body &&
        "tokenType" in body
      ) {
        return done(null, payload);
      }
      // Listas e recursos únicos: manter formato { clients }, { folders }, { files }, { client } para o frontend (evita .filter em undefined)
      const passThroughKeys = ["clients", "folders", "files", "client", "url", "expiresIn", "userId", "clientId", "cnpj"];
      if (
        body &&
        typeof body === "object" &&
        Object.keys(body).some((k) => passThroughKeys.includes(k))
      ) {
        return done(null, payload);
      }
      // Resposta só com { error } → padronizar para { success: false, error }
      if (body && typeof body === "object" && "error" in body && body.success === undefined) {
        return done(null, JSON.stringify(errorPayload(String(body.error))));
      }
      if (body && typeof body === "object") {
        return done(null, JSON.stringify(successPayload(body)));
      }
    } catch {
      /* payload não é JSON */
    }
    done(null, payload);
  });

  return app;
}

