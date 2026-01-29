import { query } from "../db";

export type AdminUserRow = {
  id: string;
  role: "ADMIN";
  email: string;
  password_hash: string;
  is_active: boolean;
};

export type ClientUserRow = {
  user_id: string;
  password_hash: string;
  user_active: boolean;
  client_id: string;
  client_active: boolean;
  cnpj: string;
  name: string;
};

export async function findAdminByEmail(email: string) {
  const res = await query<AdminUserRow>(
    `SELECT id, role, email, password_hash, is_active
     FROM app_user
     WHERE role = 'ADMIN' AND email = $1
     LIMIT 1`,
    [email]
  );
  return res.rows[0] ?? null;
}

export async function findClientByCnpj(cnpj: string) {
  const res = await query<ClientUserRow>(
    `SELECT
        u.id AS user_id,
        u.password_hash,
        u.is_active AS user_active,
        c.id AS client_id,
        c.is_active AS client_active,
        c.cnpj,
        c.name
     FROM client c
     JOIN app_user u ON u.id = c.user_id
     WHERE c.cnpj = $1
     LIMIT 1`,
    [cnpj]
  );
  return res.rows[0] ?? null;
}

export async function touchLastLogin(userId: string) {
  await query("UPDATE app_user SET last_login_at = now() WHERE id = $1", [userId]);
}

