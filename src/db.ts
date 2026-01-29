import { Pool } from "pg";
import { env } from "./config";
import type { QueryResultRow } from "pg";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Em produção, prefira validação do certificado.
  ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: true } : { rejectUnauthorized: false }
});

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]) {
  return pool.query<T>(text, params);
}

export async function withTx<T>(fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await fn(client);
    await client.query("COMMIT");
    return res;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

