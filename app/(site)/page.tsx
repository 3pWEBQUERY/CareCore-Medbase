import { Info, MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { ActiveFilters } from "@/app/components/active-filters";
import { CatalogSearch, FilterPanel, ResultControls } from "@/app/components/catalog-controls";
import { Pagination, withParams } from "@/app/components/pagination";
import { ProductCard } from "@/app/components/product-card";
import { ProductTable } from "@/app/components/product-table";
import { catalogStats, filterOptions, lookupName, parseFilters, searchProducts } from "@/lib/catalog";
import { FORM_GROUPS, formGroupLabel } from "@/lib/reference-data";
import { formatCount, formatDate } from "@/lib/text";

export default async function CatalogPage({ searchParams }: PageProps<"/">) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  const view = raw.ansicht === "liste" ? "liste" : "raster";
  const [result, options, stats, companyName, substanceName, atcName] = await Promise.all([
    searchProducts(filters),
    filterOptions(),
    catalogStats(),
    filters.company ? lookupName("company", filters.company) : null,
    filters.substance ? lookupName("substance", filters.substance) : null,
    filters.atc ? lookupName("atc", filters.atc) : null,
  ]);

  const current = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  ) as Record<string, string | undefined>;
  const formName = options.forms.find((form) => String(form.id) === filters.form)?.name;
  const labels = [
    filters.form && { key: "form", label: `Form: ${formName ?? filters.form}` },
    filters.group && !filters.form && { key: "gruppe", label: formGroupLabel(filters.group) },
    filters.atc && { key: "atc", label: `ATC ${filters.atc}${atcName ? ` – ${atcName}` : ""}` },
    filters.category && { key: "kategorie", label: `Abgabekategorie ${filters.category}` },
    filters.company && { key: "firma", label: `Firma: ${companyName ?? "unbekannt"}` },
    filters.substance && { key: "wirkstoff", label: `Wirkstoff: ${substanceName ?? "unbekannt"}` },
    filters.sl && { key: "sl", label: "Spezialitätenliste" },
    filters.narcotic && { key: "btm", label: "Betäubungsmittel" },
    filters.withImage && { key: "bild", label: "Mit Abbildung" },
    filters.status && { key: "status", label: filters.status === "alle" ? "Alle Status" : "Ausser Handel" },
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <main className="workspace">
      <div className="page-heading">
        <div className="heading-copy">
          <p className="eyebrow">Arzneimittelkatalog Schweiz</p>
          <h1>Arzneimittel suchen</h1>
          <p>
            {formatCount(stats?.products ?? 0)} Arzneimittel mit {formatCount(stats?.packages ?? 0)} Packungen und{" "}
            {formatCount(stats?.substances ?? 0)} Wirkstoffen
            {stats?.lastImport ? ` · Swissmedic-Stand vom ${formatDate(stats.lastImport)}` : ""}
          </p>
        </div>
      </div>

      {!stats?.lastImport && (
        <div className="notice attention" style={{ marginBottom: 18 }}>
          <Info />
          <div>
            <strong>Beispieldaten</strong>
            <p>
              Der Katalog zeigt von Hand erfasste Beispielarzneimittel. Die vollständige Liste aller in der Schweiz
              zugelassenen Arzneimittel übernimmt die Administration unter Verwaltung › Swissmedic-Import.
            </p>
          </div>
        </div>
      )}

      <CatalogSearch total={result.total} />

      <div className="catalog-layout">
        <FilterPanel forms={options.forms} groups={FORM_GROUPS} atcGroups={options.atcGroups} />
        <section aria-label="Suchergebnisse">
          <div className="result-toolbar">
            <span className="result-count">
              <strong>{formatCount(result.total)}</strong> {result.total === 1 ? "Arzneimittel" : "Arzneimittel"}
              {filters.q && <> für «{filters.q}»</>}
            </span>
            <ResultControls sort={filters.sort} view={view} hasQuery={!!filters.q} />
          </div>
          <ActiveFilters base="/" params={current} labels={labels} />

          {result.items.length === 0 ? (
            <div className="card empty-state">
              <MagnifyingGlass />
              <strong>Keine Arzneimittel gefunden</strong>
              <p>
                Andere Schreibweise oder weniger Filter versuchen. Gesucht wird in Name, Wirkstoffen, Firma, ATC-Code,
                GTIN, Pharmacode und Zulassungsnummer.
              </p>
            </div>
          ) : view === "liste" ? (
            <div className="card product-list">
              <ProductTable products={result.items} />
              <Pagination
                page={filters.page}
                total={result.total}
                pageSize={result.pageSize}
                href={(page) => withParams("/", current, { seite: page > 1 ? String(page) : undefined })}
                label="Arzneimitteln"
              />
            </div>
          ) : (
            <>
              <div className="product-grid">
                {result.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <div className="card" style={{ marginTop: 16 }}>
                <Pagination
                  page={filters.page}
                  total={result.total}
                  pageSize={result.pageSize}
                  href={(page) => withParams("/", current, { seite: page > 1 ? String(page) : undefined })}
                  label="Arzneimitteln"
                />
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
