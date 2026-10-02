import Link from "next/link";
import {
  CaretRight,
  CloudArrowDown,
  Database,
  Images,
  Package,
  PencilSimpleLine,
  Pill,
  Plus,
  Warning,
} from "@phosphor-icons/react/ssr";
import { dashboard } from "@/lib/admin-dashboard";
import { requireUser } from "@/lib/auth";
import { formatCount, formatDateTime } from "@/lib/text";

export const metadata = { title: "Übersicht" };

export default async function AdminHome() {
  const user = await requireUser();
  const { counts, recent, activity, lastImport } = await dashboard();
  return (
    <main className="workspace">
      <div className="page-heading">
        <div className="heading-copy">
          <p className="eyebrow">Verwaltung</p>
          <h1>Guten Tag, {user.displayName.split(" ")[0]}</h1>
          <p>Stand des Arzneimittelkatalogs, letzte Änderungen und offene Punkte.</p>
        </div>
        <div className="page-heading-actions">
          <Link className="secondary-button" href="/admin/bilder">
            <Images /> Bilder
          </Link>
          <Link className="primary-button" href="/admin/arzneimittel/neu">
            <Plus /> Neues Arzneimittel
          </Link>
        </div>
      </div>

      <div className="summary-strip">
        <Link className="summary-item" href="/admin/arzneimittel">
          <span className="summary-icon">
            <Pill />
          </span>
          <span>
            <span className="summary-value">{formatCount(counts.active)}</span>
            <span className="summary-label">Arzneimittel im Handel</span>
          </span>
        </Link>
        <Link className="summary-item" href="/admin/arzneimittel?status=alle">
          <span className="summary-icon success">
            <Package />
          </span>
          <span>
            <span className="summary-value">{formatCount(counts.packages)}</span>
            <span className="summary-label">Packungen</span>
          </span>
        </Link>
        <Link className="summary-item" href="/admin/bilder">
          <span className="summary-icon">
            <Images />
          </span>
          <span>
            <span className="summary-value">{formatCount(counts.images)}</span>
            <span className="summary-label">Bilder im Speicher</span>
          </span>
        </Link>
        <Link className="summary-item" href="/admin/arzneimittel?status=entwurf">
          <span className="summary-icon attention">
            <PencilSimpleLine />
          </span>
          <span>
            <span className="summary-value">{formatCount(counts.drafts)}</span>
            <span className="summary-label">Entwürfe</span>
          </span>
        </Link>
      </div>

      {counts.examples > 0 && (
        <div className="notice attention" style={{ marginBottom: 22 }}>
          <Warning />
          <div>
            <strong>{formatCount(counts.examples)} Beispielarzneimittel im Katalog</strong>
            <p>
              Die Beispieldaten sind von Hand erfasst. Mit dem Swissmedic-Import kommen alle zugelassenen Arzneimittel
              dazu; die Beispiele lassen sich dort entfernen.{" "}
              {user.role === "admin" && <Link href="/admin/import">Zum Import</Link>}
            </p>
          </div>
        </div>
      )}

      <div className="dashboard-grid">
        <div>
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Zuletzt bearbeitet</h2>
                <p>Von Personen der Verwaltung geändert</p>
              </div>
              <Link className="quiet-button" href="/admin/arzneimittel?sort=neu">
                Alle
              </Link>
            </div>
            {recent.length ? (
              <ul className="activity-list">
                {recent.map((item) => (
                  <li key={item.id}>
                    <span className="activity-icon">
                      <PencilSimpleLine />
                    </span>
                    <span>
                      <Link href={`/admin/arzneimittel/${item.id}`}>
                        <strong>
                          {item.name} {item.line}
                        </strong>
                      </Link>
                      <small>
                        {formatDateTime(item.updatedAt)} · {item.by ?? "–"}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="card-body muted" style={{ margin: 0, fontSize: 13 }}>
                Noch keine Änderungen.
              </p>
            )}
          </section>
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Protokoll</h2>
                <p>Letzte Aktionen in der Verwaltung</p>
              </div>
              <Link className="quiet-button" href="/admin/protokoll">
                Alle
              </Link>
            </div>
            <ul className="activity-list">
              {activity.map((entry) => (
                <li key={entry.id}>
                  <span className="activity-icon">
                    <Database />
                  </span>
                  <span>
                    <strong>{entry.summary}</strong>
                    <small>
                      {formatDateTime(entry.createdAt)} · {entry.user ?? "System"}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div>
          <section className="card">
            <div className="card-head">
              <h2>Datenbestand</h2>
            </div>
            <dl className="meta-list">
              <div>
                <dt>Arzneimittel gesamt</dt>
                <dd>{formatCount(counts.products)}</dd>
              </div>
              <div>
                <dt>Ausser Handel</dt>
                <dd>{formatCount(counts.withdrawn)}</dd>
              </div>
              <div>
                <dt>Ohne eigenes Foto</dt>
                <dd>{formatCount(counts.withoutImage)}</dd>
              </div>
              <div>
                <dt>Wirkstoffe</dt>
                <dd>{formatCount(counts.substances)}</dd>
              </div>
              <div>
                <dt>Zulassungsinhaberinnen</dt>
                <dd>{formatCount(counts.companies)}</dd>
              </div>
              <div>
                <dt>Letzter Swissmedic-Import</dt>
                <dd>
                  {lastImport
                    ? lastImport.status === "abgeschlossen"
                      ? formatDateTime(lastImport.finishedAt)
                      : lastImport.status === "laeuft"
                        ? "läuft"
                        : "fehlgeschlagen"
                    : "noch keiner"}
                </dd>
              </div>
            </dl>
          </section>
          <section className="card">
            <div className="card-head">
              <h2>Schnellzugriff</h2>
            </div>
            <div className="quick-links">
              <Link href="/admin/arzneimittel?foto=ohne">
                <Images />
                <span>
                  <strong>Fotos ergänzen</strong>
                  <small>Arzneimittel ohne eigenes Foto bearbeiten</small>
                </span>
                <CaretRight />
              </Link>
              <Link href="/admin/stammdaten">
                <Database />
                <span>
                  <strong>Stammdaten</strong>
                  <small>Darreichungsformen, Wirkstoffe, Firmen, ATC</small>
                </span>
                <CaretRight />
              </Link>
              {user.role === "admin" && (
                <Link href="/admin/import">
                  <CloudArrowDown />
                  <span>
                    <strong>Swissmedic-Import</strong>
                    <small>Zugelassene Packungen übernehmen</small>
                  </span>
                  <CaretRight />
                </Link>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
