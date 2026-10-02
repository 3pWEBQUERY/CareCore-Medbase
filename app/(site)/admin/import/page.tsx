import { Info } from "@phosphor-icons/react/ssr";
import { ImportPanel, RemoveExamples } from "@/app/components/import-panel";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { DEFAULT_SWISSMEDIC_URL, type ImportStats } from "@/lib/swissmedic-import";
import { formatCount, formatDateTime } from "@/lib/text";

export const metadata = { title: "Swissmedic-Import" };

const duration = (start: string, end: string | null) => {
  const seconds = Math.round(((end ? new Date(end) : new Date()).getTime() - new Date(start).getTime()) / 1000);
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
};

export default async function ImportPage() {
  await requireUser("admin");
  const [runs, examples] = await Promise.all([
    query<{
      id: string;
      source: string;
      fileName: string | null;
      status: string;
      stats: Partial<ImportStats>;
      error: string | null;
      startedAt: string;
      finishedAt: string | null;
      by: string | null;
    }>(
      `SELECT r.id, r.source, r.file_name AS "fileName", r.status, r.stats, r.error, r.started_at AS "startedAt",
         r.finished_at AS "finishedAt", u.display_name AS by
       FROM medbase_import_runs r LEFT JOIN medbase_users u ON u.id = r.started_by
       ORDER BY r.started_at DESC LIMIT 20`,
    ),
    queryOne<{ count: number }>("SELECT COUNT(*)::int AS count FROM medbase_products WHERE source = 'beispiel'"),
  ]);
  const running = runs.some((run) => run.status === "laeuft");
  const latest = runs[0];
  return (
    <main className="workspace">
      <div className="page-heading">
        <div className="heading-copy">
          <p className="eyebrow">Verwaltung</p>
          <h1>Swissmedic-Import</h1>
          <p>
            Übernimmt alle in der Schweiz zugelassenen Humanarzneimittel mit Packungen, GTIN, Wirkstoffen, ATC-Code und
            Abgabekategorie. In Medbase gepflegte Bilder, Preise, Pharmacodes und Notizen bleiben erhalten.
          </p>
        </div>
      </div>

      {running && latest && (
        <div className="notice" style={{ marginBottom: 22 }} role="status">
          <span className="status-dot running" style={{ marginTop: 6 }} />
          <div>
            <strong>Import läuft seit {duration(latest.startedAt, null)}</strong>
            <p>Die Seite aktualisiert sich selbst. Der Katalog bleibt währenddessen nutzbar.</p>
          </div>
        </div>
      )}

      <ImportPanel defaultUrl={process.env.SWISSMEDIC_PACKAGES_URL || DEFAULT_SWISSMEDIC_URL} running={running} />

      <section className="card" style={{ marginBottom: 22 }}>
        <div className="card-head">
          <div>
            <h2>Importläufe</h2>
            <p>Die letzten 20 Läufe</p>
          </div>
        </div>
        {runs.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Gestartet</th>
                  <th>Quelle</th>
                  <th>Status</th>
                  <th className="num">Arzneimittel</th>
                  <th className="num">davon neu</th>
                  <th className="num">Packungen</th>
                  <th className="num hide-sm">Ausser Handel</th>
                  <th className="hide-sm">Dauer</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>
                      {formatDateTime(run.startedAt)}
                      <span className="cell-sub">{run.by ?? "System"}</span>
                    </td>
                    <td>
                      {run.source === "datei" ? "Datei" : run.source === "swissmedic" ? "Swissmedic" : "Automatisch"}
                      <span
                        className="cell-sub"
                        style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {run.fileName}
                      </span>
                    </td>
                    <td>
                      <span className="status-line">
                        <span
                          className={`status-dot ${run.status === "laeuft" ? "running" : run.status === "fehler" ? "error" : ""}`}
                        />
                        {run.status === "laeuft" ? "Läuft" : run.status === "fehler" ? "Fehler" : "Abgeschlossen"}
                      </span>
                      {run.error && (
                        <span className="cell-sub" style={{ color: "var(--critical)" }}>
                          {run.error}
                        </span>
                      )}
                    </td>
                    <td className="num">{run.stats.products != null ? formatCount(run.stats.products) : "–"}</td>
                    <td className="num">
                      {run.stats.productsCreated != null ? formatCount(run.stats.productsCreated) : "–"}
                    </td>
                    <td className="num">{run.stats.packages != null ? formatCount(run.stats.packages) : "–"}</td>
                    <td className="num hide-sm">
                      {run.stats.withdrawnProducts != null ? formatCount(run.stats.withdrawnProducts) : "–"}
                    </td>
                    <td className="hide-sm">{duration(run.startedAt, run.finishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="card-body muted" style={{ margin: 0, fontSize: 13 }}>
            Noch kein Import. Mit «Jetzt laden und importieren» kommen alle zugelassenen Arzneimittel in den Katalog.
          </p>
        )}
      </section>

      {(examples?.count ?? 0) > 0 && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Beispieldaten</h2>
              <p>{formatCount(examples!.count)} von Hand erfasste Beispielarzneimittel mit Symbolbildern</p>
            </div>
          </div>
          <div className="card-body" style={{ display: "grid", gap: 14 }}>
            <div className="notice attention">
              <Info />
              <p style={{ margin: 0 }}>
                Nach dem ersten erfolgreichen Import können die Beispiele entfernt werden. Sie stammen nicht aus der
                Swissmedic-Liste und haben keine Zulassungsnummer.
              </p>
            </div>
            <div>
              <RemoveExamples count={examples!.count} />
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
