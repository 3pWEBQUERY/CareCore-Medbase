import "server-only";
import { audit } from "./audit.ts";
import { query, queryOne, transaction } from "./db.ts";
import { isIllustration } from "./packshot.ts";
import { FORM_GROUPS } from "./reference-data.ts";
import { cleanText, normalize } from "./text.ts";

// Stammdaten der Verwaltung: Darreichungsformen, Wirkstoffe, Zulassungsinhaberinnen und ATC-Codes.

export type MasterKind = "form" | "substance" | "company" | "atc";
export class MasterError extends Error {
  constructor(
    message: string,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

const like = (value: string) => `%${normalize(value).replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
const PAGE = 50;

export async function listForms() {
  return query<{
    id: number;
    name: string;
    group: string;
    illustration: string;
    keywords: string[];
    sortOrder: number;
    count: number;
  }>(
    `SELECT f.id, f.name, f.form_group AS group, f.illustration, f.keywords, f.sort_order AS "sortOrder",
       (SELECT COUNT(*)::int FROM medbase_products p WHERE p.dosage_form_id = f.id) AS count
     FROM medbase_dosage_forms f ORDER BY f.sort_order, f.name`,
  );
}

export async function listSubstances(q: string, page: number) {
  const rows = await query<{ id: string; name: string; latinName: string | null; count: number; total: number }>(
    `SELECT s.id, s.name, s.latin_name AS "latinName",
       (SELECT COUNT(*)::int FROM medbase_product_substances ps WHERE ps.substance_id = s.id) AS count,
       COUNT(*) OVER ()::int AS total
     FROM medbase_substances s
     WHERE $1 = '' OR medbase_normalize(s.name) LIKE $2 OR medbase_normalize(s.latin_name) LIKE $2
     ORDER BY medbase_normalize(s.name) LIMIT $3 OFFSET $4`,
    [q, like(q), PAGE, (page - 1) * PAGE],
  );
  return { rows, total: rows[0]?.total ?? 0, pageSize: PAGE };
}

export async function listCompanies(q: string, page: number) {
  const rows = await query<{ id: string; name: string; website: string | null; count: number; total: number }>(
    `SELECT c.id, c.name, c.website,
       (SELECT COUNT(*)::int FROM medbase_products p WHERE p.company_id = c.id) AS count,
       COUNT(*) OVER ()::int AS total
     FROM medbase_companies c
     WHERE $1 = '' OR medbase_normalize(c.name) LIKE $2
     ORDER BY medbase_normalize(c.name) LIMIT $3 OFFSET $4`,
    [q, like(q), PAGE, (page - 1) * PAGE],
  );
  return { rows, total: rows[0]?.total ?? 0, pageSize: PAGE };
}

export async function listAtc(q: string, page: number) {
  const rows = await query<{ id: string; code: string; name: string; level: number; count: number; total: number }>(
    `SELECT a.code AS id, a.code, a.name, a.level,
       (SELECT COUNT(*)::int FROM medbase_products p WHERE p.atc_code = a.code) AS count,
       COUNT(*) OVER ()::int AS total
     FROM medbase_atc a
     WHERE $1 = '' OR lower(a.code) LIKE lower($1) || '%' OR medbase_normalize(a.name) LIKE $2
     ORDER BY a.code LIMIT $3 OFFSET $4`,
    [q, like(q), PAGE, (page - 1) * PAGE],
  );
  return { rows, total: rows[0]?.total ?? 0, pageSize: PAGE };
}

// Nach Umbenennungen das Suchdokument der betroffenen Arzneimittel neu aufbauen.
async function refresh(client: Parameters<typeof query>[2], sql: string, params: unknown[]) {
  await query(`SELECT medbase_refresh_search(ARRAY(${sql}))`, params, client);
}

export async function saveMaster(userId: string, kind: MasterKind, id: string | null, raw: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  const name = cleanText(raw.name, 200);
  if (!name) errors.name = "Bezeichnung angeben.";

  return transaction(async (client) => {
    if (kind === "form") {
      const group = cleanText(raw.group, 30);
      const illustration = cleanText(raw.illustration, 30);
      const sortOrder = Number.parseInt(cleanText(raw.sortOrder, 6) || "100", 10);
      const keywords = cleanText(raw.keywords, 1000)
        .split(",")
        .map((word) => normalize(word.trim()))
        .filter(Boolean)
        .slice(0, 30);
      if (!FORM_GROUPS.some((entry) => entry.value === group)) errors.group = "Gruppe wählen.";
      if (!isIllustration(illustration)) errors.illustration = "Abbildung wählen.";
      if (!Number.isFinite(sortOrder) || sortOrder < 0 || sortOrder > 99999) errors.sortOrder = "Zahl von 0 bis 99999.";
      if (Object.keys(errors).length) throw new MasterError("Bitte die markierten Felder prüfen.", errors);
      const clash = await queryOne(
        "SELECT 1 FROM medbase_dosage_forms WHERE lower(name) = lower($1) AND id IS DISTINCT FROM $2",
        [name, id ? Number(id) : null],
        client,
      );
      if (clash) throw new MasterError("Diese Darreichungsform gibt es bereits.", { name: "Bereits vorhanden." });
      const row = id
        ? await queryOne<{ id: number }>(
            `UPDATE medbase_dosage_forms SET name = $2, form_group = $3, illustration = $4, keywords = $5, sort_order = $6
             WHERE id = $1 RETURNING id`,
            [Number(id), name, group, illustration, keywords, sortOrder],
            client,
          )
        : await queryOne<{ id: number }>(
            `INSERT INTO medbase_dosage_forms (name, form_group, illustration, keywords, sort_order)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [name, group, illustration, keywords, sortOrder],
            client,
          );
      if (!row) throw new MasterError("Die Darreichungsform gibt es nicht mehr.");
      if (id) {
        await refresh(client, "SELECT id FROM medbase_products WHERE dosage_form_id = $1", [row.id]);
        await query("UPDATE medbase_products SET updated_at = NOW() WHERE dosage_form_id = $1", [row.id], client);
      }
      await audit(
        userId,
        id ? "geaendert" : "angelegt",
        "darreichungsform",
        String(row.id),
        `Darreichungsform «${name}» ${id ? "geändert" : "angelegt"}`,
        client,
      );
      return;
    }

    if (kind === "substance") {
      const latin = cleanText(raw.latinName, 200) || null;
      if (Object.keys(errors).length) throw new MasterError("Bitte die markierten Felder prüfen.", errors);
      const clash = await queryOne(
        `SELECT 1 FROM medbase_substances WHERE (medbase_normalize(name) = medbase_normalize($1)
           OR ($2::text IS NOT NULL AND medbase_normalize(latin_name) = medbase_normalize($2))) AND id IS DISTINCT FROM $3`,
        [name, latin, id],
        client,
      );
      if (clash)
        throw new MasterError("Ein Wirkstoff mit diesem Namen existiert bereits – stattdessen zusammenführen.", {
          name: "Bereits vorhanden.",
        });
      const row = id
        ? await queryOne<{ id: string }>(
            "UPDATE medbase_substances SET name = $2, latin_name = $3 WHERE id = $1 RETURNING id",
            [id, name, latin],
            client,
          )
        : await queryOne<{ id: string }>(
            "INSERT INTO medbase_substances (name, latin_name) VALUES ($1, $2) RETURNING id",
            [name, latin],
            client,
          );
      if (!row) throw new MasterError("Den Wirkstoff gibt es nicht mehr.");
      if (id)
        await refresh(client, "SELECT product_id FROM medbase_product_substances WHERE substance_id = $1", [row.id]);
      await audit(
        userId,
        id ? "geaendert" : "angelegt",
        "wirkstoff",
        row.id,
        `Wirkstoff «${name}» ${id ? "geändert" : "angelegt"}`,
        client,
      );
      return;
    }

    if (kind === "company") {
      const website = cleanText(raw.website, 300) || null;
      if (website && !/^https:\/\/[^\s]+\.[^\s]+$/.test(website)) errors.website = "Adresse mit https://";
      if (Object.keys(errors).length) throw new MasterError("Bitte die markierten Felder prüfen.", errors);
      const clash = await queryOne(
        "SELECT 1 FROM medbase_companies WHERE medbase_normalize(name) = medbase_normalize($1) AND id IS DISTINCT FROM $2",
        [name, id],
        client,
      );
      if (clash)
        throw new MasterError("Diese Firma gibt es bereits – stattdessen zusammenführen.", {
          name: "Bereits vorhanden.",
        });
      const row = id
        ? await queryOne<{ id: string }>(
            "UPDATE medbase_companies SET name = $2, website = $3 WHERE id = $1 RETURNING id",
            [id, name, website],
            client,
          )
        : await queryOne<{ id: string }>(
            "INSERT INTO medbase_companies (name, website) VALUES ($1, $2) RETURNING id",
            [name, website],
            client,
          );
      if (!row) throw new MasterError("Die Firma gibt es nicht mehr.");
      if (id) await refresh(client, "SELECT id FROM medbase_products WHERE company_id = $1", [row.id]);
      await audit(
        userId,
        id ? "geaendert" : "angelegt",
        "firma",
        row.id,
        `Firma «${name}» ${id ? "geändert" : "angelegt"}`,
        client,
      );
      return;
    }

    // ATC: der Code ist der Schlüssel und bleibt beim Ändern gleich.
    const code = id ?? cleanText(raw.code, 10).toUpperCase().replace(/\s/g, "");
    if (!/^[A-Z](\d{2}([A-Z]([A-Z](\d{2})?)?)?)?$/.test(code)) errors.code = "Format A, A01, A01A, A01AA oder A01AA01.";
    if (Object.keys(errors).length) throw new MasterError("Bitte die markierten Felder prüfen.", errors);
    if (id) {
      const row = await queryOne(
        "UPDATE medbase_atc SET name = $2 WHERE code = $1 RETURNING code",
        [code, name],
        client,
      );
      if (!row) throw new MasterError("Den ATC-Code gibt es nicht mehr.");
      await refresh(client, "SELECT id FROM medbase_products WHERE atc_code = $1", [code]);
    } else {
      const exists = await queryOne("SELECT 1 FROM medbase_atc WHERE code = $1", [code], client);
      if (exists) throw new MasterError("Diesen ATC-Code gibt es bereits.", { code: "Bereits vorhanden." });
      await query("INSERT INTO medbase_atc (code, name) VALUES ($1, $2)", [code, name], client);
      await refresh(client, "SELECT id FROM medbase_products WHERE atc_code = $1", [code]);
    }
    await audit(
      userId,
      id ? "geaendert" : "angelegt",
      "atc",
      code,
      `ATC-Code ${code} «${name}» ${id ? "geändert" : "angelegt"}`,
      client,
    );
  });
}

