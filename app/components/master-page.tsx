import type { ReactNode } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { Pagination, withParams } from "./pagination";

// Rahmen der Stammdaten-Seiten: Kopf, Suche und Seitenleiste.
export function MasterPage({
  title,
  text,
  base,
  q,
  page,
  total,
  pageSize,
  searchable = true,
  children,
}: {
  title: string;
  text: string;
  base: string;
  q?: string;
  page?: number;
  total?: number;
  pageSize?: number;
  searchable?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="workspace">
      <div className="page-heading">
        <div className="heading-copy">
          <p className="eyebrow">Stammdaten</p>
          <h1>{title}</h1>
          <p>{text}</p>
        </div>
      </div>
      <section className="card">
        {searchable && (
          <form className="toolbar" action={base} role="search">
            <div className="search-field">
              <MagnifyingGlass aria-hidden="true" />
              <input className="input" name="q" defaultValue={q} placeholder="Suchen" aria-label="Suchen" />
            </div>
            <button className="secondary-button" type="submit">
              Suchen
            </button>
          </form>
        )}
        {children}
        {total != null && page != null && pageSize != null && (
          <Pagination
            page={page}
            total={total}
            pageSize={pageSize}
            href={(value) => withParams(base, { q: q || undefined }, { seite: value > 1 ? String(value) : undefined })}
          />
        )}
      </section>
    </main>
  );
}

export function pageParams(raw: Record<string, string | string[] | undefined>) {
  const q = typeof raw.q === "string" ? raw.q.trim().slice(0, 80) : "";
  const page = Math.max(1, Number.parseInt(typeof raw.seite === "string" ? raw.seite : "1", 10) || 1);
  return { q, page };
}
