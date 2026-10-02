import "server-only";
import { query, queryOne } from "./db.ts";
import { normalize } from "./text.ts";

// Lesende Abfragen des Katalogs: Suche mit Filtern, Detailansicht und Verzeichnisse.

export const PAGE_SIZE = 24;

export type CatalogFilters = {
  q: string;
  form: string; // Darreichungsform-ID
  group: string; // Gruppe der Darreichungsform
  category: string; // Abgabekategorie
  atc: string; // ATC-Präfix
  company: string; // Firmen-ID
  substance: string; // Wirkstoff-ID
  sl: boolean;
  narcotic: boolean;
  withImage: boolean;
  withoutPhoto: boolean; // ohne hochgeladenes Foto (Verwaltung)
  status: string; // aktiv | ausser_handel | alle
  source: string; // swissmedic | manuell | beispiel | ''
  sort: "relevanz" | "name" | "neu";
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export function parseFilters(params: SearchParams): CatalogFilters {
  const sort = first(params.sort);
  const page = Number.parseInt(first(params.seite), 10);
  return {
    q: first(params.q).trim().slice(0, 120),
    form: /^\d+$/.test(first(params.form)) ? first(params.form) : "",
    group: first(params.gruppe).slice(0, 30),
    category: /^[A-E]$/.test(first(params.kategorie)) ? first(params.kategorie) : "",
    atc: /^[A-Za-z0-9]{1,7}$/.test(first(params.atc)) ? first(params.atc).toUpperCase() : "",
    company: /^[0-9a-f-]{36}$/.test(first(params.firma)) ? first(params.firma) : "",
    substance: /^[0-9a-f-]{36}$/.test(first(params.wirkstoff)) ? first(params.wirkstoff) : "",
    sl: first(params.sl) === "1",
    narcotic: first(params.btm) === "1",
    withImage: first(params.bild) === "1",
    withoutPhoto: first(params.foto) === "ohne",
    status: ["aktiv", "ausser_handel", "entwurf", "alle"].includes(first(params.status)) ? first(params.status) : "",
    source: ["swissmedic", "manuell", "beispiel"].includes(first(params.quelle)) ? first(params.quelle) : "",
    sort: sort === "name" || sort === "neu" ? sort : "relevanz",
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  descriptionLine: string | null;
  company: string | null;
  form: string | null;
  atcCode: string | null;
  dispensingCategory: string | null;
  narcoticList: string | null;
  slListed: boolean;
  status: string;
  source: string;
  substances: string | null;
  packageCount: number;
  imageId: string | null;
  imageType: string | null;
  updatedAt: string;
  authorizationNumber: string | null;
};

// Bedingungen der Suche; `publicOnly` blendet Entwürfe aus (Katalog), die Verwaltung sieht alles.
function buildWhere(filters: CatalogFilters, publicOnly: boolean) {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  const tokens = normalize(filters.q)
    .split(/[\s,;]+/)
    .filter(Boolean)
    .slice(0, 8);
  for (const token of tokens) where.push(`p.search_document LIKE ${add(`%${escapeLike(token)}%`)}`);
  if (filters.form) where.push(`p.dosage_form_id = ${add(Number(filters.form))}`);
  if (filters.group) where.push(`f.form_group = ${add(filters.group)}`);
  if (filters.category) where.push(`p.dispensing_category = ${add(filters.category)}`);
  if (filters.atc) where.push(`p.atc_code LIKE ${add(`${escapeLike(filters.atc)}%`)}`);
  if (filters.company) where.push(`p.company_id = ${add(filters.company)}`);
  if (filters.substance)
    where.push(
      `EXISTS (SELECT 1 FROM medbase_product_substances ps WHERE ps.product_id = p.id AND ps.substance_id = ${add(filters.substance)})`,
    );
  if (filters.sl) where.push("p.sl_listed");
  if (filters.narcotic) where.push("p.narcotic_list IS NOT NULL");
  if (filters.withImage) where.push("EXISTS (SELECT 1 FROM medbase_images i WHERE i.product_id = p.id)");
  if (filters.withoutPhoto)
    where.push("NOT EXISTS (SELECT 1 FROM medbase_images i WHERE i.product_id = p.id AND i.origin = 'upload')");
  if (filters.source) where.push(`p.source = ${add(filters.source)}`);
  const status = filters.status || "aktiv";
  if (status !== "alle") where.push(`p.status = ${add(status)}`);
  else if (publicOnly) where.push("p.status <> 'entwurf'");
  if (publicOnly && status === "entwurf") where.push("FALSE");
  return { where: where.length ? `WHERE ${where.join(" AND ")}` : "", params, tokens };
}

export async function searchProducts(
  filters: CatalogFilters,
  options: { publicOnly?: boolean; pageSize?: number } = {},
) {
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const { where, params, tokens } = buildWhere(filters, options.publicOnly ?? true);
  const phrase = tokens.join(" ");
  const relevance = filters.sort === "relevanz" && !!phrase;
  if (relevance) params.push(phrase);
  const phraseParam = `$${params.length}`;
  const order =
    filters.sort === "name"
      ? "medbase_normalize(p.name), p.description_line"
      : filters.sort === "neu"
        ? "p.updated_at DESC"
        : relevance
          ? `(medbase_normalize(p.name) = ${phraseParam}) DESC,
             (medbase_normalize(p.name) LIKE ${phraseParam} || '%') DESC,
             similarity(medbase_normalize(p.name), ${phraseParam}) DESC,
             medbase_normalize(p.name), p.description_line`
          : "medbase_normalize(p.name), p.description_line";
  params.push(pageSize, (filters.page - 1) * pageSize);
  const rows = await query<ProductCard & { total: number }>(
    `SELECT p.id, p.slug, p.name, p.description_line AS "descriptionLine", c.name AS company, f.name AS form,
       p.atc_code AS "atcCode", p.dispensing_category AS "dispensingCategory", p.narcotic_list AS "narcoticList",
       p.sl_listed AS "slListed", p.status, p.source, p.updated_at AS "updatedAt",
       p.authorization_number AS "authorizationNumber",
       (SELECT string_agg(s.name, ', ' ORDER BY ps.sort_order, s.name)
          FROM medbase_product_substances ps JOIN medbase_substances s ON s.id = ps.substance_id
         WHERE ps.product_id = p.id) AS substances,
       (SELECT COUNT(*)::int FROM medbase_packages pk WHERE pk.product_id = p.id) AS "packageCount",
       img.id AS "imageId", img.content_type AS "imageType",
       COUNT(*) OVER ()::int AS total
     FROM medbase_products p
     LEFT JOIN medbase_companies c ON c.id = p.company_id
     LEFT JOIN medbase_dosage_forms f ON f.id = p.dosage_form_id
     LEFT JOIN LATERAL (
       SELECT i.id, i.content_type FROM medbase_images i WHERE i.product_id = p.id
       ORDER BY i.is_primary DESC, i.sort_order, i.created_at LIMIT 1
     ) img ON TRUE
     ${where}
     ORDER BY ${order}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  // Seite hinter dem Ende: Gesamtzahl separat zählen, damit die Seitenleiste stimmt.
  let total = rows[0]?.total ?? 0;
  if (!rows.length && filters.page > 1) {
    const count = await queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM medbase_products p
       LEFT JOIN medbase_dosage_forms f ON f.id = p.dosage_form_id ${where}`,
      params.slice(0, relevance ? -3 : -2),
    );
    total = count?.total ?? 0;
  }
  return { items: rows as ProductCard[], total, pageSize };
}

export function imageUrl(
  card: { id: string; imageId: string | null; updatedAt: string | Date },
  size: "thumb" | "full" = "thumb",
) {
  if (card.imageId) return `/api/bilder/${card.imageId}${size === "thumb" ? "?groesse=klein" : ""}`;
  return `/api/symbolbild/${card.id}?v=${new Date(card.updatedAt).getTime()}`;
}

export async function filterOptions() {
  const [forms, categories] = await Promise.all([
    query<{ id: number; name: string; group: string; count: number }>(
      `SELECT f.id, f.name, f.form_group AS group,
         (SELECT COUNT(*)::int FROM medbase_products p WHERE p.dosage_form_id = f.id AND p.status = 'aktiv') AS count
       FROM medbase_dosage_forms f ORDER BY f.sort_order, f.name`,
    ),
    query<{ code: string; name: string }>("SELECT code, name FROM medbase_atc WHERE level = 1 ORDER BY code"),
  ]);
  return { forms: forms.filter((form) => form.count > 0), atcGroups: categories };
}

export async function lookupName(kind: "company" | "substance" | "atc", id: string) {
  if (kind === "company")
    return (await queryOne<{ name: string }>("SELECT name FROM medbase_companies WHERE id = $1", [id]))?.name ?? null;
  if (kind === "substance")
    return (await queryOne<{ name: string }>("SELECT name FROM medbase_substances WHERE id = $1", [id]))?.name ?? null;
  return (await queryOne<{ name: string }>("SELECT name FROM medbase_atc WHERE code = $1", [id]))?.name ?? null;
}

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  descriptionLine: string | null;
  authorizationNumber: string | null;
  dosageNumber: string | null;
  companyId: string | null;
  company: string | null;
  companyWebsite: string | null;
  dosageFormId: number | null;
  form: string | null;
  formGroup: string | null;
  illustration: string | null;
  atcCode: string | null;
  atcName: string | null;
  dispensingCategory: string | null;
  narcoticList: string | null;
  slListed: boolean;
  productType: string | null;
  remedyCode: string | null;
  composition: string | null;
  indication: string | null;
  notes: string | null;
  firstAuthorizedOn: string | null;
  authorizationValidUntil: string | null;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  updatedByName: string | null;
};

