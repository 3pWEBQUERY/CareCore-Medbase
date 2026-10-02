import Image from "next/image";
import Link from "next/link";
import { imageUrl, type ProductCard as Card } from "@/lib/catalog";
import { ProductBadges } from "./product-badges";

export function ProductCard({ product, href }: { product: Card; href?: string }) {
  return (
    <Link href={href ?? `/arzneimittel/${product.slug}`} className="product-card">
      <div className="product-card-image">
        <Image
          src={imageUrl(product)}
          alt={product.imageId ? `${product.name} ${product.descriptionLine ?? ""}`.trim() : ""}
          width={480}
          height={360}
          loading="lazy"
          unoptimized
        />
      </div>
      <div className="product-card-body">
        <h3>{product.name}</h3>
        <span className="product-card-line">{product.descriptionLine ?? product.form ?? " "}</span>
        <span className="product-card-meta">{product.substances ?? " "}</span>
        <span className="product-card-meta">{product.company ?? " "}</span>
        <div className="product-card-badges">
          <ProductBadges
            category={product.dispensingCategory}
            slListed={product.slListed}
            narcoticList={product.narcoticList}
            status={product.status}
            source={product.source}
            showSource
          />
        </div>
      </div>
    </Link>
  );
}
