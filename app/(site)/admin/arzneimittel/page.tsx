import Link from "next/link";
import { MagnifyingGlass, Plus } from "@phosphor-icons/react/ssr";
import { ActiveFilters } from "@/app/components/active-filters";
import { CatalogSearch, FilterPanel, ResultControls } from "@/app/components/catalog-controls";
import { Pagination, withParams } from "@/app/components/pagination";
import { ProductTable } from "@/app/components/product-table";
import { filterOptions, parseFilters, searchProducts } from "@/lib/catalog";
import { FORM_GROUPS, SOURCES, labelOf } from "@/lib/reference-data";
import { formatCount } from "@/lib/text";

export const metadata = { title: "Arzneimittel verwalten" };

export default async function AdminProducts({ searchParams }: PageProps<"/admin/arzneimittel">) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  if (!raw.sort && !filters.q) filters.sort = "name";
  const [result, options] = await Promise.all([
    searchProducts(filters, { publicOnly: false, pageSize: 50 }),
    filterOptions(),
  ]);
  const current = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  ) as Record<string, string | undefined>;
  const labels = [
    filters.source && { key: "quelle", label: labelOf(SOURCES, filters.source) },
    filters.withoutPhoto && { key: "foto", label: "Ohne eigenes Foto" },
    filters.status && {
      key: "status",
      label:
        { alle: "Alle Status", ausser_handel: "Ausser Handel", entwurf: "Entwürfe" }[filters.status] ?? filters.status,
    },
    filters.category && { key: "kategorie", label: `Abgabekategorie ${filters.category}` },
    filters.atc && { key: "atc", label: `ATC ${filters.atc}` },
    (filters.form || filters.group) && { key: "form", label: "Darreichungsform" },
    filters.sl && { key: "sl", label: "Spezialitätenliste" },
    filters.narcotic && { key: "btm", label: "Betäubungsmittel" },
    filters.company && { key: "firma", label: "Firma" },
    filters.substance && { key: "wirkstoff", label: "Wirkstoff" },
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <main className="workspace">
      <div className="page-heading">
        <div className="heading-copy">
          <p className="eyebrow">Verwaltung</p>
          <h1>Arzneimittel</h1>
          <p>Suchen, bearbeiten und neu erfassen. Entwürfe sind im Katalog nicht sichtbar.</p>
        </div>
        <div className="page-heading-actions">
          <Link className="primary-button" href="/admin/arzneimittel/neu">
            <Plus /> Neues Arzneimittel
          </Link>
        </div>
      </div>
      <CatalogSearch total={result.total} />
      <div className="catalog-layout">
        <FilterPanel forms={options.forms} groups={FORM_GROUPS} atcGroups={options.atcGroups} showAdminFilters />
        <section className="card" aria-label="Arzneimittel">
          <div className="toolbar" style={{ justifyContent: "space-between" }}>
            <span className="result-count">
              <strong>{formatCount(result.total)}</strong> Arzneimittel
            </span>
            <ResultControls sort={filters.sort} view="liste" hasQuery={!!filters.q} />
          </div>
          <div style={{ padding: "12px 16px 0" }}>
            <ActiveFilters base="/admin/arzneimittel" params={current} labels={labels} />
          </div>
          {result.items.length ? (
            <ProductTable products={result.items} admin />
          ) : (
            <div className="empty-state">
              <MagnifyingGlass />
              <strong>Keine Arzneimittel gefunden</strong>
              <p>Suchbegriff oder Filter anpassen.</p>
            </div>
          )}
          <Pagination
            page={filters.page}
            total={result.total}
            pageSize={result.pageSize}
            href={(page) => withParams("/admin/arzneimittel", current, { seite: page > 1 ? String(page) : undefined })}
            label="Arzneimitteln"
          />
        </section>
      </div>
    </main>
  );
}