export type ProductSubstance = {
  id: string;
  name: string;
  latinName: string | null;
  amount: number | null;
  unit: string | null;
};
export type ProductPackage = {
  id: string;
  packageCode: string | null;
  gtin: string | null;
  pharmacode: string | null;
  quantity: number | null;
  unit: string | null;
  dispensingCategory: string | null;
  exFactoryPrice: number | null;
  publicPrice: number | null;
  slListed: boolean;
  status: string;
};
export type ProductImage = {
  id: string;
  altText: string;
  contentType: string;
  width: number | null;
  height: number | null;
  byteSize: number;
  origin: string;
  isPrimary: boolean;
  originalFilename: string | null;
  createdAt: string;
};

const PRODUCT_COLUMNS = `p.id, p.slug, p.name, p.description_line AS "descriptionLine",
  p.authorization_number AS "authorizationNumber", p.dosage_number AS "dosageNumber",
  p.company_id AS "companyId", c.name AS company, c.website AS "companyWebsite",
  p.dosage_form_id AS "dosageFormId", f.name AS form, f.form_group AS "formGroup", f.illustration,
  p.atc_code AS "atcCode", a.name AS "atcName", p.dispensing_category AS "dispensingCategory",
  p.narcotic_list AS "narcoticList", p.sl_listed AS "slListed", p.product_type AS "productType",
  p.remedy_code AS "remedyCode", p.composition, p.indication, p.notes,
  p.first_authorized_on AS "firstAuthorizedOn", p.authorization_valid_until AS "authorizationValidUntil",
  p.status, p.source, p.created_at AS "createdAt", p.updated_at AS "updatedAt", u.display_name AS "updatedByName"`;

