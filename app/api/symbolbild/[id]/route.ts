import { queryOne } from "@/lib/db";
import { renderPackshot } from "@/lib/packshot";

// Symbolbild (Packungsabbildung) für Arzneimittel ohne eigenes Bild, aus den aktuellen Angaben erzeugt.
// Die Adresse enthält den Änderungszeitpunkt (?v=…), darum darf lange zwischengespeichert werden.
export async function GET(_request: Request, { params }: RouteContext<"/api/symbolbild/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Nicht gefunden", { status: 404 });
  const product = await queryOne<{
    name: string;
    line: string | null;
    form: string | null;
    illustration: string | null;
    company: string | null;
    atc: string | null;
  }>(
    `SELECT p.name, p.description_line AS line, f.name AS form, f.illustration, c.name AS company, p.atc_code AS atc
     FROM medbase_products p
     LEFT JOIN medbase_dosage_forms f ON f.id = p.dosage_form_id
     LEFT JOIN medbase_companies c ON c.id = p.company_id
     WHERE p.id = $1`,
    [id],
  );
  if (!product) return new Response("Nicht gefunden", { status: 404 });
  const svg = renderPackshot({
    name: product.name,
    line: product.line,
    form: product.form,
    company: product.company,
    atcCode: product.atc,
    illustration: product.illustration,
  });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
