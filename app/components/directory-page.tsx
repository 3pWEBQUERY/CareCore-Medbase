import Link from "next/link";
import { CaretRight, MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { directory } from "@/lib/catalog";
import { formatCount } from "@/lib/text";
import { Pagination, withParams } from "./pagination";

const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"];

// Alphabetisches Verzeichnis (Wirkstoffe, Firmen) mit Suche; ein Eintrag öffnet den gefilterten Katalog.
export async function DirectoryPage({
  kind,
  base,
  params,
  eyebrow,
  title,
  text,
  filterKey,
}: {
  kind: "substances" | "companies";
  base: string;
  params: Record<string, string | string[] | undefined>;
  eyebrow: string;
  title: string;
  text: string;
  filterKey: "wirkstoff" | "firma";
}) {
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const letter = typeof params.buchstabe === "string" ? params.buchstabe : "";
  const page = Math.max(1, Number.parseInt(typeof params.seite === "string" ? params.seite : "1", 10) || 1);
  const { rows, total, pageSize } = await directory(kind, { q, letter, page });
  const current = { q: q || undefined, buchstabe: letter || undefined };
  return (
    <main className="workspace">
      <div className="page-heading">
        <div className="heading-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{text}</p>
        </div>
      </div>
      <section className="card">
        <form className="toolbar" action={base} role="search">
          <div className="search-field">
            <MagnifyingGlass aria-hidden="true" />
            <input
              className="input"
              name="q"
              defaultValue={q}
              placeholder="Im Verzeichnis suchen"
              aria-label="Im Verzeichnis suchen"
            />
          </div>
          {letter && <input type="hidden" name="buchstabe" value={letter} />}
          <button className="secondary-button" type="submit">
            Suchen
          </button>
        </form>
        <nav className="letter-bar" aria-label="Anfangsbuchstabe">
          <Link
            href={withParams(base, current, { buchstabe: undefined, seite: undefined })}
            className={!letter ? "active" : ""}
          >
            Alle
          </Link>
          {LETTERS.map((value) => (
            <Link
              key={value}
              href={withParams(base, current, { buchstabe: value, seite: undefined })}
              className={letter === value ? "active" : ""}
              aria-current={letter === value ? "true" : undefined}
            >
              {value}
            </Link>
          ))}
        </nav>
        {rows.length ? (
          <ul className="directory-list">
            {rows.map((row) => (
              <li key={row.id}>
                <Link href={`/?${filterKey}=${row.id}`}>
                  <span>
                    <strong>{row.name}</strong>
                    {row.secondary && <small>{row.secondary}</small>}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="count-pill" title="Arzneimittel im Handel">
                      {formatCount(row.count)}
                    </span>
                    <CaretRight width={14} height={14} color="var(--muted)" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <MagnifyingGlass />
            <strong>Keine Einträge</strong>
            <p>Für diese Auswahl gibt es keine Einträge mit Arzneimitteln im Handel.</p>
          </div>
        )}
        <Pagination
          page={page}
          total={total}
          pageSize={pageSize}
          href={(value) => withParams(base, current, { seite: value > 1 ? String(value) : undefined })}
        />
      </section>
    </main>
  );
}
