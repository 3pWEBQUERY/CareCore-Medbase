import "server-only";
import { query, queryOne } from "./db.ts";

export async function dashboard() {
  const [counts, recent, activity, lastImport] = await Promise.all([
    queryOne<{
      products: number;
      active: number;
      drafts: number;
      withdrawn: number;
      packages: number;
      images: number;
      withoutImage: number;
      examples: number;
      substances: number;
      companies: number;
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM medbase_products) AS products,
         (SELECT COUNT(*)::int FROM medbase_products WHERE status = 'aktiv') AS active,
         (SELECT COUNT(*)::int FROM medbase_products WHERE status = 'entwurf') AS drafts,
         (SELECT COUNT(*)::int FROM medbase_products WHERE status = 'ausser_handel') AS withdrawn,
         (SELECT COUNT(*)::int FROM medbase_packages) AS packages,
         (SELECT COUNT(*)::int FROM medbase_images) AS images,
         (SELECT COUNT(*)::int FROM medbase_products p WHERE p.status = 'aktiv'
            AND NOT EXISTS (SELECT 1 FROM medbase_images i WHERE i.product_id = p.id AND i.origin = 'upload')) AS "withoutImage",
         (SELECT COUNT(*)::int FROM medbase_products WHERE source = 'beispiel') AS examples,
         (SELECT COUNT(*)::int FROM medbase_substances) AS substances,
         (SELECT COUNT(*)::int FROM medbase_companies) AS companies`,
    ),
    query<{ id: string; name: string; line: string | null; updatedAt: string; by: string | null }>(
      `SELECT p.id, p.name, p.description_line AS line, p.updated_at AS "updatedAt", u.display_name AS by
       FROM medbase_products p LEFT JOIN medbase_users u ON u.id = p.updated_by
       WHERE p.updated_by IS NOT NULL ORDER BY p.updated_at DESC LIMIT 6`,
    ),
    query<{
      id: number;
      action: string;
      entity: string;
      entityId: string | null;
      summary: string;
      createdAt: string;
      user: string | null;
    }>(
      `SELECT a.id, a.action, a.entity, a.entity_id AS "entityId", a.summary, a.created_at AS "createdAt", u.display_name AS user
       FROM medbase_audit_log a LEFT JOIN medbase_users u ON u.id = a.user_id
       ORDER BY a.created_at DESC LIMIT 8`,
    ),
    queryOne<{ status: string; finishedAt: string | null; startedAt: string; stats: Record<string, number> }>(
      `SELECT status, finished_at AS "finishedAt", started_at AS "startedAt", stats
       FROM medbase_import_runs ORDER BY started_at DESC LIMIT 1`,
    ),
  ]);
  return { counts: counts!, recent, activity, lastImport };
}
