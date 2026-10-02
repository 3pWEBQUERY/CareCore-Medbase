import Image from "next/image";
import Link from "next/link";
import { imageUrl, type ProductCard } from "@/lib/catalog";
import { formatDateTime } from "@/lib/text";
import { ProductBadges } from "./product-badges";

// Ergebnisse als Tabelle (Katalog „Liste“ und Verwaltung).
export function ProductTable({ products, admin = false }: { products: ProductCard[]; admin?: boolean }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th aria-label="Abbildung" />
            <th>Arzneimittel</th>
            <th className="hide-sm">Wirkstoffe</th>
            <th className="hide-sm">ATC</th>
            <th className="hide-sm">Zulassungsinhaberin</th>
            <th>Kennzeichen</th>
            {admin && <th className="hide-sm">Geändert</th>}
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td style={{ width: 72 }}>
                <Image className="table-thumb" src={imageUrl(product)} alt="" width={52} height={39} unoptimized />
              </td>
              <td>
                <Link
                  className="row-link"
                  href={admin ? `/admin/arzneimittel/${product.id}` : `/arzneimittel/${product.slug}`}
                >
                  {product.name}
                </Link>
                <span className="cell-sub">
                  {product.descriptionLine ?? product.form ?? ""}
                  {product.authorizationNumber && (
                    <span className="mono"> · Zul.-Nr. {product.authorizationNumber}</span>
                  )}
                </span>
              </td>
              <td className="hide-sm">{product.substances ?? "–"}</td>
              <td className="hide-sm mono">{product.atcCode ?? "–"}</td>
              <td className="hide-sm">{product.company ?? "–"}</td>
              <td>
                <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
                  <ProductBadges
                    category={product.dispensingCategory}
                    slListed={product.slListed}
                    narcoticList={product.narcoticList}
                    status={product.status}
                    source={product.source}
                    showSource
                  />
                </span>
              </td>
              {admin && <td className="hide-sm muted">{formatDateTime(product.updatedAt)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
