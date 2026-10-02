// Wendet ausstehende SQL-Migrationen aus database/migrations in Reihenfolge der Dateinamen an. Jede Migration läuft
// zusammen mit ihrem Eintrag in medbase_schema_migrations in einer Transaktion: ganz oder gar nicht.
//
// Aufruf: node --env-file=.env.local database/migrate.mjs [--dry-run]
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const MIGRATIONS_DIR = new URL("./migrations/", import.meta.url);
const LOCK_KEY = 4_118_203; // gemeinsamer Schlüssel aller Migrationsläufe
const dryRun = process.argv.includes("--dry-run");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS medbase_schema_migrations (
      version TEXT PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
  const applied = new Map(
    (await client.query("SELECT version, checksum FROM medbase_schema_migrations")).rows.map((row) => [
      row.version,
      row.checksum.trim(),
    ]),
  );
  const files = (await readdir(MIGRATIONS_DIR)).filter((name) => /^\d{4}_[\w-]+\.sql$/.test(name)).sort();
  let pending = 0;
  for (const file of files) {
    const source = await readFile(new URL(file, MIGRATIONS_DIR), "utf8");
    const checksum = createHash("sha256").update(source).digest("hex");
    if (applied.has(file)) {
      if (applied.get(file) !== checksum)
        throw new Error(`Migration ${file} was changed after it was applied. Add a new migration instead.`);
      continue;
    }
    pending += 1;
    if (dryRun) {
      console.log(`pending: ${file}`);
      continue;
    }
    try {
      await client.query("BEGIN");
      await client.query(source);
      await client.query("INSERT INTO medbase_schema_migrations (version, checksum) VALUES ($1, $2)", [file, checksum]);
      await client.query("COMMIT");
      console.log(`applied: ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${file} failed: ${error instanceof Error ? error.message : error}`, { cause: error });
    }
  }
  console.log(
    pending ? `${dryRun ? "Pending" : "Applied"} ${pending} migration(s).` : "Database schema is up to date.",
  );
} finally {
  await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
  await client.end();
}
