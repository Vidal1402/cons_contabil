import fs from "node:fs";
import path from "node:path";
import { pool } from "../db";
import { sha256Hex } from "../utils/crypto";

function migrationsDir() {
  return path.resolve(__dirname, "../../migrations");
}

function listSqlFiles(dir: string) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

async function ensureSchemaMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id bigserial PRIMARY KEY,
      filename text NOT NULL UNIQUE,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function isApplied(filename: string) {
  const res = await pool.query<{ filename: string }>(
    "SELECT filename FROM schema_migrations WHERE filename = $1",
    [filename]
  );
  return (res.rowCount ?? 0) > 0;
}

async function recordApplied(filename: string, checksum: string) {
  await pool.query("INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)", [filename, checksum]);
}

async function applyOne(filename: string, sql: string, checksum: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)", [filename, checksum]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  const dir = migrationsDir();
  if (!fs.existsSync(dir)) throw new Error(`Migrations dir não encontrado: ${dir}`);

  await ensureSchemaMigrationsTable();

  const files = listSqlFiles(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const sql = fs.readFileSync(full, "utf8");
    const checksum = sha256Hex(sql);

    if (await isApplied(file)) continue;
    await applyOne(file, sql, checksum);
    // eslint-disable-next-line no-console
    console.log(`Applied: ${file}`);
  }

  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

