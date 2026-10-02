import { readdir } from "node:fs/promises";
import path from "node:path";
import { query } from "@/lib/db";
import { storageConfigured } from "@/lib/storage";

// Zustand für Railway (Statusprüfung) und Überwachung: Datenbank erreichbar, Migrationen angewendet.
export async function GET() {
  const started = Date.now();
  try {
    const applied = await query<{ version: string }>("SELECT version FROM medbase_schema_migrations ORDER BY version");
    let pending: string[] = [];
    try {
      const files = (await readdir(path.join(process.cwd(), "database/migrations"))).filter((name) =>
        name.endsWith(".sql"),
      );
      pending = files.filter((file) => !applied.some((row) => row.version === file));
    } catch {
      pending = [];
    }
    return Response.json(
      {
        status: pending.length ? "degraded" : "ok",
        database: { reachable: true, latencyMs: Date.now() - started },
        migrations: { latest: applied.at(-1)?.version ?? null, pending },
        storage: storageConfigured() ? "bucket" : "database",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "down", database: { reachable: false } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
