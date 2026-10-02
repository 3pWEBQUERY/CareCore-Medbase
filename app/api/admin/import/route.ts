import { after, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { actionUser, AuthError } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { DEFAULT_SWISSMEDIC_URL, downloadList, runImport, startRun } from "@/lib/swissmedic-import";

// Startet einen Swissmedic-Import im Hintergrund: aus einer hochgeladenen Excel-Datei oder von der Swissmedic-Adresse.
export const maxDuration = 900;

export async function POST(request: Request) {
  try {
    const user = await actionUser("admin");
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== request.headers.get("host"))
      return NextResponse.json({ error: "Ungültige Herkunft der Anfrage." }, { status: 403 });
    const form = await request.formData();
    const withdrawMissing = form.get("ausserHandel") === "1";
    const file = form.get("datei");
    let load: () => Promise<Buffer>;
    let source: string;
    let fileName: string | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > 80 * 1024 * 1024)
        return NextResponse.json({ error: "Die Datei ist grösser als 80 MB." }, { status: 413 });
      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.subarray(0, 2).toString() !== "PK")
        return NextResponse.json({ error: "Bitte die Excel-Datei (.xlsx) der Swissmedic hochladen." }, { status: 422 });
      load = async () => buffer;
      source = "datei";
      fileName = file.name.slice(0, 200);
    } else {
      const url =
        String(form.get("adresse") ?? "").trim() || process.env.SWISSMEDIC_PACKAGES_URL || DEFAULT_SWISSMEDIC_URL;
      try {
        if (new URL(url).protocol !== "https:") throw new Error();
      } catch {
        return NextResponse.json({ error: "Bitte eine https-Adresse angeben." }, { status: 422 });
      }
      load = () => downloadList(url);
      source = "swissmedic";
      fileName = url.slice(0, 500);
    }
    const run = await startRun(source, fileName, user.id);
    if (!run) return NextResponse.json({ error: "Es läuft bereits ein Import." }, { status: 409 });
    await audit(
      user.id,
      "import",
      "import",
      run.id,
      `Swissmedic-Import gestartet (${source === "datei" ? fileName : "Download"})`,
    );
    after(async () => {
      await runImport(run.id, load, { withdrawMissing });
      revalidatePath("/", "layout");
    });
    return NextResponse.json({ id: run.id }, { status: 202 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("Import start failed", error);
    return NextResponse.json({ error: "Der Import konnte nicht gestartet werden." }, { status: 500 });
  }
}
