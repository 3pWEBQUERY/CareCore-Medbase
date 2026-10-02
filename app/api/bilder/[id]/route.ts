import { queryOne } from "@/lib/db";
import { getObject } from "@/lib/storage";

// Liefert ein Bild aus dem Bucket (oder der Datenbank). Bilder ändern sich nie unter derselben Kennung, darum
// dürfen Browser und Zwischenspeicher sie unbegrenzt behalten. SVG (nur selbst erzeugte Symbolbilder) wird ohne
// Skripte ausgeliefert.
export async function GET(request: Request, { params }: RouteContext<"/api/bilder/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Nicht gefunden", { status: 404 });
  const small = new URL(request.url).searchParams.get("groesse") === "klein";
  const etag = `"${id}${small ? "-k" : ""}"`;
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304 });

  const row = await queryOne<{
    key: string | null;
    data: Buffer | null;
    content_type: string;
    original_filename: string | null;
  }>(
    small
      ? `SELECT thumb_key AS key, COALESCE(thumb_data, data) AS data, thumb_content_type AS content_type, original_filename
         FROM medbase_images WHERE id = $1`
      : "SELECT storage_key AS key, data, content_type, original_filename FROM medbase_images WHERE id = $1",
    [id],
  );
  if (!row) return new Response("Nicht gefunden", { status: 404 });
  const body = row.key ? await getObject(row.key) : row.data;
  if (!body) return new Response("Nicht gefunden", { status: 404 });

  const headers = new Headers({
    "Content-Type": row.content_type,
    "Content-Length": String(body.length),
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
  });
  if (new URL(request.url).searchParams.get("download") === "1") {
    const name = (row.original_filename ?? `bild-${id}`).replace(/[^\w.\- ]+/g, "_");
    headers.set("Content-Disposition", `attachment; filename="${name}"`);
  }
  return new Response(new Uint8Array(body), { headers });
}
