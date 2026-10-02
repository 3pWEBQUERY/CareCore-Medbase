import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRight, Info, Package, PencilSimpleLine, Warning } from "@phosphor-icons/react/ssr";
import { Gallery, type GalleryImage } from "@/app/components/gallery";
import { ProductBadges } from "@/app/components/product-badges";
import { currentUser } from "@/lib/auth";
import { getProduct, imageUrl, relatedProducts } from "@/lib/catalog";
import { DISPENSING_CATEGORIES, NARCOTIC_LISTS, PRODUCT_TYPES, SOURCES, labelOf } from "@/lib/reference-data";
import { formatDate, formatDateTime, formatNumber, formatPrice } from "@/lib/text";

export async function generateMetadata({ params }: PageProps<"/arzneimittel/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProduct({ slug });
  if (!data) return { title: "Nicht gefunden" };
  const { product } = data;
  return {
    title: `${product.name} ${product.descriptionLine ?? ""}`.trim(),
    description: [product.descriptionLine, product.company, product.atcCode].filter(Boolean).join(" · "),
  };
}

const amount = (value: number | null, unit: string | null) =>
  value == null ? "" : `${formatNumber(value)} ${unit ?? ""}`.trim();

export default async function ProductPage({ params }: PageProps<"/arzneimittel/[slug]">) {
  const { slug } = await params;
  const [data, user] = await Promise.all([getProduct({ slug }), currentUser()]);
  if (!data || (data.product.status === "entwurf" && !user)) notFound();
  const { product, substances, packages, images, atcPath } = data;
  const related = await relatedProducts(product);
  const group = atcPath[0];

  const gallery: GalleryImage[] = images.length
    ? images.map((image) => ({
        id: image.id,
        src: `/api/bilder/${image.id}`,
        thumb: `/api/bilder/${image.id}?groesse=klein`,
        alt: image.altText,
        generated: image.origin === "generiert",
      }))
    : [
        {
          id: "symbolbild",
          src: imageUrl({ id: product.id, imageId: null, updatedAt: product.updatedAt }),
          thumb: imageUrl({ id: product.id, imageId: null, updatedAt: product.updatedAt }),
          alt: `Symbolbild ${product.name}`,
          generated: true,
        },
      ];
  const category = DISPENSING_CATEGORIES.find((entry) => entry.value === product.dispensingCategory);
  const narcotic = NARCOTIC_LISTS.find((entry) => entry.value === product.narcoticList);
  const showPrices = packages.some((pack) => pack.publicPrice != null || pack.exFactoryPrice != null);

  return (
    <main className="workspace">
      <nav className="breadcrumbs" aria-label="Pfad">
        <Link href="/">Katalog</Link>
        {group && (
          <>
            <CaretRight />
            <Link href={`/?atc=${group.code}`}>{group.name}</Link>
          </>
        )}
        <CaretRight />
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="product-hero">
        <Gallery images={gallery} name={product.name} />
        <section className="card product-summary">
          <div>
            <p className="eyebrow">{product.form ?? "Arzneimittel"}</p>
            <h1>{product.name}</h1>
            {product.descriptionLine && <p className="product-line">{product.descriptionLine}</p>}
          </div>
          <div className="badges">
            <ProductBadges
              category={product.dispensingCategory}
              slListed={product.slListed}
              narcoticList={product.narcoticList}
              status={product.status}
              source={product.source}
              showSource
            />
            {product.productType && <span className="badge">{labelOf(PRODUCT_TYPES, product.productType)}</span>}
          </div>
          <dl className="key-facts">
            <div>
              <dt>Wirkstoffe</dt>
              <dd>
                {substances.length
                  ? substances
                      .map(
                        (substance) =>
                          `${substance.name}${substance.amount != null ? ` ${amount(substance.amount, substance.unit)}` : ""}`,
                      )
                      .join(", ")
                  : "–"}
              </dd>
            </div>
            <div>
              <dt>Zulassungsinhaberin</dt>
              <dd>{product.companyId ? <Link href={`/?firma=${product.companyId}`}>{product.company}</Link> : "–"}</dd>
            </div>
            <div>
              <dt>ATC-Code</dt>
              <dd>
                {product.atcCode ? (
                  <Link href={`/atc?code=${product.atcCode}`} className="mono">
                    {product.atcCode}
                  </Link>
                ) : (
                  "–"
                )}
                {product.atcName && <small>{product.atcName}</small>}
              </dd>
            </div>
            <div>
              <dt>Abgabekategorie</dt>
              <dd>
                {category ? category.label : "–"}
                {category && <small>{category.description}</small>}
              </dd>
            </div>
            <div>
              <dt>Zulassungsnummer</dt>
              <dd className="mono">
                {product.authorizationNumber ?? "–"}
                {product.dosageNumber && <small>Dosisstärke {product.dosageNumber}</small>}
              </dd>
            </div>
            <div>
              <dt>Spezialitätenliste</dt>
              <dd>
                {product.slListed ? "Ja" : "Nein"}
                <small>
                  {product.slListed ? "Vergütung durch die Grundversicherung" : "Keine Vergütung über die SL"}
                </small>
              </dd>
            </div>
          </dl>
          {narcotic && (
            <div className="notice critical">
              <Warning />
              <div>
                <strong>Betäubungsmittel</strong>
                <p>{narcotic.description}. Abgabe und Lagerung unterstehen dem Betäubungsmittelgesetz.</p>
              </div>
            </div>
          )}
          {user && (
            <div>
              <Link className="secondary-button" href={`/admin/arzneimittel/${product.id}`}>
                <PencilSimpleLine /> Bearbeiten
              </Link>
            </div>
          )}
        </section>
      </div>

      {product.source === "beispiel" && (
        <div className="notice attention" style={{ marginBottom: 22 }}>
          <Info />
          <div>
            <strong>Beispieldatensatz</strong>
            <p>Von Hand erfasst und nicht amtlich geprüft. Für verbindliche Angaben die Swissmedic-Daten verwenden.</p>
          </div>
        </div>
      )}

      <div className="detail-grid">
        <div>
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Packungen</h2>
                <p>{packages.length === 1 ? "1 Packung" : `${packages.length} Packungen`}</p>
              </div>
              <Package width={20} height={20} color="var(--brand)" />
            </div>
            {packages.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Packung</th>
                      <th>GTIN</th>
                      <th className="hide-sm">Pharmacode</th>
                      <th>Kat.</th>
                      {showPrices && <th className="num">Publikumspreis</th>}
                      {showPrices && <th className="num hide-sm">Fabrikabgabepreis</th>}
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pack) => (
                      <tr key={pack.id}>
                        <td>
                          <strong>{amount(pack.quantity, pack.unit) || pack.unit || "–"}</strong>
                          {pack.packageCode && <span className="cell-sub mono">Packungscode {pack.packageCode}</span>}
                        </td>
                        <td className="mono">{pack.gtin ?? "–"}</td>
                        <td className="mono hide-sm">{pack.pharmacode ?? "–"}</td>
                        <td>
                          {pack.dispensingCategory ? (
                            <span className={`badge badge-cat badge-cat-${pack.dispensingCategory}`}>
                              {pack.dispensingCategory}
                            </span>
                          ) : (
                            "–"
                          )}
                        </td>
                        {showPrices && <td className="num">{formatPrice(pack.publicPrice)}</td>}
                        {showPrices && <td className="num hide-sm">{formatPrice(pack.exFactoryPrice)}</td>}
                        <td>
                          <span className="status-line">
                            <span className={`status-dot ${pack.status === "aktiv" ? "" : "off"}`} />
                            {pack.status === "aktiv" ? "Im Handel" : "Ausser Handel"}
                            {pack.slListed && <span className="badge badge-sl">SL</span>}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="list-hint muted" style={{ padding: 20, margin: 0 }}>
                Keine Packungen erfasst.
              </p>
            )}
          </section>

          {product.indication && (
            <section className="card">
              <div className="card-head">
                <h2>Anwendungsgebiet</h2>
              </div>
              <div className="card-body">
                <p className="text-block">{product.indication}</p>
              </div>
            </section>
          )}
          {product.composition && (
            <section className="card">
              <div className="card-head">
                <h2>Zusammensetzung</h2>
              </div>
              <div className="card-body">
                <p className="text-block">{product.composition}</p>
              </div>
            </section>
          )}
          {user && product.notes && (
            <section className="card">
              <div className="card-head">
                <h2>Interne Notiz</h2>
                <span className="badge">Nur für angemeldete Personen</span>
              </div>
              <div className="card-body">
                <p className="text-block">{product.notes}</p>
              </div>
            </section>
          )}
        </div>

        <div>
          {substances.length > 0 && (
            <section className="card">
              <div className="card-head">
                <h2>Wirkstoffe</h2>
              </div>
              <ul className="substance-list">
                {substances.map((substance) => (
                  <li key={substance.id}>
                    <div>
                      <Link href={`/?wirkstoff=${substance.id}`}>{substance.name}</Link>
                      {substance.latinName && <small>{substance.latinName}</small>}
                    </div>
                    {substance.amount != null && <span>{amount(substance.amount, substance.unit)}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="card">
            <div className="card-head">
              <h2>Zulassung und Datensatz</h2>
            </div>
            <dl className="meta-list">
              <div>
                <dt>Darreichungsform</dt>
                <dd>{product.form ?? "–"}</dd>
              </div>
              {product.remedyCode && (
                <div>
                  <dt>Heilmittelcode</dt>
                  <dd>{product.remedyCode}</dd>
                </div>
              )}
              <div>
                <dt>Erstzulassung</dt>
                <dd>{formatDate(product.firstAuthorizedOn)}</dd>
              </div>
              <div>
                <dt>Zulassung gültig bis</dt>
                <dd>{product.authorizationValidUntil ? formatDate(product.authorizationValidUntil) : "–"}</dd>
              </div>
              <div>
                <dt>Quelle</dt>
                <dd>{labelOf(SOURCES, product.source)}</dd>
              </div>
              <div>
                <dt>Zuletzt geändert</dt>
                <dd>{formatDateTime(product.updatedAt)}</dd>
              </div>
            </dl>
          </section>
          {related.length > 0 && (
            <section className="card">
              <div className="card-head">
                <h2>Weitere Stärken und Alternativen</h2>
              </div>
              <ul className="related-list">
                {related.map((item) => (
                  <li key={item.id}>
                    <Link href={`/arzneimittel/${item.slug}`}>
                      <Image src={imageUrl(item)} alt="" width={56} height={42} unoptimized />
                      <span>
                        <strong>{item.name}</strong>
                        <small>{[item.descriptionLine, item.company].filter(Boolean).join(" · ")}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
