import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { ImageManager } from "@/app/components/image-manager";
import { ProductBadges } from "@/app/components/product-badges";
import { ProductEditor } from "@/app/components/product-editor";
import { emptyProduct } from "@/lib/product-form";
import type { ProductInput } from "@/lib/admin-products";
import { productFormData } from "@/lib/admin-products";
import { getProduct, imageUrl } from "@/lib/catalog";
import { SOURCES, labelOf } from "@/lib/reference-data";
import { formatDateTime } from "@/lib/text";

const text = (value: number | string | null | undefined) => (value == null ? "" : String(value));

export async function generateMetadata({ params }: PageProps<"/admin/arzneimittel/[id]">) {
  const data = await getProduct({ id: (await params).id });
  return { title: data ? `${data.product.name} bearbeiten` : "Nicht gefunden" };
}

export default async function EditProduct({ params }: PageProps<"/admin/arzneimittel/[id]">) {
  const { id } = await params;
  const [data, { forms }] = await Promise.all([getProduct({ id }), productFormData()]);
  if (!data) notFound();
  const { product, substances, packages, images } = data;
  const initial: ProductInput = {
    ...emptyProduct(),
    name: product.name,
    descriptionLine: text(product.descriptionLine),
    authorizationNumber: text(product.authorizationNumber),
    dosageNumber: text(product.dosageNumber),
    company: text(product.company),
    dosageFormId: text(product.dosageFormId),
    atcCode: text(product.atcCode),
    atcName: text(product.atcName),
    dispensingCategory: text(product.dispensingCategory),
    narcoticList: text(product.narcoticList),
    slListed: product.slListed,
    productType: text(product.productType),
    remedyCode: text(product.remedyCode),
    composition: text(product.composition),
    indication: text(product.indication),
    notes: text(product.notes),
    firstAuthorizedOn: text(product.firstAuthorizedOn),
    authorizationValidUntil: text(product.authorizationValidUntil),
    status: product.status,
    substances: substances.map((substance) => ({
      name: substance.name,
      amount: text(substance.amount),
      unit: text(substance.unit),
    })),
    packages: packages.map((pack) => ({
      id: pack.id,
      packageCode: text(pack.packageCode),
      gtin: text(pack.gtin),
      pharmacode: text(pack.pharmacode),
      quantity: text(pack.quantity),
      unit: text(pack.unit),
      dispensingCategory: text(pack.dispensingCategory),
      exFactoryPrice: pack.exFactoryPrice == null ? "" : pack.exFactoryPrice.toFixed(2),
      publicPrice: pack.publicPrice == null ? "" : pack.publicPrice.toFixed(2),
      slListed: pack.slListed,
      status: pack.status,
    })),
  };
  const primary = images[0];
  return (
    <main className="workspace">
      <Link className="quiet-button" href="/admin/arzneimittel" style={{ marginBottom: 10, paddingInline: 0 }}>
        <ArrowLeft /> Alle Arzneimittel
      </Link>
      <div className="page-heading">
        <div className="heading-copy">
          <p className="eyebrow">Arzneimittel bearbeiten</p>
          <h1>
            {product.name}{" "}
            {product.descriptionLine && (
              <span className="muted" style={{ fontWeight: 500 }}>
                {product.descriptionLine}
              </span>
            )}
          </h1>
          <p style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <ProductBadges
              category={product.dispensingCategory}
              slListed={product.slListed}
              narcoticList={product.narcoticList}
              status={product.status}
              source={product.source}
              showSource
            />
          </p>
        </div>
      </div>
      <ProductEditor
        key={product.updatedAt}
        productId={product.id}
        slug={product.slug}
        initial={initial}
        forms={forms}
        knownAtc={!!product.atcName}
        aside={
          <section className="card editor-preview">
            <Image
              src={
                primary
                  ? `/api/bilder/${primary.id}?groesse=klein`
                  : imageUrl({ id: product.id, imageId: null, updatedAt: product.updatedAt })
              }
              alt=""
              width={300}
              height={225}
              unoptimized
            />
            <dl className="meta-list">
              <div>
                <dt>Quelle</dt>
                <dd>{labelOf(SOURCES, product.source)}</dd>
              </div>
              <div>
                <dt>Geändert</dt>
                <dd>{formatDateTime(product.updatedAt)}</dd>
              </div>
              {product.updatedByName && (
                <div>
                  <dt>Von</dt>
                  <dd>{product.updatedByName}</dd>
                </div>
              )}
              <div>
                <dt>Angelegt</dt>
                <dd>{formatDateTime(product.createdAt)}</dd>
              </div>
            </dl>
          </section>
        }
        images={<ImageManager productId={product.id} productName={product.name} images={images} />}
      />
    </main>
  );
}
