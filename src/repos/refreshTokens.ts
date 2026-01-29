import type { PoolClient } from "pg";
import { query, withTx } from "../db";

export type RefreshTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  replaced_by: string | null;
};

export async function insertRefreshToken(params: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ip?: string;
  userAgent?: string;
}) {
  const res = await query<{ id: string }>(
    `INSERT INTO refresh_token (user_id, token_hash, expires_at, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [params.userId, params.tokenHash, params.expiresAt, params.ip ?? null, params.userAgent ?? null]
  );
  return res.rows[0]!.id;
}

export async function findRefreshTokenByHash(tokenHash: string) {
  const res = await query<RefreshTokenRow>(
    `SELECT id, user_id, token_hash, expires_at, revoked_at, replaced_by
     FROM refresh_token
     WHERE token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );
  return res.rows[0] ?? null;
}

export async function revokeRefreshToken(id: string) {
  await query("UPDATE refresh_token SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL", [id]);
}

async function rotateTx(
  client: PoolClient,
  params: {
    oldId: string;
    userId: string;
    newHash: string;
    expiresAt: Date;
    ip?: string;
    userAgent?: string;
  }
) {
  const updated = await client.query(
    "UPDATE refresh_token SET revoked_at = now(), replaced_by = $2 WHERE id = $1 AND revoked_at IS NULL",
    [params.oldId, null]
  );
  if (updated.rowCount === 0) throw new Error("Refresh já utilizado/revogado");

  const inserted = await client.query<{ id: string }>(
    `INSERT INTO refresh_token (user_id, token_hash, expires_at, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [params.userId, params.newHash, params.expiresAt, params.ip ?? null, params.userAgent ?? null]
  );

  const newId = inserted.rows[0]!.id;

  await client.query("UPDATE refresh_token SET replaced_by = $2 WHERE id = $1", [params.oldId, newId]);
  return newId;
}

export async function rotateRefreshToken(params: {
  oldId: string;
  userId: string;
  newHash: string;
  expiresAt: Date;
  ip?: string;
  userAgent?: string;
}) {
  return withTx((client) => rotateTx(client, params));
}

