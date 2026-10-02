import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { imageUrl, parseFilters, searchProducts } from "@/lib/catalog";

// Schnellsuche (⌘K): die besten acht Treffer; angemeldete Personen sehen auch Entwürfe und Ausser-Handel.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ hits: [], total: 0 });
  const user = await currentUser();
  const filters = parseFilters({ q, status: user ? "alle" : "" });
  const { items, total } = await searchProducts(filters, { publicOnly: !user, pageSize: 8 });
  return NextResponse.json(
    {
      total,
      hits: items.map((item) => ({
        id: item.id,
        slug: item.slug,
        name: item.name,
        line: item.descriptionLine,
        meta: [item.substances, item.company].filter(Boolean).join(" · "),
        image: imageUrl(item),
        category: item.dispensingCategory,
      })),
    },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
