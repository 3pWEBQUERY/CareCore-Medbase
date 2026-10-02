import Link from "next/link";
import { Pagination, withParams } from "@/app/components/pagination";
import { query } from "@/lib/db";
import { formatDateTime } from "@/lib/text";

export const metadata = { title: "Protokoll" };

const ENTITIES = [
  { value: "", label: "Alle" },
  { value: "arzneimittel", label: "Arzneimittel" },
  { value: "bild", label: "Bilder" },
  { value: "stammdaten", label: "Stammdaten" },
  { value: "import", label: "Import" },
  { value: "benutzer", label: "Benutzer" },
];
const MASTER = ["darreichungsform", "wirkstoff", "firma", "atc", "form", "substance", "company"];
const PAGE = 50;

export default async function AuditPage({ searchParams }: PageProps<"/admin/protokoll">) {
  const raw = await searchParams;
  const entity =
    typeof raw.bereich === "string" && ENTITIES.some((entry) => entry.value === raw.bereich) ? raw.bereich : "";
  const page = Math.max(1, Number.parseInt(typeof raw.seite === "string" ? raw.seite : "1", 10) || 1);
  const entities =
    entity === "stammdaten" ? MASTER : entity === "import" ? ["import", "beispieldaten"] : entity ? [entity] : null;
  const rows = await query<{
    id: number;
    action: string;
    entity: string;
    entityId: string | null;
    summary: string;
    createdAt: string;
    user: string | null;
    total: number;
  }>(
    `SELECT a.id, a.action, a.entity, a.entity_id AS "entityId", a.summary, a.created_at AS "createdAt",
       u.display_name AS user, COUNT(*) OVER ()::int AS total
     FROM medbase_audit_log a LEFT JOIN medbase_users u ON u.id = a.user_id
     WHERE $1::text[] IS NULL OR a.entity = ANY($1)
     ORDER BY a.created_at DESC, a.id DESC LIMIT $2 OFFSET $3`,
    [entities, PAGE, (page - 1) * PAGE],
  );
  const total = rows[0]?.total ?? 0;
  return (
    <main className="workspace">
      <div className="page-heading">
        <div className="heading-copy">
          <p className="eyebrow">Verwaltung</p>
          <h1>Protokoll</h1>
          <p>Wer hat wann was geändert. Einträge werden nicht gelöscht.</p>
        </div>
      </div>
      <section className="card">
        <div className="toolbar">
          <div className="segmented" role="group" aria-label="Bereich">
            {ENTITIES.map((entry) => (
              <Link
                key={entry.value}
                href={withParams("/admin/protokoll", {}, { bereich: entry.value || undefined })}
                className={entity === entry.value ? "active" : ""}
              >
                {entry.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Zeitpunkt</th>
                <th>Person</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td>{row.user ?? <span className="muted">System</span>}</td>
                  <td>
                    {row.entity === "arzneimittel" && row.entityId && row.action !== "geloescht" ? (
                      <Link href={`/admin/arzneimittel/${row.entityId}`}>{row.summary}</Link>
                    ) : (
                      row.summary
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          total={total}
          pageSize={PAGE}
          href={(value) =>
            withParams(
              "/admin/protokoll",
              { bereich: entity || undefined },
              { seite: value > 1 ? String(value) : undefined },
            )
          }
        />
      </section>
    </main>
  );
}
