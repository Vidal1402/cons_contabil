/**
 * Script one-off: remove todos os admins (incluindo o de teste) e cria o admin de produção.
 * Rodar em produção com: MONGODB_URI=... PRODUCTION_ADMIN_EMAIL=... PRODUCTION_ADMIN_PASSWORD=... npm run production-admin
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { connectDb, getColl, ensureIndexes } from "../db";
import { hashPassword } from "../security/password";

const NEW_ADMIN_EMAIL = process.env.PRODUCTION_ADMIN_EMAIL ?? "consultacontabil@gmail.com";
const NEW_ADMIN_PASSWORD = process.env.PRODUCTION_ADMIN_PASSWORD ?? "C0nsuLt@coNt@biL";

async function main() {
  if (!NEW_ADMIN_EMAIL || !NEW_ADMIN_PASSWORD) {
    throw new Error("Defina PRODUCTION_ADMIN_EMAIL e PRODUCTION_ADMIN_PASSWORD no .env (ou use os valores padrão no script).");
  }
  if (NEW_ADMIN_PASSWORD.length < 12) {
    throw new Error("A senha do admin deve ter no mínimo 12 caracteres.");
  }

  await connectDb();
  await ensureIndexes();

  const coll = getColl("users");

  const removed = await coll.deleteMany({ role: "ADMIN" });
  // eslint-disable-next-line no-console
  console.log(`Removido(s) ${removed.deletedCount} admin(s) (incluindo usuário de teste).`);

  const userId = randomUUID();
  const passwordHash = await hashPassword(NEW_ADMIN_PASSWORD);
  const now = new Date();

  await coll.insertOne({
    _id: userId,
    role: "ADMIN",
    email: NEW_ADMIN_EMAIL.toLowerCase(),
    password_hash: passwordHash,
    is_active: true,
    created_at: now,
    updated_at: now
  } as any);

  // eslint-disable-next-line no-console
  console.log(`Admin de produção criado: ${NEW_ADMIN_EMAIL}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
