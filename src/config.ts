import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.string().default("info"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório"),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY é obrigatório"),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("contabil-docs"),

  JWT_PRIVATE_KEY_PEM: z.string().min(1, "JWT_PRIVATE_KEY_PEM é obrigatório"),
  JWT_PUBLIC_KEY_PEM: z.string().min(1, "JWT_PUBLIC_KEY_PEM é obrigatório"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(3600).max(2592000).default(604800),

  PASSWORD_PEPPER: z.string().min(16, "PASSWORD_PEPPER deve ter >= 16 chars"),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1000).default(10),
  LOGIN_RATE_LIMIT_WINDOW: z.coerce.number().int().min(1).max(3600).default(60),
  MAX_UPLOAD_BYTES: z.coerce.number().int().min(1_048_576).max(1_073_741_824).default(52_428_800),

  BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).optional(),

  // Seed (dev) - cria também um cliente de teste
  SEED_CLIENT_CNPJ: z.string().min(1).optional(),
  SEED_CLIENT_NAME: z.string().min(1).max(200).optional(),
  SEED_CLIENT_PASSWORD: z.string().min(12).max(200).optional()
});

export const env = envSchema.parse(process.env);

export type Env = typeof env;

