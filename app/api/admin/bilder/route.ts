import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { actionUser, AuthError } from "@/lib/auth";
import { ImageError, MAX_UPLOAD_BYTES, uploadImage } from "@/lib/admin-images";

// Hochladen eines Bildes (multipart/form-data: datei, arzneimittel?, alternativtext?).
export async function POST(request: Request) {
  try {
    const user = await actionUser();
    // Schutz vor Anfragen fremder Seiten (Cookies werden mitgeschickt): nur von Medbase selbst.
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== request.headers.get("host"))
      return NextResponse.json({ error: "Ungültige Herkunft der Anfrage." }, { status: 403 });
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_UPLOAD_BYTES + 1024 * 1024)
      return NextResponse.json({ error: "Das Bild ist grösser als 20 MB." }, { status: 413 });
    const form = await request.formData();
    const file = form.get("datei");
    if (!(file instanceof File) || file.size === 0)
      return NextResponse.json({ error: "Keine Datei erhalten." }, { status: 400 });
    const productId = String(form.get("arzneimittel") ?? "") || null;
    if (productId && !/^[0-9a-f-]{36}$/.test(productId))
      return NextResponse.json({ error: "Ungültiges Arzneimittel." }, { status: 400 });
    const id = await uploadImage(user.id, Buffer.from(await file.arrayBuffer()), {
      productId,
      filename: file.name,
      altText: String(form.get("alternativtext") ?? ""),
    });
    revalidatePath("/", "layout");
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof ImageError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error("Image upload failed", error);
    return NextResponse.json({ error: "Das Hochladen ist fehlgeschlagen." }, { status: 500 });
  }
}
