import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalize } from "@/lib/text";

// Vorschläge für Eingabefelder der Verwaltung: Firmen, Wirkstoffe, ATC-Codes, Arzneimittel.
export async function GET(request: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  const url = new URL(request.url);
  const kind = url.searchParams.get("typ");
  const q = normalize(url.searchParams.get("q") ?? "")
    .trim()
    .slice(0, 80);
  if (!q) return NextResponse.json({ items: [] });
  const like = `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  const prefix = `${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  let items: { value: string; label: string; hint?: string | null }[] = [];
  if (kind === "firma")
    items = await query(
      `SELECT name AS value, name AS label FROM medbase_companies WHERE medbase_normalize(name) LIKE $1
       ORDER BY (medbase_normalize(name) LIKE $2) DESC, name LIMIT 10`,
      [like, prefix],
    );
  else if (kind === "wirkstoff")
    items = await query(
      `SELECT name AS value, name AS label, latin_name AS hint FROM medbase_substances
       WHERE medbase_normalize(name) LIKE $1 OR medbase_normalize(latin_name) LIKE $1
       ORDER BY (medbase_normalize(name) LIKE $2) DESC, name LIMIT 10`,
      [like, prefix],
    );
  else if (kind === "atc")
    items = await query(
      `SELECT code AS value, code || ' – ' || name AS label FROM medbase_atc
       WHERE lower(code) LIKE $2 OR medbase_normalize(name) LIKE $1
       ORDER BY (lower(code) LIKE $2) DESC, code LIMIT 10`,
      [like, prefix],
    );
  else if (kind === "arzneimittel")
    items = await query(
      `SELECT id::text AS value, name || COALESCE(' ' || description_line, '') AS label, authorization_number AS hint
       FROM medbase_products WHERE search_document LIKE $1
       ORDER BY (medbase_normalize(name) LIKE $2) DESC, name, description_line LIMIT 10`,
      [like, prefix],
    );
  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
}