export async function deleteMaster(userId: string, kind: MasterKind, id: string) {
  await transaction(async (client) => {
    const usage =
      kind === "form"
        ? await queryOne<{ count: number; name: string }>(
            "SELECT name, (SELECT COUNT(*)::int FROM medbase_products WHERE dosage_form_id = f.id) AS count FROM medbase_dosage_forms f WHERE id = $1",
            [Number(id)],
            client,
          )
        : kind === "substance"
          ? await queryOne<{ count: number; name: string }>(
              "SELECT name, (SELECT COUNT(*)::int FROM medbase_product_substances WHERE substance_id = s.id) AS count FROM medbase_substances s WHERE id = $1",
              [id],
              client,
            )
          : kind === "company"
            ? await queryOne<{ count: number; name: string }>(
                "SELECT name, (SELECT COUNT(*)::int FROM medbase_products WHERE company_id = c.id) AS count FROM medbase_companies c WHERE id = $1",
                [id],
                client,
              )
            : await queryOne<{ count: number; name: string }>(
                "SELECT name, (SELECT COUNT(*)::int FROM medbase_products WHERE atc_code = a.code) AS count FROM medbase_atc a WHERE code = $1",
                [id],
                client,
              );
    if (!usage) throw new MasterError("Der Eintrag ist bereits gelöscht.");
    if (usage.count > 0)
      throw new MasterError(
        `«${usage.name}» wird von ${usage.count} Arzneimittel(n) verwendet und kann nicht gelöscht werden.`,
      );
    const table = {
      form: "medbase_dosage_forms",
      substance: "medbase_substances",
      company: "medbase_companies",
      atc: "medbase_atc",
    }[kind];
    const key = kind === "atc" ? "code" : "id";
    await query(`DELETE FROM ${table} WHERE ${key} = $1`, [kind === "form" ? Number(id) : id], client);
    await audit(userId, "geloescht", kind, id, `«${usage.name}» gelöscht`, client);
  });
}

