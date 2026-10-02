import { randomUUID } from "node:crypto";
import { query, queryOne, type Queryable } from "./db.ts";
import { deleteObjects, putObject, storageConfigured } from "./storage.ts";

// Ablage eines Bildes mit Vorschaubild: im Bucket (Schlüssel „images/<id>/full.webp“ und „…/thumb.webp“) oder, ohne
// Bucket, in der Datenbank. Die Schlüssel enthalten keine Namen; ein ersetztes Bild bekommt eine neue Kennung, darum
// darf die Auslieferung unbegrenzt zwischengespeichert werden.

export type ProcessedImage = {
  full: Buffer;
  fullType: string;
  thumb: Buffer;
  thumbType: string;
  width: number | null;
  height: number | null;
};

const EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
};

export async function saveImage(
  image: ProcessedImage,
  meta: {
    productId: string | null;
    altText: string;
    origin: "upload" | "generiert";
    originalFilename?: string | null;
    userId?: string | null;
    primary?: boolean;
  },
  db?: Queryable,
) {
  const id = randomUUID();
  let storageKey: string | null = null;
  let thumbKey: string | null = null;
  if (storageConfigured()) {
    storageKey = `images/${id}/full.${EXTENSIONS[image.fullType] ?? "bin"}`;
    thumbKey = `images/${id}/thumb.${EXTENSIONS[image.thumbType] ?? "bin"}`;
    await putObject(storageKey, image.full, image.fullType);
    if (image.thumb !== image.full) await putObject(thumbKey, image.thumb, image.thumbType);
    else thumbKey = storageKey;
  }
  const primary =
    meta.primary ??
    (meta.productId
      ? !(await queryOne("SELECT 1 FROM medbase_images WHERE product_id = $1 AND is_primary", [meta.productId], db))
      : false);
  try {
    await query(
      `INSERT INTO medbase_images (id, product_id, storage_key, thumb_key, data, thumb_data, content_type,
         thumb_content_type, width, height, byte_size, original_filename, alt_text, origin, is_primary, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
         COALESCE((SELECT MAX(sort_order) + 1 FROM medbase_images WHERE product_id = $2), 0), $16)`,
      [
        id,
        meta.productId,
        storageKey,
        thumbKey,
        storageKey ? null : image.full,
        storageKey || image.thumb === image.full ? null : image.thumb,
        image.fullType,
        image.thumbType,
        image.width,
        image.height,
        image.full.length,
        meta.originalFilename ?? null,
        meta.altText,
        meta.origin,
        primary && !!meta.productId,
        meta.userId ?? null,
      ],
      db,
    );
  } catch (error) {
    await deleteObjects([storageKey, thumbKey === storageKey ? null : thumbKey]);
    throw error;
  }
  return id;
}
