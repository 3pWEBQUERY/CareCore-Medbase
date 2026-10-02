import ExcelJS from "exceljs";
import { query, queryOne, transaction } from "./db.ts";
import { swissGtin } from "./gtin.ts";
import { cleanText, normalize, slugify } from "./text.ts";

// Übernahme der Swissmedic-Liste „Zugelassene Packungen“ (Humanarzneimittel, Excel). Eine Zeile ist eine Packung;
// Arzneimittel sind Zulassungsnummer + Dosisstärkenummer. Amtliche Felder werden bei jedem Import aktualisiert,
// in Medbase gepflegte Angaben (Bilder, Preise, Pharmacode, SL, Notizen, korrigierte Darreichungsform, Wirkstoffe mit
// Mengen) bleiben erhalten. Arzneimittel und Packungen, die nicht mehr in der Liste stehen, werden „ausser Handel“.

export const DEFAULT_SWISSMEDIC_URL =
  "https://www.swissmedic.ch/dam/swissmedic/de/dokumente/internetlisten/zugelassene_packungen_human.xlsx.download.xlsx/zugelassene_packungen_ham.xlsx";

export type ImportOptions = { withdrawMissing: boolean };

export type ImportStats = {
  rows: number;
  skipped: number;
  products: number;
  productsCreated: number;
  packages: number;
  packagesCreated: number;
  withdrawnProducts: number;
  withdrawnPackages: number;
  companies: number;
  substances: number;
};

type Column =
  | "authorization"
  | "dosage"
  | "designation"
  | "holder"
  | "remedyCode"
  | "atc"
  | "firstAuthorized"
  | "validUntil"
  | "packageCode"
  | "packageSize"
  | "unit"
  | "categoryPackage"
  | "categoryDosage"
  | "categoryProduct"
  | "substances"
  | "composition"
  | "indicationProduct"
  | "indicationDosage"
  | "narcotic";

// Spaltenköpfe der Swissmedic-Liste, normalisiert (Kleinschreibung, nur Buchstaben und Ziffern). Der erste Treffer zählt.
const HEADERS: [Column, RegExp][] = [
  ["authorization", /^zulassungsnummer|^zulnr/],
  ["dosage", /^dosisstarkenummer|^dosisstarke?nr/],
  ["designation", /^bezeichnungdesarzneimittels|^praparatebezeichnung|^bezeichnung/],
  ["holder", /^zulassungsinhaberin/],
  ["remedyCode", /^heilmittelcode/],
  ["atc", /^atccode/],
  ["firstAuthorized", /^erstzulassungsdatum/],
  ["validUntil", /^gultigkeitsdauer/],
  ["packageCode", /^packungscode/],
  ["packageSize", /^packungsgrosse/],
  ["unit", /^einheit/],
  ["categoryPackage", /^abgabekategoriepackung/],
  ["categoryDosage", /^abgabekategoriedosisstarke/],
  ["categoryProduct", /^abgabekategoriearzneimittel|^abgabekategorie$/],
  ["substances", /^wirkstoff/],
  ["composition", /^zusammensetzung/],
  ["indicationProduct", /^anwendungsgebietarzneimittel|^anwendungsgebiet$/],
  ["indicationDosage", /^anwendungsgebietdosisstarke/],
  ["narcotic", /^betaubungsmittel/],
];

const headerKey = (value: string) => normalize(value).replace(/[^a-z0-9]/g, "");

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("text" in value) return String(value.text);
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    return "";
  }
  return String(value);
}