// Doppelte Wirkstoffe oder Firmen zusammenführen: alle Verweise auf das Ziel umhängen, Quelle löschen.
export async function mergeMaster(userId: string, kind: "substance" | "company", sourceId: string, targetName: string) {
  await transaction(async (client) => {
    const table = kind === "substance" ? "medbase_substances" : "medbase_companies";
    const source = await queryOne<{ name: string }>(
      `SELECT name FROM ${table} WHERE id = $1 FOR UPDATE`,
      [sourceId],
      client,
    );
    const target = await queryOne<{ id: string; name: string }>(
      `SELECT id, name FROM ${table} WHERE medbase_normalize(name) = medbase_normalize($1) LIMIT 1`,
      [cleanText(targetName, 200)],
      client,
    );
    if (!source) throw new MasterError("Der Eintrag ist bereits gelöscht.");
    if (!target) throw new MasterError("Das Ziel wurde nicht gefunden. Bitte einen Vorschlag aus der Liste wählen.");
    if (target.id === sourceId) throw new MasterError("Quelle und Ziel sind derselbe Eintrag.");
    if (kind === "substance") {
      const affected = await query<{ product_id: string }>(
        "SELECT product_id FROM medbase_product_substances WHERE substance_id = $1",
        [sourceId],
        client,
      );
      await query(
        `INSERT INTO medbase_product_substances (product_id, substance_id, amount, unit, sort_order)
         SELECT product_id, $2, amount, unit, sort_order FROM medbase_product_substances WHERE substance_id = $1
         ON CONFLICT (product_id, substance_id) DO NOTHING`,
        [sourceId, target.id],
        client,
      );
      await query("DELETE FROM medbase_product_substances WHERE substance_id = $1", [sourceId], client);
      // Lateinischen Namen übernehmen, falls das Ziel keinen hat (erst nach dem Löschen der Quelle: eindeutiger Index).
      const removed = await queryOne<{ latin_name: string | null }>(
        "DELETE FROM medbase_substances WHERE id = $1 RETURNING latin_name",
        [sourceId],
        client,
      );
      if (removed?.latin_name)
        await query(
          "UPDATE medbase_substances SET latin_name = COALESCE(latin_name, $2) WHERE id = $1",
          [target.id, removed.latin_name],
          client,
        );
      await query("SELECT medbase_refresh_search($1::uuid[])", [affected.map((row) => row.product_id)], client);
    } else {
      const affected = await query<{ id: string }>(
        "UPDATE medbase_products SET company_id = $2 WHERE company_id = $1 RETURNING id",
        [sourceId, target.id],
        client,
      );
      await query("DELETE FROM medbase_companies WHERE id = $1", [sourceId], client);
      await query("SELECT medbase_refresh_search($1::uuid[])", [affected.map((row) => row.id)], client);
    }
    await audit(
      userId,
      "zusammengefuehrt",
      kind,
      target.id,
      `«${source.name}» mit «${target.name}» zusammengeführt`,
      client,
    );
  });
}
