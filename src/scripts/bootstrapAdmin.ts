import { env } from "../config";
import { query } from "../db";
import { hashPassword } from "../security/password";

async function main() {
  const email = env.BOOTSTRAP_ADMIN_EMAIL;
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Defina BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD no .env para criar o primeiro ADM.");
  }

  const exists = await query<{ id: string }>("SELECT id FROM app_user WHERE role = 'ADMIN' LIMIT 1");
  if ((exists.rowCount ?? 0) > 0) {
    // eslint-disable-next-line no-console
    console.log("Admin já existe. Nada a fazer.");
    return;
  }

  const passwordHash = await hashPassword(password);
  await query(
    `INSERT INTO app_user (role, email, cnpj, password_hash, is_active)
     VALUES ('ADMIN', $1, NULL, $2, true)`,
    [email.toLowerCase(), passwordHash]
  );

  // eslint-disable-next-line no-console
  console.log("Admin criado com sucesso.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

