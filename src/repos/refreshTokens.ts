import { randomUUID } from "node:crypto";
import { getColl, getDb, byId } from "../db";

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
}): Promise<string> {
  const id = randomUUID();
  await getColl("refresh_tokens").insertOne({
    _id: id,
    user_id: params.userId,
    token_hash: params.tokenHash,
    expires_at: params.expiresAt,
    ip: params.ip ?? null,
    user_agent: params.userAgent ?? null
  } as any);
  return id;
}

export async function findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
  const doc = await getColl("refresh_tokens").findOne({ token_hash: tokenHash } as any) as {
    _id: string;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    revoked_at?: Date | null;
    replaced_by?: string | null;
  } | null;
  if (!doc) return null;
  return {
    id: doc._id,
    user_id: doc.user_id,
    token_hash: doc.token_hash,
    expires_at: doc.expires_at.toISOString(),
    revoked_at: doc.revoked_at ? doc.revoked_at.toISOString() : null,
    replaced_by: doc.replaced_by ?? null
  };
}

export async function revokeRefreshToken(id: string): Promise<void> {
  await getColl("refresh_tokens").updateOne({ ...byId(id), revoked_at: null } as any, { $set: { revoked_at: new Date() } });
}

export async function rotateRefreshToken(params: {
  oldId: string;
  userId: string;
  newHash: string;
  expiresAt: Date;
  ip?: string;
  userAgent?: string;
}): Promise<string> {
  const session = getDb().client.startSession();
  try {
    const newId = randomUUID();
    await session.withTransaction(async () => {
      const r = await getColl("refresh_tokens").updateOne(
        { ...byId(params.oldId), revoked_at: null } as any,
        { $set: { revoked_at: new Date(), replaced_by: newId } },
        { session }
      );
      if (r.matchedCount === 0) throw new Error("Refresh já utilizado/revogado");
      await getColl("refresh_tokens").insertOne(
        {
          _id: newId,
          user_id: params.userId,
          token_hash: params.newHash,
          expires_at: params.expiresAt,
          ip: params.ip ?? null,
          user_agent: params.userAgent ?? null
        } as any,
        { session }
      );
    });
    return newId;
  } finally {
    await session.endSession();
  }
}
