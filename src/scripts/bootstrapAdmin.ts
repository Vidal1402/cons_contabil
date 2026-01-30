import "dotenv/config";
import { env } from "../config";
import { connectDb, getColl, ensureIndexes } from "../db";
import { hashPassword } from "../security/password";

async function main() {
  const email = env.BOOTSTRAP_ADMIN_EMAIL;
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Defina BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD no .env para criar o primeiro ADM.");
  }

  await connectDb();
  await ensureIndexes();

  const existing = await getColl("users").findOne({ role: "ADMIN" });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log("Admin já existe. Nada a fazer.");
    return;
  }

  const { randomUUID } = await import("node:crypto");
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
  } as any);

  // eslint-disable-next-line no-console
  console.log("Admin criado com sucesso.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
