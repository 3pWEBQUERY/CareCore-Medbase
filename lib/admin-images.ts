import "server-only";
import sharp, { type Metadata } from "sharp";
import { audit } from "./audit.ts";
import { query, queryOne, transaction } from "./db.ts";
import { saveImage, type ProcessedImage } from "./image-store.ts";
import { deleteObjects } from "./storage.ts";
import { cleanText } from "./text.ts";

// Hochgeladene Bilder: Format über den Inhalt prüfen (nicht über Dateiname oder Typ-Angabe des Browsers), nach EXIF
// drehen, Metadaten (Standort, Kamera) entfernen, auf höchstens 2000 px verkleinern und als WebP speichern; dazu ein
// Vorschaubild mit 640 px.

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ACCEPTED = new Set(["jpeg", "png", "webp", "avif", "heif", "tiff", "gif"]);

export class ImageError extends Error {}

export async function processUpload(buffer: Buffer): Promise<ProcessedImage> {
  if (buffer.length > MAX_UPLOAD_BYTES) throw new ImageError("Das Bild ist grösser als 20 MB.");
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer, { limitInputPixels: 80_000_000 }).metadata();
  } catch {
    throw new ImageError("Die Datei ist kein lesbares Bild.");
  }
  if (!metadata.format || !ACCEPTED.has(metadata.format))
    throw new ImageError("Erlaubt sind JPEG, PNG, WebP, AVIF, HEIC, TIFF und GIF.");
  const base = () => sharp(buffer, { limitInputPixels: 80_000_000, animated: false }).rotate();
  const full = await base()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await base()
    .resize({ width: 640, height: 480, fit: "cover", position: "attention" })
    .webp({ quality: 80 })
    .toBuffer();
  return {
    full: full.data,
    fullType: "image/webp",
    thumb,
    thumbType: "image/webp",
    width: full.info.width,
    height: full.info.height,
  };
}

export async function uploadImage(
  userId: string,
  buffer: Buffer,
  meta: { productId: string | null; filename: string | null; altText: string },
) {
  if (meta.productId) {
    const product = await queryOne("SELECT 1 FROM medbase_products WHERE id = $1", [meta.productId]);
    if (!product) throw new ImageError("Das Arzneimittel gibt es nicht mehr.");
  }
  const processed = await processUpload(buffer);
  const filename = meta.filename ? cleanText(meta.filename, 200) : null;
  const id = await saveImage(processed, {
    productId: meta.productId,
    altText: cleanText(meta.altText, 300),
    origin: "upload",
    originalFilename: filename,
    userId,
  });
  await audit(userId, "hochgeladen", "bild", id, `Bild ${filename ?? ""} hochgeladen`.replace("  ", " "));
  if (meta.productId) await touchProduct(meta.productId, userId);
  return id;
}

async function touchProduct(productId: string | null, userId: string) {
  if (productId)
    await query("UPDATE medbase_products SET updated_at = NOW(), updated_by = $2 WHERE id = $1", [productId, userId]);
}

export async function updateImage(
  userId: string,
  id: string,
  changes: { altText?: string; productId?: string | null },
) {
  return transaction(async (client) => {
    const image = await queryOne<{ product_id: string | null; is_primary: boolean }>(
      "SELECT product_id, is_primary FROM medbase_images WHERE id = $1 FOR UPDATE",
      [id],
      client,
    );
    if (!image) throw new ImageError("Das Bild gibt es nicht mehr.");
    if (changes.altText !== undefined)
      await query(
        "UPDATE medbase_images SET alt_text = $2, updated_at = NOW() WHERE id = $1",
        [id, cleanText(changes.altText, 300)],
        client,
      );
    if (changes.productId !== undefined && changes.productId !== image.product_id) {
      if (changes.productId) {
        const product = await queryOne("SELECT 1 FROM medbase_products WHERE id = $1", [changes.productId], client);
        if (!product) throw new ImageError("Das Arzneimittel gibt es nicht.");
      }
      const hasPrimary = changes.productId
        ? await queryOne(
            "SELECT 1 FROM medbase_images WHERE product_id = $1 AND is_primary",
            [changes.productId],
            client,
          )
        : null;
      await query(
        `UPDATE medbase_images SET product_id = $2, is_primary = $3, updated_at = NOW(),
           sort_order = COALESCE((SELECT MAX(sort_order) + 1 FROM medbase_images WHERE product_id = $2), 0)
         WHERE id = $1`,
        [id, changes.productId, !!changes.productId && !hasPrimary],
        client,
      );
      if (image.is_primary && image.product_id) await promoteNext(client, image.product_id);
      await touchProduct(image.product_id, userId);
    }
    await touchProduct(changes.productId ?? image.product_id, userId);
    await audit(userId, "geaendert", "bild", id, "Bildangaben geändert", client);
  });
}

async function promoteNext(client: Parameters<typeof query>[2], productId: string) {
  await query(
    `UPDATE medbase_images SET is_primary = TRUE WHERE id = (
       SELECT id FROM medbase_images WHERE product_id = $1 ORDER BY sort_order, created_at LIMIT 1
     ) AND NOT EXISTS (SELECT 1 FROM medbase_images WHERE product_id = $1 AND is_primary)`,
    [productId],
    client,
  );
}

