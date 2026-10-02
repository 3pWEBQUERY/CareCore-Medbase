"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudArrowDown, FileXls, Trash, UploadSimple } from "@phosphor-icons/react/ssr";
import { removeExamplesAction } from "@/app/actions/examples";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast";

// Import starten (Download oder Datei) und, solange einer läuft, den Stand alle 3 Sekunden neu laden.
export function ImportPanel({ defaultUrl, running }: { defaultUrl: string; running: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [url, setUrl] = useState(defaultUrl);
  const [withdraw, setWithdraw] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => router.refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [running, router]);

  const start = async (withFile: boolean) => {
    const form = new FormData();
    if (withFile) {
      const chosen = file.current?.files?.[0];
      if (!chosen) {
        toast("Bitte zuerst die Excel-Datei wählen.", "error");
        return;
      }
      form.set("datei", chosen);
    } else form.set("adresse", url);
    if (withdraw) form.set("ausserHandel", "1");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/import", { method: "POST", body: form });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) toast(data.error ?? `Fehler ${response.status}`, "error");
      else {
        toast("Import gestartet");
        router.refresh();
      }
    } catch {
      toast("Keine Verbindung zum Server.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="split-cards">
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Von Swissmedic laden</h2>
            <p>Lädt die aktuelle Liste «Zugelassene Packungen» direkt von swissmedic.ch.</p>
          </div>
          <CloudArrowDown width={22} height={22} color="var(--brand)" />
        </div>
        <div className="card-body">
          <div className="field">
            <label htmlFor="import-url">Adresse der Excel-Datei</label>
            <input id="import-url" className="input" value={url} onChange={(event) => setUrl(event.target.value)} />
            <p className="field-hint">
              Ändert Swissmedic die Adresse, hier die neue eintragen (Swissmedic › Listen und Verzeichnisse).
            </p>
          </div>
          <button
            type="button"
            className="primary-button"
            disabled={busy || running}
            onClick={() => start(false)}
            style={{ justifySelf: "start" }}
          >
            <CloudArrowDown /> Jetzt laden und importieren
          </button>
        </div>
      </section>
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Datei hochladen</h2>
            <p>Die von swissmedic.ch heruntergeladene Datei (.xlsx, bis 80 MB).</p>
          </div>
          <FileXls width={22} height={22} color="var(--success)" />
        </div>
        <div className="card-body">
          <div
            className="dropzone"
            role="button"
            tabIndex={0}
            onClick={() => file.current?.click()}
            onKeyDown={(event) => event.key === "Enter" && file.current?.click()}
          >
            <UploadSimple />
            <strong>{fileName || "Excel-Datei auswählen"}</strong>
            <small>zugelassene_packungen_ham.xlsx</small>
            <input
              ref={file}
              type="file"
              hidden
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
            />
          </div>
          <button
            type="button"
            className="secondary-button"
            disabled={busy || running || !fileName}
            onClick={() => start(true)}
            style={{ justifySelf: "start" }}
          >
            <UploadSimple /> Datei importieren
          </button>
        </div>
      </section>
      <label className="checkbox" style={{ gridColumn: "1 / -1" }}>
        <input type="checkbox" checked={withdraw} onChange={(event) => setWithdraw(event.target.checked)} />
        Arzneimittel und Packungen aus früheren Importen, die nicht mehr in der Liste stehen, auf «Ausser Handel» setzen
      </label>
    </div>
  );
}

export function RemoveExamples({ count }: { count: number }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button type="button" className="danger-button" onClick={() => setConfirm(true)} disabled={pending}>
        <Trash /> {count} Beispielarzneimittel entfernen
      </button>
      {confirm && (
        <ConfirmDialog
          title="Beispieldaten entfernen?"
          text="Alle unveränderten Beispielarzneimittel werden mit ihren Packungen und Bildern gelöscht. Von Hand bearbeitete Beispiele bleiben erhalten."
          confirmLabel="Entfernen"
          pending={pending}
          onCancel={() => setConfirm(false)}
          onConfirm={() =>
            startTransition(async () => {
              const result = await removeExamplesAction();
              setConfirm(false);
              if (result.ok) {
                toast(result.message ?? "Entfernt");
                router.refresh();
              } else toast(result.error, "error");
            })
          }
        />
      )}
    </>
  );
}
