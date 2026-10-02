"use client";

import { useRef, useState } from "react";
import { CheckCircle, UploadSimple, WarningCircle } from "@phosphor-icons/react/ssr";

type Upload = { name: string; state: "laeuft" | "fertig" | "fehler"; message?: string };

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/tiff,image/gif";

// Bilder per Klick oder Ziehen hochladen (mehrere nacheinander), mit Stand je Datei.
export function UploadZone({ productId, onUploaded }: { productId: string | null; onUploaded: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);

  const upload = async (files: File[]) => {
    const images = files.filter((file) => file.size > 0);
    if (!images.length) return;
    setUploads(images.map((file) => ({ name: file.name, state: "laeuft" })));
    let changed = false;
    for (const [index, file] of images.entries()) {
      const form = new FormData();
      form.set("datei", file);
      if (productId) form.set("arzneimittel", productId);
      let result: Upload;
      try {
        const response = await fetch("/api/admin/bilder", { method: "POST", body: form });
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        result = response.ok
          ? { name: file.name, state: "fertig" }
          : { name: file.name, state: "fehler", message: data.error ?? `Fehler ${response.status}` };
        changed ||= response.ok;
      } catch {
        result = { name: file.name, state: "fehler", message: "Keine Verbindung." };
      }
      setUploads((list) => list.map((entry, position) => (position === index ? result : entry)));
    }
    if (changed) onUploaded();
  };

  return (
    <div>
      <div
        className={`dropzone ${dragging ? "dragging" : ""}`}
        role="button"
        tabIndex={0}
        aria-label="Bilder hochladen"
        onClick={() => input.current?.click()}
        onKeyDown={(event) =>
          (event.key === "Enter" || event.key === " ") && (event.preventDefault(), input.current?.click())
        }
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload([...event.dataTransfer.files]);
        }}
      >
        <UploadSimple aria-hidden="true" />
        <strong>Bilder hierher ziehen oder auswählen</strong>
        <small>JPEG, PNG, WebP, AVIF, HEIC · bis 20 MB je Bild · wird verkleinert und ohne Metadaten gespeichert</small>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(event) => {
            void upload([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
      </div>
      {uploads.length > 0 && (
        <div className="upload-progress" aria-live="polite">
          {uploads.map((entry, index) => (
            <div key={`${entry.name}-${index}`}>
              <span>{entry.name}</span>
              {entry.state === "laeuft" && (
                <span className="status-line">
                  <span className="status-dot running" /> Wird hochgeladen …
                </span>
              )}
              {entry.state === "fertig" && (
                <span className="status-line" style={{ color: "var(--success)" }}>
                  <CheckCircle width={16} height={16} /> Gespeichert
                </span>
              )}
              {entry.state === "fehler" && (
                <span className="error status-line">
                  <WarningCircle width={16} height={16} /> {entry.message}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
