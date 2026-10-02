import { query, type Queryable } from "./db.ts";

// Protokoll aller Änderungen der Verwaltung (wer, was, wann).
export async function audit(
  userId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  summary: string,
  db?: Queryable,
) {
  await query(
    "INSERT INTO medbase_audit_log (user_id, action, entity, entity_id, summary) VALUES ($1, $2, $3, $4, $5)",
    [userId, action, entity, entityId, summary.slice(0, 500)],
    db,
  );
}
