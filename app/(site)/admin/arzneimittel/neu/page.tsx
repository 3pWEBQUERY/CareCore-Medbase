import Link from "next/link";
import { ArrowLeft, Info } from "@phosphor-icons/react/ssr";
import { ProductEditor } from "@/app/components/product-editor";
import { emptyProduct } from "@/lib/product-form";
import { productFormData } from "@/lib/admin-products";

export const metadata = { title: "Neues Arzneimittel" };

export default async function NewProduct() {
  const { forms } = await productFormData();
  return (
    <main className="workspace">
      <Link className="quiet-button" href="/admin/arzneimittel" style={{ marginBottom: 10, paddingInline: 0 }}>
        <ArrowLeft /> Alle Arzneimittel
      </Link>
      <div className="page-heading">
        <div className="heading-copy">
          <p className="eyebrow">Neues Arzneimittel</p>
          <h1>Arzneimittel erfassen</h1>
          <p>Pflichtfeld ist nur der Name. Bilder lassen sich nach dem ersten Speichern hochladen.</p>
        </div>
      </div>
      <ProductEditor
        productId={null}
        slug={null}
        initial={emptyProduct()}
        forms={forms}
        knownAtc
        aside={
          <div className="notice">
            <Info />
            <p style={{ margin: 0 }}>Als «Entwurf» gespeichert, bleibt das Arzneimittel im Katalog verborgen.</p>
          </div>
        }
      />
    </main>
  );
}
