import { Readable } from "node:stream";
import { ObjectId } from "mongodb";
import { GridFSBucket } from "mongodb";
import type { Db } from "mongodb";
import { getDb } from "../db";

const BUCKET_NAME = "files";

function getBucket(): GridFSBucket {
  const db = getDb();
  return new GridFSBucket(db, { bucketName: BUCKET_NAME });
}

/**
 * Faz upload de um buffer para o GridFS. Retorna o ID do arquivo (ObjectId em hex).
 */
export async function upload(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const bucket = getBucket();
  const stream = bucket.openUploadStream(filename, {
    metadata: { contentType }
  });
  return new Promise((resolve, reject) => {
    stream.once("finish", () => resolve(stream.id.toString()));
    stream.once("error", reject);
    stream.end(buffer);
  });
}

/**
 * Retorna um stream de leitura do arquivo no GridFS. Para usar em reply.send(stream).
 */
export function getDownloadStream(gridfsIdHex: string): Readable {
  const bucket = getBucket();
  const id = new ObjectId(gridfsIdHex);
  return bucket.openDownloadStream(id);
}

/**
 * Remove o arquivo do GridFS.
 */
export async function remove(gridfsIdHex: string): Promise<void> {
  const bucket = getBucket();
  const id = new ObjectId(gridfsIdHex);
  await bucket.delete(id);
}
