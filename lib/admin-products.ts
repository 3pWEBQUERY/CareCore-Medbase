import "server-only";
import type { PoolClient } from "pg";
import { audit } from "./audit.ts";
import { query, queryOne, transaction } from "./db.ts";
import { isValidGtin, swissGtin } from "./gtin.ts";
import { deleteObjects } from "./storage.ts";
import { cleanMultiline, cleanText, normalize, slugify } from "./text.ts";

// Anlegen, Ändern und Löschen von Arzneimitteln in der Verwaltung, mit Prüfung aller Eingaben auf dem Server.

export type SubstanceInput = { name: string; amount: string; unit: string };
export type PackageInput = {
  id?: string;
  packageCode: string;
  gtin: string;
  pharmacode: string;
  quantity: string;
  unit: string;
  dispensingCategory: string;
  exFactoryPrice: string;
  publicPrice: string;
  slListed: boolean;
  status: string;
};
export type ProductInput = {
  name: string;
  descriptionLine: string;
  authorizationNumber: string;
  dosageNumber: string;
  company: string;
  dosageFormId: string;
  atcCode: string;
  atcName: string;
  dispensingCategory: string;
  narcoticList: string;
  slListed: boolean;
  productType: string;
  remedyCode: string;
  composition: string;
  indication: string;
  notes: string;
  firstAuthorizedOn: string;
  authorizationValidUntil: string;
  status: string;
  substances: SubstanceInput[];
  packages: PackageInput[];
};

export type FieldErrors = Record<string, string>;

const isDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const decimal = (value: string) => {
  const text = value.trim().replace(/['\s]/g, "").replace(",", ".");
  if (!text) return null;
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : Number.NaN;
};

const str = (value: unknown, max = 300) => cleanText(value, max);

// Eingaben bereinigen und prüfen; Rückgabe der bereinigten Werte oder der Fehler je Feld.
export function validateProduct(raw: unknown): { input: ProductInput; errors: FieldErrors } {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: FieldErrors = {};
  const input: ProductInput = {
    name: str(data.name, 200),
    descriptionLine: str(data.descriptionLine, 300),
    authorizationNumber: str(data.authorizationNumber, 10).replace(/\s/g, ""),
    dosageNumber: str(data.dosageNumber, 5).replace(/\s/g, ""),
    company: str(data.company, 200),
    dosageFormId: str(data.dosageFormId, 10),
    atcCode: str(data.atcCode, 10).toUpperCase().replace(/\s/g, ""),
    atcName: str(data.atcName, 200),
    dispensingCategory: str(data.dispensingCategory, 1).toUpperCase(),
    narcoticList: str(data.narcoticList, 1).toLowerCase(),
    slListed: data.slListed === true,
    productType: str(data.productType, 20),
    remedyCode: str(data.remedyCode, 200),
    composition: cleanMultiline(data.composition),
    indication: cleanMultiline(data.indication),
    notes: cleanMultiline(data.notes),
    firstAuthorizedOn: str(data.firstAuthorizedOn, 10),
    authorizationValidUntil: str(data.authorizationValidUntil, 10),
    status: str(data.status, 20) || "aktiv",
    substances: Array.isArray(data.substances)
      ? (data.substances as Record<string, unknown>[]).slice(0, 40).map((row) => ({
          name: str(row?.name, 200),
          amount: str(row?.amount, 20),
          unit: str(row?.unit, 30),
        }))
      : [],
    packages: Array.isArray(data.packages)
      ? (data.packages as Record<string, unknown>[]).slice(0, 150).map((row) => ({
          id: typeof row?.id === "string" && /^[0-9a-f-]{36}$/.test(row.id) ? row.id : undefined,
          packageCode: str(row?.packageCode, 5).replace(/\s/g, ""),
          gtin: str(row?.gtin, 20).replace(/\s/g, ""),
          pharmacode: str(row?.pharmacode, 12).replace(/\s/g, ""),
          quantity: str(row?.quantity, 20),
          unit: str(row?.unit, 60),
          dispensingCategory: str(row?.dispensingCategory, 1).toUpperCase(),
          exFactoryPrice: str(row?.exFactoryPrice, 20),
          publicPrice: str(row?.publicPrice, 20),
          slListed: row?.slListed === true,
          status: str(row?.status, 20) || "aktiv",
        }))
      : [],
  };

  if (!input.name) errors.name = "Der Name ist erforderlich.";
  if (input.authorizationNumber && !/^\d{5}$/.test(input.authorizationNumber))
    errors.authorizationNumber = "Die Zulassungsnummer hat fünf Ziffern.";
  if (input.dosageNumber && !/^\d{1,3}$/.test(input.dosageNumber)) errors.dosageNumber = "Ein- bis dreistellige Zahl.";
  if (input.authorizationNumber && !input.dosageNumber) input.dosageNumber = "01";
  if (input.dosageNumber && !input.authorizationNumber)
    errors.authorizationNumber = "Zur Dosisstärke gehört eine Zulassungsnummer.";
  if (input.dosageNumber) input.dosageNumber = input.dosageNumber.padStart(2, "0");
  if (input.dosageFormId && !/^\d+$/.test(input.dosageFormId)) errors.dosageFormId = "Ungültige Darreichungsform.";
  if (input.atcCode && !/^[A-Z](\d{2}([A-Z]([A-Z](\d{2})?)?)?)?$/.test(input.atcCode))
    errors.atcCode = "ATC-Code im Format A, A01, A01A, A01AA oder A01AA01.";
  if (input.dispensingCategory && !"ABCDE".includes(input.dispensingCategory))
    errors.dispensingCategory = "Abgabekategorie A bis E.";
  if (input.narcoticList && !"abcd".includes(input.narcoticList)) errors.narcoticList = "Verzeichnis a bis d.";
  if (
    input.productType &&
    !["original", "generikum", "biosimilar", "komplementaer", "andere"].includes(input.productType)
  )
    errors.productType = "Ungültige Art.";
  if (!["aktiv", "ausser_handel", "entwurf"].includes(input.status)) errors.status = "Ungültiger Status.";
  if (input.firstAuthorizedOn && !isDate(input.firstAuthorizedOn)) errors.firstAuthorizedOn = "Ungültiges Datum.";
  if (input.authorizationValidUntil && !isDate(input.authorizationValidUntil))
    errors.authorizationValidUntil = "Ungültiges Datum.";

  const substanceNames = new Set<string>();
  input.substances = input.substances.filter((row) => row.name || row.amount || row.unit);
  input.substances.forEach((row, index) => {
    if (!row.name) errors[`substances.${index}.name`] = "Wirkstoff angeben.";
    else if (substanceNames.has(normalize(row.name))) errors[`substances.${index}.name`] = "Doppelt erfasst.";
    substanceNames.add(normalize(row.name));
    const amount = decimal(row.amount);
    if (Number.isNaN(amount) || (amount != null && amount > 1e9))
      errors[`substances.${index}.amount`] = "Zahl, z. B. 500 oder 0,5.";
  });

  const gtins = new Set<string>();
  const codes = new Set<string>();
  input.packages.forEach((row, index) => {
    const at = (field: string, message: string) => (errors[`packages.${index}.${field}`] = message);
    if (row.packageCode) {
      if (!/^\d{1,3}$/.test(row.packageCode)) at("packageCode", "Drei Ziffern.");
      else {
        row.packageCode = row.packageCode.padStart(3, "0");
        if (codes.has(row.packageCode)) at("packageCode", "Doppelt erfasst.");
        codes.add(row.packageCode);
      }
    }
    if (!row.gtin && row.packageCode && input.authorizationNumber && !errors.authorizationNumber)
      row.gtin = swissGtin(input.authorizationNumber, row.packageCode) ?? "";
    if (row.gtin) {
      if (!isValidGtin(row.gtin)) at("gtin", "Keine gültige GTIN (13 Ziffern, Prüfziffer).");
      else if (gtins.has(row.gtin)) at("gtin", "Doppelt erfasst.");
      gtins.add(row.gtin);
    }
    if (row.pharmacode && !/^\d{1,10}$/.test(row.pharmacode)) at("pharmacode", "Nur Ziffern.");
    const quantity = decimal(row.quantity);
    if (Number.isNaN(quantity) || (quantity != null && (quantity <= 0 || quantity > 1e7)))
      at("quantity", "Positive Zahl.");
    if (row.dispensingCategory && !"ABCDE".includes(row.dispensingCategory)) at("dispensingCategory", "A bis E.");
    for (const field of ["exFactoryPrice", "publicPrice"] as const) {
      const price = decimal(row[field]);
      if (Number.isNaN(price) || (price != null && price > 100000)) at(field, "Betrag in CHF, z. B. 12.50.");
    }
    if (!["aktiv", "ausser_handel"].includes(row.status)) at("status", "Ungültiger Status.");
    if (!row.quantity && !row.unit && !row.gtin && !row.packageCode) at("unit", "Menge oder Bezeichnung angeben.");
  });
  return { input, errors };
}

async function resolveCompany(client: PoolClient, name: string) {
  if (!name) return null;
  const row = await queryOne<{ id: string }>(
    `INSERT INTO medbase_companies (name) VALUES ($1)
     ON CONFLICT (medbase_normalize(name)) DO UPDATE SET name = medbase_companies.name RETURNING id`,
    [name],
    client,
  );
  return row!.id;
}

async function resolveSubstance(client: PoolClient, name: string) {
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM medbase_substances
     WHERE medbase_normalize(name) = medbase_normalize($1) OR medbase_normalize(latin_name) = medbase_normalize($1)
     ORDER BY (medbase_normalize(name) = medbase_normalize($1)) DESC LIMIT 1`,
    [name],
    client,
  );
  if (existing) return existing.id;
  const created = await queryOne<{ id: string }>(
    "INSERT INTO medbase_substances (name) VALUES ($1) RETURNING id",
    [name],
    client,
  );
  return created!.id;
}

async function uniqueSlug(client: PoolClient, base: string, ownId: string | null) {
  const root = slugify(base);
  for (let suffix = 1; suffix < 500; suffix += 1) {
    const slug = suffix === 1 ? root : `${root}-${suffix}`;
    const taken = await queryOne(
      "SELECT 1 FROM medbase_products WHERE slug = $1 AND id IS DISTINCT FROM $2",
      [slug, ownId],
      client,
    );
    if (!taken) return slug;
  }
  return `${root}-${Date.now()}`;
}

export class SaveError extends Error {
  constructor(
    message: string,
    public fieldErrors: FieldErrors = {},
  ) {
    super(message);
  }
}

export async function saveProduct(userId: string, id: string | null, input: ProductInput) {
  return transaction(async (client) => {
    if (id) {
      const exists = await queryOne("SELECT 1 FROM medbase_products WHERE id = $1 FOR UPDATE", [id], client);
      if (!exists) throw new SaveError("Das Arzneimittel wurde inzwischen gelöscht.");
    }
    if (input.authorizationNumber) {
      const clash = await queryOne<{ name: string }>(
        `SELECT name FROM medbase_products WHERE authorization_number = $1 AND dosage_number = $2 AND id IS DISTINCT FROM $3`,
        [input.authorizationNumber, input.dosageNumber, id],
        client,
      );
      if (clash)
        throw new SaveError("Zulassungsnummer und Dosisstärke sind bereits vergeben.", {
          authorizationNumber: `Bereits bei «${clash.name}» erfasst.`,
        });
    }
    const gtins = input.packages.map((row) => row.gtin).filter(Boolean);
    if (gtins.length) {
      const taken = await query<{ gtin: string; name: string }>(
        `SELECT pk.gtin, p.name FROM medbase_packages pk JOIN medbase_products p ON p.id = pk.product_id
         WHERE pk.gtin = ANY($1) AND pk.product_id IS DISTINCT FROM $2`,
        [gtins, id],
        client,
      );
      if (taken.length) {
        const fieldErrors: FieldErrors = {};
        input.packages.forEach((row, index) => {
          const hit = taken.find((entry) => entry.gtin === row.gtin);
          if (hit) fieldErrors[`packages.${index}.gtin`] = `GTIN gehört zu «${hit.name}».`;
        });
        throw new SaveError("Eine GTIN ist bereits einem anderen Arzneimittel zugeordnet.", fieldErrors);
      }
    }
    if (input.dosageFormId) {
      const form = await queryOne(
        "SELECT 1 FROM medbase_dosage_forms WHERE id = $1",
        [Number(input.dosageFormId)],
        client,
      );
      if (!form) throw new SaveError("Die Darreichungsform gibt es nicht mehr.", { dosageFormId: "Bitte neu wählen." });
    }
    if (input.atcCode) {
      const atc = await queryOne("SELECT 1 FROM medbase_atc WHERE code = $1", [input.atcCode], client);
      if (!atc && input.atcName)
        await query("INSERT INTO medbase_atc (code, name) VALUES ($1, $2)", [input.atcCode, input.atcName], client);
    }

    const companyId = await resolveCompany(client, input.company);
    const values = [
      input.name,
      input.descriptionLine || null,
      input.authorizationNumber || null,
      input.authorizationNumber ? input.dosageNumber : null,
      companyId,
      input.dosageFormId ? Number(input.dosageFormId) : null,
      input.atcCode || null,
      input.dispensingCategory || null,
      input.narcoticList || null,
      input.slListed,
      input.productType || null,
      input.remedyCode || null,
      input.composition || null,
      input.indication || null,
      input.notes || null,
      input.firstAuthorizedOn || null,
      input.authorizationValidUntil || null,
      input.status,
      userId,
    ];
    let productId = id;
    let slug: string;
    if (id) {
      const row = await queryOne<{ slug: string }>(
        `UPDATE medbase_products SET name = $1, description_line = $2, authorization_number = $3, dosage_number = $4,
           company_id = $5, dosage_form_id = $6, atc_code = $7, dispensing_category = $8, narcotic_list = $9,
           sl_listed = $10, product_type = $11, remedy_code = $12, composition = $13, indication = $14, notes = $15,
           first_authorized_on = $16, authorization_valid_until = $17, status = $18, updated_by = $19, updated_at = NOW(),
           source = CASE WHEN source = 'beispiel' THEN 'manuell' ELSE source END
         WHERE id = $20 RETURNING slug`,
        [...values, id],
        client,
      );
      slug = row!.slug;
    } else {
      slug = await uniqueSlug(client, `${input.name} ${input.descriptionLine}`, null);
      const row = await queryOne<{ id: string }>(
        `INSERT INTO medbase_products (name, description_line, authorization_number, dosage_number, company_id,
           dosage_form_id, atc_code, dispensing_category, narcotic_list, sl_listed, product_type, remedy_code,
           composition, indication, notes, first_authorized_on, authorization_valid_until, status, updated_by, slug, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'manuell')
         RETURNING id`,
        [...values, slug],
        client,
      );
      productId = row!.id;
    }

    // Wirkstoffe ersetzen (Reihenfolge wie erfasst).
    await query("DELETE FROM medbase_product_substances WHERE product_id = $1", [productId], client);
    for (const [index, row] of input.substances.entries()) {
      const substanceId = await resolveSubstance(client, row.name);
      await query(
        "INSERT INTO medbase_product_substances (product_id, substance_id, amount, unit, sort_order) VALUES ($1, $2, $3, $4, $5)",
        [productId, substanceId, decimal(row.amount), row.unit || null, index],
        client,
      );
    }

    // Packungen: bestehende (mit ID) ändern, neue anlegen, entfernte löschen.
    const keep = input.packages.map((row) => row.id).filter(Boolean);
    await query(
      "DELETE FROM medbase_packages WHERE product_id = $1 AND NOT (id = ANY($2::uuid[]))",
      [productId, keep],
      client,
    );
    for (const [index, row] of input.packages.entries()) {
      const packageValues = [
        row.packageCode || null,
        row.gtin || null,
        row.pharmacode || null,
        decimal(row.quantity),
        row.unit || null,
        row.dispensingCategory || null,
        decimal(row.exFactoryPrice),
        decimal(row.publicPrice),
        row.slListed,
        row.status,
        index,
      ];
      const updated = row.id
        ? await query(
            `UPDATE medbase_packages SET package_code = $1, gtin = $2, pharmacode = $3, quantity = $4, unit = $5,
               dispensing_category = $6, ex_factory_price = $7, public_price = $8, sl_listed = $9, status = $10,
               sort_order = $11, updated_at = NOW()
             WHERE id = $12 AND product_id = $13 RETURNING id`,
            [...packageValues, row.id, productId],
            client,
          )
        : [];
      if (!updated.length)
        await query(
          `INSERT INTO medbase_packages (package_code, gtin, pharmacode, quantity, unit, dispensing_category,
             ex_factory_price, public_price, sl_listed, status, sort_order, product_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [...packageValues, productId],
          client,
        );
    }
    await query("SELECT medbase_refresh_search(ARRAY[$1::uuid])", [productId], client);
    await audit(
      userId,
      id ? "geaendert" : "angelegt",
      "arzneimittel",
      productId,
      `${input.name}${input.descriptionLine ? ` ${input.descriptionLine}` : ""} ${id ? "geändert" : "angelegt"}`,
      client,
    );
    return { id: productId!, slug };
  });
}

export async function deleteProduct(userId: string, id: string) {
  const keys = await transaction(async (client) => {
    const product = await queryOne<{ name: string; description_line: string | null }>(
      "SELECT name, description_line FROM medbase_products WHERE id = $1 FOR UPDATE",
      [id],
      client,
    );
    if (!product) return null;
    const images = await query<{ storage_key: string | null; thumb_key: string | null }>(
      "DELETE FROM medbase_images WHERE product_id = $1 RETURNING storage_key, thumb_key",
      [id],
      client,
    );
    await query("DELETE FROM medbase_products WHERE id = $1", [id], client);
    await audit(
      userId,
      "geloescht",
      "arzneimittel",
      id,
      `${product.name} ${product.description_line ?? ""} gelöscht`.trim(),
      client,
    );
    return images.flatMap((image) => [image.storage_key, image.thumb_key]);
  });
  if (keys) await deleteObjects([...new Set(keys)]);
  return keys !== null;
}

// Daten für das Bearbeitungsformular.
export async function productFormData() {
  const forms = await query<{ id: number; name: string; group: string }>(
    "SELECT id, name, form_group AS group FROM medbase_dosage_forms ORDER BY sort_order, name",
  );
  return { forms };
}
