import { MongoClient, Db, Collection } from "mongodb";
import { env } from "./config";

let client: MongoClient;
let db: Db;

/** Documentos usam _id como string (UUID). */
export type StringIdDoc = { _id: string; [k: string]: unknown };

export async function connectDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(env.MONGODB_URI, {
    // Evita ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR em ambientes como Render/Node 25
    autoSelectFamily: false
  });
  await client.connect();
  db = client.db();
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error("DB não conectado. Chame connectDb() antes.");
  return db;
}

/** Coleções usam _id como string (UUID). Retorna Collection<any> para evitar conflito ObjectId vs string. */
export function getColl(name: string): Collection<any> {
  return getDb().collection(name);
}

/** Filtro por _id string (evita conflito ObjectId vs string). */
export function byId(id: string): { _id: string } {
  return { _id: id };
}

/** Garante índices nas coleções (rodar no startup). */
export async function ensureIndexes(): Promise<void> {
  const d = getDb();
  await d.collection("users").createIndex({ email: 1 }, { unique: true, sparse: true });
  await d.collection("users").createIndex({ cnpj: 1 }, { unique: true, sparse: true });
  await d.collection("clients").createIndex({ cnpj: 1 }, { unique: true });
  await d.collection("clients").createIndex({ user_id: 1 }, { unique: true });
  await d.collection("clients").createIndex({ archived_at: 1 });
  await d.collection("folders").createIndex({ client_id: 1, parent_id: 1, name: 1 }, { unique: true });
  await d.collection("refresh_tokens").createIndex({ token_hash: 1 }, { unique: true });
  await d.collection("refresh_tokens").createIndex({ user_id: 1 });
  await d.collection("file_objects").createIndex({ gridfs_id: 1 }, { unique: true });
}

