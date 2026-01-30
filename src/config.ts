import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Render/Heroku etc. injetam PORT; nesse caso é preciso escutar em 0.0.0.0
  HOST: z.string().default(process.env.PORT ? "0.0.0.0" : "127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.string().default("info"),

  MONGODB_URI: z.string().min(1, "MONGODB_URI é obrigatório (ex: mongodb+srv://user:pass@cluster.mongodb.net/dbname)"),

  JWT_PRIVATE_KEY_PEM: z.string().min(1, "JWT_PRIVATE_KEY_PEM é obrigatório"),
  JWT_PUBLIC_KEY_PEM: z.string().min(1, "JWT_PUBLIC_KEY_PEM é obrigatório"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(3600).max(2592000).default(604800),

  PASSWORD_PEPPER: z.string().min(16, "PASSWORD_PEPPER deve ter >= 16 chars"),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1000).default(10),
  LOGIN_RATE_LIMIT_WINDOW: z.coerce.number().int().min(1).max(3600).default(60),
  MAX_UPLOAD_BYTES: z.coerce.number().int().min(1_048_576).max(1_073_741_824).default(52_428_800),

  // Opcionais: string vazia no .env vira undefined (pode deixar em branco)
  BOOTSTRAP_ADMIN_EMAIL: z.preprocess((v) => (v === "" ? undefined : v), z.string().email().optional()),
  BOOTSTRAP_ADMIN_PASSWORD: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(12).max(200).optional()),

  SEED_CLIENT_CNPJ: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).max(14).optional()),
  SEED_CLIENT_NAME: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).max(200).optional()),
  SEED_CLIENT_PASSWORD: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(12).max(200).optional())
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (result.success) return result.data;

  const missing = result.error.issues.map((i) => i.path.join(".")).filter(Boolean);
  // eslint-disable-next-line no-console
  console.error(
    "\n\u274c Variáveis de ambiente faltando ou inválidas.\n\n" +
      "1) Copie o arquivo .env.example para .env:\n   copy .env.example .env\n\n" +
      "2) Abra .env e preencha pelo menos:\n   " +
      missing.join(", ") +
      "\n\n" +
      "Consulte o README para onde obter cada valor (MongoDB, JWT, etc.).\n"
  );
  throw result.error;
}

export const env = loadEnv();

export type Env = typeof env;

