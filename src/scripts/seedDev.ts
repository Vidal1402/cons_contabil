import "dotenv/config";
import { randomUUID } from "node:crypto";
import { env } from "../config";
import { connectDb, getColl, ensureIndexes } from "../db";
import { hashPassword } from "../security/password";
import { isValidCnpjDigitsOnly, normalizeCnpj } from "../utils/cnpj";

async function ensureAdmin() {
  const existing = await getColl("users").findOne({ role: "ADMIN" });
  if (existing) return { created: false };

  const email = env.BOOTSTRAP_ADMIN_EMAIL;
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Para seed: defina BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD no .env.");
  }

  const userId = randomUUID();
  const passwordHash = await hashPassword(password);
  const now = new Date();
  await getColl("users").insertOne({
    _id: userId,
    role: "ADMIN",
    email: email.toLowerCase(),
    password_hash: passwordHash,
    is_active: true,
    created_at: now,
    updated_at: now
  });

  return { created: true, email: email.toLowerCase() };
}

async function ensureSeedClient() {
  const rawCnpj = env.SEED_CLIENT_CNPJ;
  const name = env.SEED_CLIENT_NAME;
  const password = env.SEED_CLIENT_PASSWORD;
  if (!rawCnpj || !name || !password) {
    throw new Error("Para seed: defina SEED_CLIENT_CNPJ, SEED_CLIENT_NAME e SEED_CLIENT_PASSWORD no .env.");
  }

  const cnpj = normalizeCnpj(rawCnpj);
  if (!isValidCnpjDigitsOnly(cnpj)) throw new Error("SEED_CLIENT_CNPJ inválido (precisa ter 14 dígitos).");

  const existing = await getColl("clients").findOne({ cnpj }) as { _id: string } | null;
  if (existing) return { created: false, clientId: String(existing._id) };

  const userId = randomUUID();
  const clientId = randomUUID();
  const passwordHash = await hashPassword(password);
  const now = new Date();

  await getColl("users").insertOne({
    _id: userId,
    role: "CLIENT",
    cnpj,
    password_hash: passwordHash,
    is_active: true,
    created_at: now,
    updated_at: now
  } as any);
  await getColl("clients").insertOne({
    _id: clientId,
    cnpj,
    name,
    user_id: userId,
    is_active: true,
    created_at: now,
    updated_at: now
  } as any);

  return { created: true, clientId };
}

async function ensureSampleFolder(clientId: string) {
  const existing = await getColl("folders").findOne({
    client_id: clientId,
    parent_id: null,
    name: "2026"
  }) as { _id: string } | null;
  if (existing) return { created: false, folderId: String(existing._id) };

  const folderId = randomUUID();
  const now = new Date();
  await getColl("folders").insertOne({
    _id: folderId,
    client_id: clientId,
    parent_id: null,
    name: "2026",
    created_at: now,
    updated_at: now
  } as any);
  return { created: true, folderId };
}

async function main() {
  await connectDb();
  await ensureIndexes();

  const admin = await ensureAdmin();
  const client = await ensureSeedClient();
  const folder = await ensureSampleFolder(client.clientId);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        admin,
        client,
        sampleFolder: folder
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
