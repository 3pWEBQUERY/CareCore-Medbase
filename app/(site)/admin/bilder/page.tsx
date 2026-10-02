import Link from "next/link";
import { Images, MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { MediaGrid } from "@/app/components/media-library";
import { Pagination, withParams } from "@/app/components/pagination";
import { LibraryUpload } from "@/app/components/refresh-upload";
import { mediaLibrary } from "@/lib/admin-images";
import { storageConfigured } from "@/lib/storage";
import { formatBytes, formatCount } from "@/lib/text";

export const metadata = { title: "Bilder" };

const FILTERS = [
  { value: "", label: "Alle" },
  { value: "hochgeladen", label: "Hochgeladen" },
  { value: "symbolbilder", label: "Symbolbilder" },
  { value: "ohne-arzneimittel", label: "Ohne Arzneimittel" },
  { value: "ohne-alternativtext", label: "Ohne Alternativtext" },
];

export default async function MediaPage({ searchParams }: PageProps<"/admin/bilder">) {
  const raw = await searchParams;
  const q = typeof raw.q === "string" ? raw.q.trim().slice(0, 80) : "";
  const filter =
    typeof raw.filter === "string" && FILTERS.some((entry) => entry.value === raw.filter) ? raw.filter : "";
  const page = Math.max(1, Number.parseInt(typeof raw.seite === "string" ? raw.seite : "1", 10) || 1);
  const { rows, total, pageSize, stats } = await mediaLibrary({ q, filter, page });
  const current = { q: q || undefined, filter: filter || undefined };
  return (
    <main className="workspace">
      <div className="page-heading">
        <div className="heading-copy">
          <p className="eyebrow">Verwaltung</p>
          <h1>Bilder</h1>
          <p>
            {formatCount(stats.total)} Bilder · {formatBytes(Number(stats.bytes))} ·{" "}
            {storageConfigured()
              ? "gespeichert im Railway Bucket"
              : "gespeichert in der Datenbank (kein Bucket eingerichtet)"}
          </p>
        </div>
      </div>
      <div className="split-cards">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Hochladen</h2>
              <p>Bilder ohne Arzneimittel erscheinen erst nach der Zuordnung im Katalog.</p>
            </div>
          </div>
          <div className="card-body">
            <LibraryUpload />
          </div>
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Bestand</h2>
          </div>
          <div className="card-body">
            <dl className="stat-list">
              <div>
                <dt>Hochgeladen</dt>
                <dd>{formatCount(stats.uploads)}</dd>
              </div>
              <div>
                <dt>Symbolbilder</dt>
                <dd>{formatCount(stats.generated)}</dd>
              </div>
              <div>
                <dt>Ohne Arzneimittel</dt>
                <dd>{formatCount(stats.unassigned)}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
      <section className="card">
        <form className="toolbar" action="/admin/bilder" role="search">
          <div className="search-field">
            <MagnifyingGlass aria-hidden="true" />
            <input
              className="input"
              name="q"
              defaultValue={q}
              placeholder="Nach Arzneimittel, Dateiname oder Alternativtext suchen"
              aria-label="Bilder suchen"
            />
          </div>
          {filter && <input type="hidden" name="filter" value={filter} />}
          <div className="segmented" role="group" aria-label="Filter">
            {FILTERS.map((entry) => (
              <Link
                key={entry.value}
                href={withParams("/admin/bilder", current, { filter: entry.value || undefined, seite: undefined })}
                className={filter === entry.value ? "active" : ""}
              >
                {entry.label}
              </Link>
            ))}
          </div>
        </form>
        <div className="card-body">
          {rows.length ? (
            <MediaGrid items={rows} />
          ) : (
            <div className="empty-state">
              <Images />
              <strong>Keine Bilder</strong>
              <p>Für diese Auswahl gibt es keine Bilder.</p>
            </div>
          )}
        </div>
        <Pagination
          page={page}
          total={total}
          pageSize={pageSize}
          href={(value) => withParams("/admin/bilder", current, { seite: value > 1 ? String(value) : undefined })}
          label="Bildern"
        />
      </section>
    </main>
  );
}