export async function setPrimaryImage(userId: string, id: string) {
  await transaction(async (client) => {
    const image = await queryOne<{ product_id: string | null }>(
      "SELECT product_id FROM medbase_images WHERE id = $1",
      [id],
      client,
    );
    if (!image?.product_id) throw new ImageError("Nur Bilder eines Arzneimittels können Hauptbild sein.");
    await query(
      "UPDATE medbase_images SET is_primary = FALSE WHERE product_id = $1 AND is_primary",
      [image.product_id],
      client,
    );
    await query("UPDATE medbase_images SET is_primary = TRUE, updated_at = NOW() WHERE id = $1", [id], client);
    await touchProduct(image.product_id, userId);
    await audit(userId, "geaendert", "bild", id, "Als Hauptbild festgelegt", client);
  });
}

// Reihenfolge der Bilder eines Arzneimittels: mit dem Nachbarn tauschen.
export async function moveImage(userId: string, id: string, direction: "up" | "down") {
  await transaction(async (client) => {
    const image = await queryOne<{ product_id: string | null }>(
      "SELECT product_id FROM medbase_images WHERE id = $1",
      [id],
      client,
    );
    if (!image?.product_id) return;
    const list = await query<{ id: string }>(
      "SELECT id FROM medbase_images WHERE product_id = $1 ORDER BY is_primary DESC, sort_order, created_at FOR UPDATE",
      [image.product_id],
      client,
    );
    const index = list.findIndex((row) => row.id === id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    for (const [position, row] of list.entries())
      await query("UPDATE medbase_images SET sort_order = $2 WHERE id = $1", [row.id, position], client);
    // Das erste Bild ist das Hauptbild.
    await query(
      "UPDATE medbase_images SET is_primary = (id = $2) WHERE product_id = $1",
      [image.product_id, list[0].id],
      client,
    );
    await touchProduct(image.product_id, userId);
  });
}

export async function deleteImage(userId: string, id: string) {
  const keys = await transaction(async (client) => {
    const image = await queryOne<{
      product_id: string | null;
      is_primary: boolean;
      storage_key: string | null;
      thumb_key: string | null;
    }>(
      "DELETE FROM medbase_images WHERE id = $1 RETURNING product_id, is_primary, storage_key, thumb_key",
      [id],
      client,
    );
    if (!image) return [];
    if (image.is_primary && image.product_id) await promoteNext(client, image.product_id);
    await touchProduct(image.product_id, userId);
    await audit(userId, "geloescht", "bild", id, "Bild gelöscht", client);
    return [image.storage_key, image.thumb_key];
  });
  await deleteObjects([...new Set(keys)]);
}

export type MediaFilter = { q: string; filter: string; page: number };

export async function mediaLibrary({ q, filter, page }: MediaFilter) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`);
    where.push(
      `(p.search_document LIKE medbase_normalize($${params.length}) OR medbase_normalize(i.original_filename) LIKE medbase_normalize($${params.length}) OR medbase_normalize(i.alt_text) LIKE medbase_normalize($${params.length}))`,
    );
  }
  if (filter === "ohne-arzneimittel") where.push("i.product_id IS NULL");
  if (filter === "hochgeladen") where.push("i.origin = 'upload'");
  if (filter === "symbolbilder") where.push("i.origin = 'generiert'");
  if (filter === "ohne-alternativtext") where.push("i.alt_text = ''");
  const pageSize = 36;
  params.push(pageSize, (page - 1) * pageSize);
  const rows = await query<{
    id: string;
    productId: string | null;
    productName: string | null;
    productLine: string | null;
    altText: string;
    contentType: string;
    width: number | null;
    height: number | null;
    byteSize: number;
    origin: string;
    isPrimary: boolean;
    originalFilename: string | null;
    createdAt: string;
    createdBy: string | null;
    total: number;
  }>(
    `SELECT i.id, i.product_id AS "productId", p.name AS "productName", p.description_line AS "productLine",
       i.alt_text AS "altText", i.content_type AS "contentType", i.width, i.height, i.byte_size AS "byteSize",
       i.origin, i.is_primary AS "isPrimary", i.original_filename AS "originalFilename", i.created_at AS "createdAt",
       u.display_name AS "createdBy", COUNT(*) OVER ()::int AS total
     FROM medbase_images i
     LEFT JOIN medbase_products p ON p.id = i.product_id
     LEFT JOIN medbase_users u ON u.id = i.created_by
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY i.created_at DESC, i.id
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const stats = await queryOne<{
    total: number;
    uploads: number;
    generated: number;
    unassigned: number;
    bytes: number;
  }>(
    `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE origin = 'upload')::int AS uploads,
       COUNT(*) FILTER (WHERE origin = 'generiert')::int AS generated,
       COUNT(*) FILTER (WHERE product_id IS NULL)::int AS unassigned, COALESCE(SUM(byte_size), 0)::bigint AS bytes
     FROM medbase_images`,
  );
  return { rows, total: rows[0]?.total ?? 0, pageSize, stats: stats! };
}
