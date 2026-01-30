import { getColl, byId } from "../db";

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

export async function findAdminByEmail(email: string): Promise<AdminUserRow | null> {
  const doc = await getColl("users").findOne({
    role: "ADMIN",
    email: email.toLowerCase()
  }) as { _id: string; email?: string; password_hash: string; is_active: boolean } | null;
  if (!doc) return null;
  return {
    id: String(doc._id),
    role: "ADMIN",
    email: doc.email!,
    password_hash: doc.password_hash,
    is_active: doc.is_active
  };
}

export async function findClientByCnpj(cnpj: string): Promise<ClientUserRow | null> {
  const client = await getColl("clients").findOne({ cnpj }) as { _id: string; cnpj: string; name: string; user_id: string; is_active: boolean } | null;
  if (!client) return null;
  const user = await getColl("users").findOne(byId(client.user_id)) as { _id: string; password_hash: string; is_active: boolean } | null;
  if (!user) return null;
  return {
    user_id: String(user._id),
    password_hash: user.password_hash,
    user_active: user.is_active,
    client_id: String(client._id),
    client_active: client.is_active,
    cnpj: client.cnpj,
    name: client.name
  };
}

export async function touchLastLogin(userId: string): Promise<void> {
  await getColl("users").updateOne({ _id: userId }, { $set: { last_login_at: new Date(), updated_at: new Date() } });
}

export async function getUserRoleAndClient(userId: string): Promise<{
  role: "ADMIN" | "CLIENT";
  is_active: boolean;
  cnpj: string | null;
  client_id: string | null;
} | null> {
  const user = await getColl("users").findOne(byId(userId)) as { role: string; is_active: boolean; cnpj?: string | null } | null;
  if (!user) return null;
  if (user.role === "ADMIN") return { role: "ADMIN", is_active: user.is_active, cnpj: null, client_id: null };
  const client = await getColl("clients").findOne({ user_id: userId }) as { _id: string } | null;
  return {
    role: "CLIENT",
    is_active: user.is_active,
    cnpj: user.cnpj ?? null,
    client_id: client?._id != null ? String(client._id) : null
  };
}

export async function isClientActive(clientId: string): Promise<boolean> {
  const c = await getColl("clients").findOne(byId(clientId), { projection: { is_active: 1 } }) as { is_active: boolean } | null;
  return c?.is_active ?? false;
}
