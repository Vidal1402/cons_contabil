import Fastify from "fastify";
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

  app.register(helmet, {
    global: true,
    contentSecurityPolicy: false // API only
  });

  app.register(cors, {
    origin: true,
    credentials: false,
    allowedHeaders: ["Content-Type", "Authorization"]
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
    const statusCode = (err as any)?.statusCode ?? 500;
    const safeStatus = Number.isInteger(statusCode) ? statusCode : 500;
    const message = safeStatus >= 500 ? "Erro interno" : (err as any)?.message ?? "Erro";
    reply.status(safeStatus).send({ error: message });
  });

  return app;
}