const PRODUCT_JOINS = `FROM medbase_products p
  LEFT JOIN medbase_companies c ON c.id = p.company_id
  LEFT JOIN medbase_dosage_forms f ON f.id = p.dosage_form_id
  LEFT JOIN medbase_atc a ON a.code = p.atc_code
  LEFT JOIN medbase_users u ON u.id = p.updated_by`;

export async function getProduct(by: { slug?: string; id?: string }) {
  const product = by.slug
    ? await queryOne<ProductDetail>(`SELECT ${PRODUCT_COLUMNS} ${PRODUCT_JOINS} WHERE p.slug = $1`, [by.slug])
    : /^[0-9a-f-]{36}$/.test(by.id ?? "")
      ? await queryOne<ProductDetail>(`SELECT ${PRODUCT_COLUMNS} ${PRODUCT_JOINS} WHERE p.id = $1`, [by.id])
      : null;
  if (!product) return null;
  const [substances, packages, images, atcPath] = await Promise.all([
    query<ProductSubstance>(
      `SELECT s.id, s.name, s.latin_name AS "latinName", ps.amount, ps.unit
       FROM medbase_product_substances ps JOIN medbase_substances s ON s.id = ps.substance_id
       WHERE ps.product_id = $1 ORDER BY ps.sort_order, s.name`,
      [product.id],
    ),
    query<ProductPackage>(
      `SELECT id, package_code AS "packageCode", gtin, pharmacode, quantity, unit,
         dispensing_category AS "dispensingCategory", ex_factory_price AS "exFactoryPrice",
         public_price AS "publicPrice", sl_listed AS "slListed", status
       FROM medbase_packages WHERE product_id = $1 ORDER BY sort_order, quantity NULLS LAST, created_at`,
      [product.id],
    ),
    query<ProductImage>(
      `SELECT id, alt_text AS "altText", content_type AS "contentType", width, height, byte_size AS "byteSize",
         origin, is_primary AS "isPrimary", original_filename AS "originalFilename", created_at AS "createdAt"
       FROM medbase_images WHERE product_id = $1 ORDER BY is_primary DESC, sort_order, created_at`,
      [product.id],
    ),
    product.atcCode
      ? query<{ code: string; name: string }>(
          `SELECT code, name FROM medbase_atc
           WHERE code IN ($1, $2, $3, $4, $5) ORDER BY length(code)`,
          [1, 3, 4, 5, 7].map((length) => product.atcCode!.slice(0, length)),
        )
      : Promise.resolve([]),
  ]);
  return { product, substances, packages, images, atcPath };
}

