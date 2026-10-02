import pg from "pg";

// Verbindungspool zur Postgres-Datenbank (Railway Postgres über das private Netz). Ein Pool je Prozess; in der
// Entwicklung überlebt er das Neuladen der Module.

// NUMERIC und BIGINT als Zahl lesen (Preise, Mengen und Zähler liegen weit unter der Grenze von Number).
pg.types.setTypeParser(1700, (value) => Number(value));
pg.types.setTypeParser(20, (value) => Number(value));
// DATE als Text (JJJJ-MM-TT) statt als Datum in der Zeitzone des Servers.
pg.types.setTypeParser(1082, (value) => value);

const globalPool = globalThis as unknown as { __medbasePool?: pg.Pool };

export function pool() {
  if (!globalPool.__medbasePool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL_NOT_CONFIGURED");
    const created = new pg.Pool({ connectionString, max: Number(process.env.DATABASE_POOL_SIZE ?? 10) });
    created.on("error", (error) => console.error("Postgres pool error", error.message));
    globalPool.__medbasePool = created;
  }
  return globalPool.__medbasePool;
}

export type Queryable = Pick<pg.Pool | pg.PoolClient, "query">;

export async function query<T extends pg.QueryResultRow = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
  db: Queryable = pool(),
) {
  const result = await db.query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends pg.QueryResultRow = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
  db: Queryable = pool(),
) {
  const rows = await query<T>(text, params, db);
  return rows[0] ?? null;
}

// Mehrere Schritte in einer Transaktion; bei einem Fehler wird alles zurückgenommen.
export async function transaction<T>(work: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await globalPool.__medbasePool?.end();
  globalPool.__medbasePool = undefined;
}
