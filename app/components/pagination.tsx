import Link from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";

// Seitenleiste mit erster, letzter und benachbarten Seiten; `href` baut die Adresse einer Seite.
export function Pagination({
  page,
  total,
  pageSize,
  href,
  label = "Einträge",
}: {
  page: number;
  total: number;
  pageSize: number;
  href: (page: number) => string;
  label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const shown = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((value) => value >= 1 && value <= pages)
    .sort((a, b) => a - b);
  const format = (value: number) => value.toLocaleString("de-CH");
  return (
    <div className="pagination">
      <span>
        {format(Math.min(from, total))}–{format(to)} von {format(total)} {label}
      </span>
      {pages > 1 && (
        <nav aria-label="Seiten">
          <Link href={href(Math.max(1, page - 1))} aria-label="Vorherige Seite" aria-disabled={page <= 1}>
            <CaretLeft />
          </Link>
          {shown.map((value, index) => (
            <span key={value} style={{ display: "contents" }}>
              {index > 0 && value - shown[index - 1] > 1 && <span className="gap">…</span>}
              {value === page ? (
                <span className="current" aria-current="page">
                  {value}
                </span>
              ) : (
                <Link href={href(value)}>{value}</Link>
              )}
            </span>
          ))}
          <Link href={href(Math.min(pages, page + 1))} aria-label="Nächste Seite" aria-disabled={page >= pages}>
            <CaretRight />
          </Link>
        </nav>
      )}
    </div>
  );
}

// Adresse mit geänderten Parametern; leere Werte fallen weg.
export function withParams(
  base: string,
  current: Record<string, string | undefined>,
  changes: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...changes })) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