// Weitere Stärken und Formen desselben Namens sowie Arzneimittel mit gleichem ATC-Code (Alternativen).
export async function relatedProducts(product: ProductDetail) {
  const base = normalize(product.name).split(/\s+/)[0] ?? "";
  return query<ProductCard>(
    `SELECT p.id, p.slug, p.name, p.description_line AS "descriptionLine", c.name AS company, NULL AS form,
       p.atc_code AS "atcCode", p.dispensing_category AS "dispensingCategory", p.narcotic_list AS "narcoticList",
       p.sl_listed AS "slListed", p.status, p.source, p.updated_at AS "updatedAt",
       p.authorization_number AS "authorizationNumber", NULL AS substances, 0 AS "packageCount",
       img.id AS "imageId", img.content_type AS "imageType"
     FROM medbase_products p
     LEFT JOIN medbase_companies c ON c.id = p.company_id
     LEFT JOIN LATERAL (
       SELECT i.id, i.content_type FROM medbase_images i WHERE i.product_id = p.id
       ORDER BY i.is_primary DESC, i.sort_order LIMIT 1
     ) img ON TRUE
     WHERE p.id <> $1 AND p.status = 'aktiv'
       AND ((p.atc_code = $2 AND $2 IS NOT NULL) OR medbase_normalize(p.name) LIKE $3)
     ORDER BY (medbase_normalize(p.name) LIKE $3) DESC, medbase_normalize(p.name), p.description_line
     LIMIT 8`,
    [product.id, product.atcCode && product.atcCode.length === 7 ? product.atcCode : null, `${escapeLike(base)}%`],
  );
}

