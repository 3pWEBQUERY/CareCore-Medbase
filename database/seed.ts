// Ersteinrichtung und Beispieldaten; läuft bei jedem Deploy nach den Migrationen und ist wiederholbar:
// - Darreichungsformen und ATC-Hauptgruppen werden ergänzt (bestehende Einträge bleiben unverändert).
// - Ohne Benutzer wird „admin“ mit MEDBASE_ADMIN_PASSWORD angelegt.
// - In einer leeren Datenbank entstehen die Beispielarzneimittel mit Packungsabbildungen (im Bucket, sonst in der
//   Datenbank). MEDBASE_SEED_EXAMPLES=false überspringt sie.
//
// Aufruf: node --env-file=.env.local database/seed.ts
import { closePool, query, queryOne, transaction } from "../lib/db.ts";
import { saveImage } from "../lib/image-store.ts";
import { renderPackshot } from "../lib/packshot.ts";
import { hashPassword, passwordProblem } from "../lib/passwords.ts";
import { ATC_GROUPS, DOSAGE_FORMS } from "../lib/reference-data.ts";
import { slugify } from "../lib/text.ts";
import { SEED_PRODUCTS } from "./seed-data.ts";

async function seedReferenceData() {
  for (const [index, form] of DOSAGE_FORMS.entries())
    await query(
      `INSERT INTO medbase_dosage_forms (name, form_group, illustration, keywords, sort_order)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (name) DO NOTHING`,
      [form.name, form.group, form.illustration, form.keywords, (index + 1) * 10],
    );
  for (const [code, name] of ATC_GROUPS)
    await query("INSERT INTO medbase_atc (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING", [code, name]);
}

async function seedAdmin() {
  const existing = await queryOne<{ count: number }>("SELECT COUNT(*)::int AS count FROM medbase_users");
  if (existing && existing.count > 0) return;
  const password = process.env.MEDBASE_ADMIN_PASSWORD ?? "";
  const problem = passwordProblem(password);
  if (problem) {
    console.warn(`No users yet and MEDBASE_ADMIN_PASSWORD is not usable (${problem}) – admin not created.`);
    return;
  }
  await query(
    "INSERT INTO medbase_users (username, display_name, password_hash, role) VALUES ('admin', 'Administration', $1, 'admin')",
    [await hashPassword(password)],
  );
  console.log("Created user 'admin'.");
}

async function seedExamples() {
  if (process.env.MEDBASE_SEED_EXAMPLES === "false") return;
  const count = await queryOne<{ count: number }>("SELECT COUNT(*)::int AS count FROM medbase_products");
  if (count && count.count > 0) return;

  const forms = new Map(
    (
      await query<{ id: number; name: string; illustration: string }>(
        "SELECT id, name, illustration FROM medbase_dosage_forms",
      )
    ).map((row) => [row.name, row]),
  );
  const created: { id: string; product: (typeof SEED_PRODUCTS)[number] }[] = [];
  await transaction(async (client) => {
    const slugs = new Set<string>();
    for (const product of SEED_PRODUCTS) {
      const form = forms.get(product.form);
      if (!form) throw new Error(`Unknown dosage form in seed data: ${product.form}`);
      const company = await queryOne<{ id: string }>(
        `INSERT INTO medbase_companies (name) VALUES ($1)
         ON CONFLICT (medbase_normalize(name)) DO UPDATE SET name = medbase_companies.name RETURNING id`,
        [product.company],
        client,
      );
      await query(
        "INSERT INTO medbase_atc (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING",
        [product.atc, product.atcName],
        client,
      );
      let slug = slugify(`${product.name} ${product.line}`);
      for (let suffix = 2; slugs.has(slug); suffix += 1)
        slug = `${slugify(`${product.name} ${product.line}`)}-${suffix}`;
      slugs.add(slug);
      const row = await queryOne<{ id: string }>(
        `INSERT INTO medbase_products (slug, name, description_line, company_id, dosage_form_id, atc_code,
           dispensing_category, narcotic_list, sl_listed, product_type, indication, status, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'aktiv', 'beispiel') RETURNING id`,
        [
          slug,
          product.name,
          product.line,
          company!.id,
          form.id,
          product.atc,
          product.category,
          product.narcotic ?? null,
          product.sl,
          product.type,
          product.indication,
        ],
        client,
      );
      for (const [index, [name, latin, amount, unit]] of product.substances.entries()) {
        const substance = await queryOne<{ id: string }>(
          `INSERT INTO medbase_substances (name, latin_name) VALUES ($1, $2)
           ON CONFLICT (medbase_normalize(name)) DO UPDATE SET latin_name = COALESCE(medbase_substances.latin_name, EXCLUDED.latin_name)
           RETURNING id`,
          [name, latin],
          client,
        );
        await query(
          "INSERT INTO medbase_product_substances (product_id, substance_id, amount, unit, sort_order) VALUES ($1, $2, $3, $4, $5)",
          [row!.id, substance!.id, amount, unit, index],
          client,
        );
      }
      for (const [index, [quantity, unit]] of product.packs.entries())
        await query(
          `INSERT INTO medbase_packages (product_id, quantity, unit, dispensing_category, sl_listed, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [row!.id, quantity, unit, product.category, product.sl, index],
          client,
        );
      created.push({ id: row!.id, product });
    }
    await query("SELECT medbase_refresh_search(ARRAY(SELECT id FROM medbase_products))", [], client);
  });
  console.log(`Created ${created.length} example products.`);

  // Packungsabbildungen; einzeln gespeichert, damit ein Fehler des Buckets nicht die Daten zurücknimmt.
  let images = 0;
  for (const { id, product } of created) {
    const svg = Buffer.from(
      renderPackshot({
        name: product.name,
        line: product.line,
        form: product.form,
        company: product.company,
        atcCode: product.atc,
        illustration: forms.get(product.form)?.illustration,
      }),
    );
    try {
      await saveImage(
        { full: svg, fullType: "image/svg+xml", thumb: svg, thumbType: "image/svg+xml", width: 800, height: 600 },
        { productId: id, altText: `Symbolbild ${product.name} ${product.line}`, origin: "generiert", primary: true },
      );
      images += 1;
    } catch (error) {
      console.error(`Image for ${product.name} failed:`, error instanceof Error ? error.message : error);
    }
  }
  console.log(`Created ${images} product images.`);
}

try {
  await seedReferenceData();
  await seedAdmin();
  await seedExamples();
} finally {
  await closePool();
}