function cellDate(value: ExcelJS.CellValue): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const text = cellText(value).trim();
  const swiss = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
  if (swiss) return `${swiss[3]}-${swiss[2].padStart(2, "0")}-${swiss[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

const category = (...values: string[]) => {
  for (const value of values) {
    const match = /^\s*([A-E])\b/i.exec(value);
    if (match) return match[1].toUpperCase();
  }
  return null;
};

// „Dafalgan 500 mg, Tabletten“ → Name „Dafalgan“, Zeile „500 mg, Tabletten“, Form „Tabletten“.
export function splitDesignation(designation: string) {
  const text = cleanText(designation, 300);
  const comma = text.lastIndexOf(",");
  const formText = comma >= 0 ? text.slice(comma + 1).trim() : "";
  const head = comma >= 0 ? text.slice(0, comma).trim() : text;
  const words = head.split(" ");
  let cut = words.findIndex((word, index) => index > 0 && /^\d/.test(word));
  if (cut < 0) cut = words.length;
  const name = words.slice(0, cut).join(" ");
  const strength = words.slice(cut).join(" ");
  const line = [strength, formText].filter(Boolean).join(", ");
  return { name: name || text, line: line || null, formText: formText || head };
}

type PackageRow = {
  authorization: string;
  dosage: string;
  designation: string;
  holder: string;
  remedyCode: string;
  atc: string;
  firstAuthorized: string | null;
  validUntil: string | null;
  packageCode: string;
  quantity: number | null;
  unit: string;
  category: string | null;
  productCategory: string | null;
  substances: string[];
  composition: string;
  indication: string;
  narcotic: string | null;
};

export async function readWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Die Datei enthält kein Tabellenblatt.");

  let headerRow = 0;
  const columns = new Map<Column, number>();
  for (let rowNumber = 1; rowNumber <= Math.min(25, sheet.rowCount) && !headerRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const keys: [number, string][] = [];
    row.eachCell((cell, column) => keys.push([column, headerKey(cellText(cell.value))]));
    if (!keys.some(([, key]) => /^zulassungsnummer|^zulnr/.test(key))) continue;
    headerRow = rowNumber;
    for (const [column, key] of keys) {
      const match = HEADERS.find(([name, pattern]) => !columns.has(name) && pattern.test(key));
      if (match) columns.set(match[0], column);
    }
  }
  const missing = (["authorization", "designation", "packageCode"] as Column[]).filter((name) => !columns.has(name));
  if (!headerRow || missing.length)
    throw new Error(
      "Die Datei hat nicht den Aufbau der Swissmedic-Liste „Zugelassene Packungen“ (Spalten Zulassungs-Nummer, Bezeichnung und Packungscode fehlen).",
    );

  const records: PackageRow[] = [];
  let skipped = 0;
  const value = (row: ExcelJS.Row, name: Column) => {
    const column = columns.get(name);
    return column ? row.getCell(column).value : null;
  };
  const text = (row: ExcelJS.Row, name: Column) => cleanText(cellText(value(row, name)), 8000);
  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const authorization = text(row, "authorization").replace(/\D/g, "");
    const designation = text(row, "designation");
    const packageCode = text(row, "packageCode").replace(/\D/g, "");
    if (!authorization && !designation) continue;
    if (!/^\d{1,5}$/.test(authorization) || !designation || !/^\d{1,3}$/.test(packageCode)) {
      skipped += 1;
      continue;
    }
    const size = text(row, "packageSize").replace(",", ".");
    const quantity = /^\d+(\.\d+)?$/.test(size) ? Number(size) : null;
    const unit = text(row, "unit");
    const narcotic = /^\s*([abcd])\b/i.exec(text(row, "narcotic"));
    records.push({
      authorization: authorization.padStart(5, "0"),
      dosage: text(row, "dosage").replace(/\D/g, "").padStart(2, "0").slice(-3) || "01",
      designation,
      holder: text(row, "holder"),
      remedyCode: text(row, "remedyCode"),
      atc: text(row, "atc").toUpperCase().replace(/\s/g, ""),
      firstAuthorized: cellDate(value(row, "firstAuthorized")),
      validUntil: cellDate(value(row, "validUntil")),
      packageCode: packageCode.padStart(3, "0"),
      quantity,
      unit: quantity == null && size ? `${size} ${unit}`.trim() : unit,
      category: category(text(row, "categoryPackage"), text(row, "categoryDosage"), text(row, "categoryProduct")),
      productCategory: category(
        text(row, "categoryDosage"),
        text(row, "categoryProduct"),
        text(row, "categoryPackage"),
      ),
      substances: text(row, "substances")
        .split(/\s*,\s*/)
        .map((name) => name.trim())
        .filter((name) => name.length > 1 && name.length < 200),
      composition: text(row, "composition"),
      indication: text(row, "indicationDosage") || text(row, "indicationProduct"),
      narcotic: narcotic ? narcotic[1].toLowerCase() : null,
    });
  }
  return { records, skipped };
}

type FormRow = { id: number; keywords: string[]; name: string };

export function detectForm(forms: FormRow[], formText: string, designation: string) {
  const fallback = forms.find((form) => form.keywords.length === 0) ?? null;
  for (const source of [formText, designation]) {
    const haystack = ` ${normalize(source)} `;
    const form = forms.find((candidate) => candidate.keywords.some((keyword) => haystack.includes(keyword)));
    if (form) return form.id;
  }
  return fallback?.id ?? null;
}

const remedyType = (code: string) => {
  const value = normalize(code);
  if (/phyto|homoo|anthropo|asiat|gemmo|spagyr/.test(value)) return "komplementaer";
  return null;
};

const chunks = <T>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, index) => list.slice(index * size, (index + 1) * size));

// Latinisierte Namen („paracetamolum“) als lesbarer Name: erster Buchstabe gross.
const substanceName = (latin: string) => latin.charAt(0).toUpperCase() + latin.slice(1);

export async function importRecords(records: PackageRow[], options: ImportOptions, skipped = 0): Promise<ImportStats> {
  const stats: ImportStats = {
    rows: records.length + skipped,
    skipped,
    products: 0,
    productsCreated: 0,
    packages: 0,
    packagesCreated: 0,
    withdrawnProducts: 0,
    withdrawnPackages: 0,
    companies: 0,
    substances: 0,
  };
  if (!records.length) throw new Error("Die Datei enthält keine Packungen.");

  const forms = await query<FormRow>("SELECT id, name, keywords FROM medbase_dosage_forms ORDER BY sort_order, id");

  // Firmen
  const holders = [...new Set(records.map((record) => record.holder).filter(Boolean))];
  for (const batch of chunks(holders, 500)) {
    const created = await query<{ id: string }>(
      `INSERT INTO medbase_companies (name) SELECT DISTINCT ON (medbase_normalize(n)) n FROM unnest($1::text[]) n
       ON CONFLICT (medbase_normalize(name)) DO NOTHING RETURNING id`,
      [batch],
    );
    stats.companies += created.length;
  }
  const companyIds = new Map(
    (await query<{ id: string; key: string }>("SELECT id, medbase_normalize(name) AS key FROM medbase_companies")).map(
      (row) => [row.key, row.id],
    ),
  );

  // Wirkstoffe (lateinische Namen); bestehende Wirkstoffe mit gleichem Namen oder gleichem lateinischen Namen gelten.
  const latinNames = [...new Set(records.flatMap((record) => record.substances.map((name) => name.toLowerCase())))];
  for (const batch of chunks(latinNames, 500)) {
    const created = await query<{ id: string }>(
      `INSERT INTO medbase_substances (name, latin_name)
       SELECT initcap_first, latin FROM (
         SELECT DISTINCT ON (medbase_normalize(l)) upper(left(l, 1)) || substr(l, 2) AS initcap_first, l AS latin
         FROM unnest($1::text[]) l
       ) s
       WHERE NOT EXISTS (
         SELECT 1 FROM medbase_substances x
         WHERE medbase_normalize(x.latin_name) = medbase_normalize(s.latin)
            OR medbase_normalize(x.name) = medbase_normalize(s.initcap_first)
       )
       ON CONFLICT DO NOTHING RETURNING id`,
      [batch],
    );
    stats.substances += created.length;
  }
  const substanceIds = new Map<string, string>();
  for (const row of await query<{ id: string; name: string; latin: string | null }>(
    "SELECT id, medbase_normalize(name) AS name, medbase_normalize(latin_name) AS latin FROM medbase_substances",
  )) {
    substanceIds.set(row.name, row.id);
    if (row.latin) substanceIds.set(row.latin, row.id);
  }

  // Arzneimittel = Zulassungsnummer + Dosisstärke
  const products = new Map<string, PackageRow & { packages: PackageRow[] }>();
  for (const record of records) {
    const key = `${record.authorization}-${record.dosage}`;
    const entry = products.get(key);
    if (entry) entry.packages.push(record);
    else products.set(key, { ...record, packages: [record] });
  }

  const productIds = new Map<string, string>();
  for (const batch of chunks([...products.values()], 400)) {
    const columns = {
      slug: [] as string[],
      name: [] as string[],
      line: [] as (string | null)[],
      authorization: [] as string[],
      dosage: [] as string[],
      company: [] as (string | null)[],
      form: [] as (number | null)[],
      atc: [] as (string | null)[],
      category: [] as (string | null)[],
      narcotic: [] as (string | null)[],
      type: [] as (string | null)[],
      remedy: [] as (string | null)[],
      composition: [] as (string | null)[],
      indication: [] as (string | null)[],
      first: [] as (string | null)[],
      valid: [] as (string | null)[],
    };
    for (const product of batch) {
      const { name, line, formText } = splitDesignation(product.designation);
      columns.slug.push(`${slugify(product.designation)}-${product.authorization}-${product.dosage}`);
      columns.name.push(name);
      columns.line.push(line);
      columns.authorization.push(product.authorization);
      columns.dosage.push(product.dosage);
      columns.company.push(companyIds.get(normalize(product.holder)) ?? null);
      columns.form.push(detectForm(forms, formText, product.designation));
      columns.atc.push(/^[A-Z]\d{2}([A-Z]([A-Z](\d{2})?)?)?$/.test(product.atc) ? product.atc : null);
      columns.category.push(product.productCategory);
      columns.narcotic.push(product.narcotic);
      columns.type.push(remedyType(product.remedyCode));
      columns.remedy.push(product.remedyCode || null);
      columns.composition.push(product.composition || null);
      columns.indication.push(product.indication || null);
      columns.first.push(product.firstAuthorized);
      columns.valid.push(product.validUntil);
    }
    const rows = await query<{ id: string; authorization_number: string; dosage_number: string; inserted: boolean }>(
      `INSERT INTO medbase_products (slug, name, description_line, authorization_number, dosage_number, company_id,
         dosage_form_id, atc_code, dispensing_category, narcotic_list, product_type, remedy_code, composition, indication,
         first_authorized_on, authorization_valid_until, status, source)
       SELECT *, 'aktiv', 'swissmedic' FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::uuid[],
         $7::int[], $8::text[], $9::text[], $10::text[], $11::text[], $12::text[], $13::text[], $14::text[], $15::date[], $16::date[])
       ON CONFLICT (authorization_number, dosage_number)
         WHERE authorization_number IS NOT NULL AND dosage_number IS NOT NULL
       DO UPDATE SET
         name = EXCLUDED.name,
         description_line = EXCLUDED.description_line,
         company_id = COALESCE(EXCLUDED.company_id, medbase_products.company_id),
         dosage_form_id = COALESCE(medbase_products.dosage_form_id, EXCLUDED.dosage_form_id),
         atc_code = COALESCE(EXCLUDED.atc_code, medbase_products.atc_code),
         dispensing_category = COALESCE(EXCLUDED.dispensing_category, medbase_products.dispensing_category),
         narcotic_list = EXCLUDED.narcotic_list,
         product_type = COALESCE(medbase_products.product_type, EXCLUDED.product_type),
         remedy_code = EXCLUDED.remedy_code,
         composition = COALESCE(EXCLUDED.composition, medbase_products.composition),
         indication = COALESCE(EXCLUDED.indication, medbase_products.indication),
         first_authorized_on = EXCLUDED.first_authorized_on,
         authorization_valid_until = EXCLUDED.authorization_valid_until,
         status = CASE WHEN medbase_products.status = 'entwurf' THEN 'entwurf' ELSE 'aktiv' END,
         source = 'swissmedic',
         updated_at = CASE WHEN (medbase_products.name, medbase_products.description_line, medbase_products.status)
           IS DISTINCT FROM (EXCLUDED.name, EXCLUDED.description_line, 'aktiv') THEN NOW() ELSE medbase_products.updated_at END
       RETURNING id, authorization_number, dosage_number, (xmax = 0) AS inserted`,
      Object.values(columns),
    );
    for (const row of rows) {
      productIds.set(`${row.authorization_number}-${row.dosage_number}`, row.id);
      if (row.inserted) stats.productsCreated += 1;
    }
  }
  stats.products = productIds.size;

  // Wirkstoff-Zuordnung: nur bei Arzneimitteln ohne gepflegte Mengenangaben ersetzen.
  for (const batch of chunks([...products.entries()], 500)) {
    const productColumn: string[] = [];
    const substanceColumn: string[] = [];
    const orderColumn: number[] = [];
    for (const [key, product] of batch) {
      const productId = productIds.get(key);
      if (!productId) continue;
      const seen = new Set<string>();
      product.substances.forEach((latin, index) => {
        const substanceId = substanceIds.get(normalize(latin)) ?? substanceIds.get(normalize(substanceName(latin)));
        if (!substanceId || seen.has(substanceId)) return;
        seen.add(substanceId);
        productColumn.push(productId);
        substanceColumn.push(substanceId);
        orderColumn.push(index);
      });
    }
    const ids = batch.map(([key]) => productIds.get(key)).filter(Boolean);
    await transaction(async (client) => {
      await query(
        `DELETE FROM medbase_product_substances ps WHERE ps.product_id = ANY($1::uuid[])
           AND NOT EXISTS (SELECT 1 FROM medbase_product_substances x WHERE x.product_id = ps.product_id AND x.amount IS NOT NULL)`,
        [ids],
        client,
      );
      await query(
        `INSERT INTO medbase_product_substances (product_id, substance_id, sort_order)
         SELECT p, s, o FROM unnest($1::uuid[], $2::uuid[], $3::int[]) AS t(p, s, o)
         WHERE NOT EXISTS (SELECT 1 FROM medbase_product_substances x WHERE x.product_id = t.p AND x.amount IS NOT NULL)
         ON CONFLICT DO NOTHING`,
        [productColumn, substanceColumn, orderColumn],
        client,
      );
    });
  }

  // Packungen
  const packageKeys: string[] = [];
  for (const batch of chunks(records, 1000)) {
    const product: string[] = [];
    const code: string[] = [];
    const gtin: (string | null)[] = [];
    const quantity: (number | null)[] = [];
    const unit: (string | null)[] = [];
    const cat: (string | null)[] = [];
    const seen = new Set<string>();
    for (const record of batch) {
      const productId = productIds.get(`${record.authorization}-${record.dosage}`);
      if (!productId || seen.has(`${productId}-${record.packageCode}`)) continue;
      seen.add(`${productId}-${record.packageCode}`);
      packageKeys.push(`${productId}-${record.packageCode}`);
      product.push(productId);
      code.push(record.packageCode);
      gtin.push(swissGtin(record.authorization, record.packageCode));
      quantity.push(record.quantity);
      unit.push(record.unit || null);
      cat.push(record.category);
    }
    const rows = await query<{ inserted: boolean }>(
      `INSERT INTO medbase_packages (product_id, package_code, gtin, quantity, unit, dispensing_category, status, sort_order)
       SELECT p, c, g, q, u, k, 'aktiv', c::int FROM unnest($1::uuid[], $2::text[], $3::text[], $4::numeric[], $5::text[], $6::text[])
         AS t(p, c, g, q, u, k)
       WHERE g IS NULL OR NOT EXISTS (SELECT 1 FROM medbase_packages x WHERE x.gtin = t.g AND x.product_id <> t.p)
       ON CONFLICT (product_id, package_code) WHERE package_code IS NOT NULL
       DO UPDATE SET gtin = COALESCE(EXCLUDED.gtin, medbase_packages.gtin), quantity = EXCLUDED.quantity,
         unit = EXCLUDED.unit, dispensing_category = COALESCE(EXCLUDED.dispensing_category, medbase_packages.dispensing_category),
         status = 'aktiv', updated_at = NOW()
       RETURNING (xmax = 0) AS inserted`,
      [product, code, gtin, quantity, unit, cat],
    );
    stats.packages += rows.length;
    stats.packagesCreated += rows.filter((row) => row.inserted).length;
  }

  if (options.withdrawMissing) {
    const ids = [...productIds.values()];
    const withdrawn = await query(
      `UPDATE medbase_products SET status = 'ausser_handel', updated_at = NOW()
       WHERE source = 'swissmedic' AND status = 'aktiv' AND NOT (id = ANY($1::uuid[])) RETURNING id`,
      [ids],
    );
    stats.withdrawnProducts = withdrawn.length;
    const packages = await query(
      `UPDATE medbase_packages pk SET status = 'ausser_handel', updated_at = NOW()
       WHERE pk.status = 'aktiv' AND pk.package_code IS NOT NULL AND pk.product_id = ANY($1::uuid[])
         AND NOT ((pk.product_id::text || '-' || pk.package_code) = ANY($2::text[]))
       RETURNING id`,
      [ids, packageKeys],
    );
    stats.withdrawnPackages = packages.length;
  }

  for (const batch of chunks([...productIds.values()], 1000))
    await query("SELECT medbase_refresh_search($1::uuid[])", [batch]);
  if (stats.withdrawnProducts)
    await query(
      "SELECT medbase_refresh_search(ARRAY(SELECT id FROM medbase_products WHERE source = 'swissmedic' AND status = 'ausser_handel'))",
    );
  return stats;
}

export async function downloadList(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("Nur https-Adressen sind erlaubt.");
  const response = await fetch(parsed, { signal: AbortSignal.timeout(180_000), redirect: "follow" });
  if (!response.ok) throw new Error(`Swissmedic antwortet mit HTTP ${response.status}.`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > 80 * 1024 * 1024) throw new Error("Die Datei ist grösser als 80 MB.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.subarray(0, 2).toString() !== "PK") throw new Error("Die Adresse liefert keine Excel-Datei (.xlsx).");
  return buffer;
}

// Ein Importlauf mit Protokoll in medbase_import_runs; Fehler werden dort festgehalten, nicht geworfen.
export async function runImport(runId: string, load: () => Promise<Buffer>, options: ImportOptions) {
  try {
    const buffer = await load();
    const { records, skipped } = await readWorkbook(buffer);
    const stats = await importRecords(records, options, skipped);
    await query(
      "UPDATE medbase_import_runs SET status = 'abgeschlossen', stats = $2, finished_at = NOW() WHERE id = $1",
      [runId, JSON.stringify(stats)],
    );
    return stats;
  } catch (error) {
    console.error("Swissmedic import failed", error);
    await query("UPDATE medbase_import_runs SET status = 'fehler', error = $2, finished_at = NOW() WHERE id = $1", [
      runId,
      (error instanceof Error ? error.message : String(error)).slice(0, 2000),
    ]);
    return null;
  }
}

// Neuer Lauf, sofern keiner läuft (ein Lauf ohne Abschluss nach 30 Minuten gilt als abgebrochen).
export async function startRun(source: string, fileName: string | null, userId: string | null) {
  await query(
    `UPDATE medbase_import_runs SET status = 'fehler', error = 'Abgebrochen (Zeitüberschreitung oder Neustart).', finished_at = NOW()
     WHERE status = 'laeuft' AND started_at < NOW() - INTERVAL '30 minutes'`,
  );
  return queryOne<{ id: string }>(
    `INSERT INTO medbase_import_runs (source, file_name, started_by)
     SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM medbase_import_runs WHERE status = 'laeuft')
     RETURNING id`,
    [source, fileName, userId],
  );
}