export async function catalogStats() {
  return queryOne<{
    products: number;
    packages: number;
    substances: number;
    companies: number;
    lastImport: string | null;
  }>(
    `SELECT
       (SELECT COUNT(*)::int FROM medbase_products WHERE status = 'aktiv') AS products,
       (SELECT COUNT(*)::int FROM medbase_packages pk JOIN medbase_products p ON p.id = pk.product_id
         WHERE p.status = 'aktiv' AND pk.status = 'aktiv') AS packages,
       (SELECT COUNT(DISTINCT ps.substance_id)::int FROM medbase_product_substances ps) AS substances,
       (SELECT COUNT(DISTINCT company_id)::int FROM medbase_products WHERE status = 'aktiv') AS companies,
       (SELECT MAX(finished_at) FROM medbase_import_runs WHERE status = 'abgeschlossen') AS "lastImport"`,
  );
}

// Verzeichnisse (Wirkstoffe, Firmen) mit Anfangsbuchstaben-Filter und Suche.
export async function directory(
  kind: "substances" | "companies",
  options: { q: string; letter: string; page: number },
) {
  const table = kind === "substances" ? "medbase_substances" : "medbase_companies";
  const link =
    kind === "substances"
      ? "medbase_product_substances x JOIN medbase_products p ON p.id = x.product_id WHERE x.substance_id = t.id"
      : "medbase_products p WHERE p.company_id = t.id";
  const params: unknown[] = [];
  const where: string[] = [];
  if (options.q) {
    params.push(`%${escapeLike(normalize(options.q))}%`);
    where.push(
      kind === "substances"
        ? `(medbase_normalize(t.name) LIKE $${params.length} OR medbase_normalize(t.latin_name) LIKE $${params.length})`
        : `medbase_normalize(t.name) LIKE $${params.length}`,
    );
  }
  if (/^[A-Z]$/.test(options.letter)) {
    params.push(`${options.letter.toLowerCase()}%`);
    where.push(`medbase_normalize(t.name) LIKE $${params.length}`);
  } else if (options.letter === "#") where.push("medbase_normalize(t.name) !~ '^[a-z]'");
  const pageSize = 60;
  params.push(pageSize, (options.page - 1) * pageSize);
  const rows = await query<{ id: string; name: string; secondary: string | null; count: number; total: number }>(
    `SELECT * FROM (
       SELECT t.id, t.name, ${kind === "substances" ? "t.latin_name" : "t.website"} AS secondary,
         (SELECT COUNT(*)::int FROM ${link} AND p.status = 'aktiv') AS count
       FROM ${table} t ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ) d
     WHERE d.count > 0
     ORDER BY medbase_normalize(d.name)
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const total = await queryOne<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM ${table} t
     WHERE EXISTS (SELECT 1 FROM ${link} AND p.status = 'aktiv') ${where.length ? `AND ${where.join(" AND ")}` : ""}`,
    params.slice(0, -2),
  );
  return { rows, total: total?.total ?? 0, pageSize };
}

export async function atcTree(prefix: string) {
  const code = /^[A-Z0-9]{1,7}$/.test(prefix) ? prefix : "";
  const childLength = code.length === 0 ? 1 : code.length === 1 ? 3 : code.length === 3 ? 4 : code.length === 4 ? 5 : 7;
  const [current, children, path] = await Promise.all([
    code
      ? queryOne<{ code: string; name: string }>("SELECT code, name FROM medbase_atc WHERE code = $1", [code])
      : null,
    query<{ code: string; name: string | null; count: number }>(
      `SELECT g.code, a.name, g.count FROM (
         SELECT substr(p.atc_code, 1, $2) AS code, COUNT(*)::int AS count
         FROM medbase_products p
         WHERE p.status = 'aktiv' AND p.atc_code LIKE $1 || '%' AND length(p.atc_code) >= $2
         GROUP BY 1
       ) g LEFT JOIN medbase_atc a ON a.code = g.code
       ORDER BY g.code`,
      [code, childLength],
    ),
    code
      ? query<{ code: string; name: string }>(
          "SELECT code, name FROM medbase_atc WHERE code = ANY($1) ORDER BY length(code)",
          [[1, 3, 4, 5].map((length) => code.slice(0, length)).filter((part) => part.length < code.length)],
        )
      : Promise.resolve([]),
  ]);
  return { code, current, children, path, leaf: childLength === 7 && code.length === 7 };
}
