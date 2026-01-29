import { env } from "../config";
import { query, withTx } from "../db";
import { hashPassword } from "../security/password";
import { isValidCnpjDigitsOnly, normalizeCnpj } from "../utils/cnpj";

async function ensureAdmin() {
  const exists = await query<{ id: string }>("SELECT id FROM app_user WHERE role = 'ADMIN' LIMIT 1");
  if ((exists.rowCount ?? 0) > 0) return { created: false };

  const email = env.BOOTSTRAP_ADMIN_EMAIL;
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Para seed: defina BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD no .env.");
  }

  const passwordHash = await hashPassword(password);
  await query(
    `INSERT INTO app_user (role, email, cnpj, password_hash, is_active)
     VALUES ('ADMIN', $1, NULL, $2, true)`,
    [email.toLowerCase(), passwordHash]
  );

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

  const existing = await query<{ id: string; user_id: string }>("SELECT id, user_id FROM client WHERE cnpj = $1 LIMIT 1", [cnpj]);
  if ((existing.rowCount ?? 0) > 0) return { created: false, clientId: existing.rows[0]!.id };

  const passwordHash = await hashPassword(password);

  const created = await withTx(async (client) => {
    const userRes = await client.query<{ id: string }>(
      `INSERT INTO app_user (role, cnpj, password_hash, is_active)
       VALUES ('CLIENT', $1, $2, true)
       RETURNING id`,
      [cnpj, passwordHash]
    );
    const userId = userRes.rows[0]!.id;

    const clientRes = await client.query<{ id: string }>(
      `INSERT INTO client (cnpj, name, user_id, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id`,
      [cnpj, name, userId]
    );

    return { clientId: clientRes.rows[0]!.id };
  });

  return { created: true, clientId: created.clientId };
}

async function ensureSampleFolder(clientId: string) {
  const exists = await query<{ id: string }>(
    "SELECT id FROM folder WHERE client_id = $1 AND parent_id IS NULL AND name = $2 LIMIT 1",
    [clientId, "2026"]
  );
  if ((exists.rowCount ?? 0) > 0) return { created: false, folderId: exists.rows[0]!.id };

  const res = await query<{ id: string }>(
    `INSERT INTO folder (client_id, parent_id, name)
     VALUES ($1, NULL, $2)
     RETURNING id`,
    [clientId, "2026"]
  );
  return { created: true, folderId: res.rows[0]!.id };
}

async function main() {
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

