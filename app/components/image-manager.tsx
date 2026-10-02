"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, DownloadSimple, Star, Trash } from "@phosphor-icons/react/ssr";
import { deleteImageAction, moveImageAction, setPrimaryImageAction, updateImageAction } from "@/app/actions/images";
import type { ActionResult } from "@/app/actions/result";
import type { ProductImage } from "@/lib/catalog";
import { formatBytes } from "@/lib/text";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast";
import { UploadZone } from "./upload-zone";

// Bilder eines Arzneimittels: hochladen, Hauptbild, Reihenfolge, Alternativtext, löschen.
export function ImageManager({
  productId,
  productName,
  images,
}: {
  productId: string;
  productName: string;
  images: ProductImage[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<ProductImage | null>(null);
  const [altTexts, setAltTexts] = useState<Record<string, string>>({});

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast(result.message ?? "Gespeichert");
        router.refresh();
      } else toast(result.error, "error");
    });

  return (
    <section className="card" id="bilder">
      <div className="card-head">
        <div>
          <h2>Bilder</h2>
          <p>
            Das erste Bild ist das Hauptbild im Katalog. Ohne Bild zeigt Medbase ein Symbolbild der Darreichungsform.
          </p>
        </div>
        <span className="badge">{images.length === 1 ? "1 Bild" : `${images.length} Bilder`}</span>
      </div>
      <div className="card-body" style={{ display: "grid", gap: 18 }}>
        <UploadZone productId={productId} onUploaded={() => router.refresh()} />
        {images.length > 0 && (
          <div className="image-grid">
            {images.map((image, index) => {
              const alt = altTexts[image.id] ?? image.altText;
              return (
                <div key={image.id} className={`image-tile ${image.isPrimary ? "primary" : ""}`}>
                  <a
                    className="image-tile-media"
                    href={`/api/bilder/${image.id}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Bild in voller Grösse öffnen"
                  >
                    <Image
                      src={`/api/bilder/${image.id}?groesse=klein`}
                      alt={image.altText}
                      width={320}
                      height={240}
                      unoptimized
                    />
                    {image.isPrimary ? (
                      <span className="badge badge-brand">
                        <Star weight="fill" /> Hauptbild
                      </span>
                    ) : image.origin === "generiert" ? (
                      <span className="badge">Symbolbild</span>
                    ) : null}
                  </a>
                  <div className="image-tile-body">
                    <small>
                      {image.width && image.height ? `${image.width} × ${image.height} px · ` : ""}
                      {formatBytes(image.byteSize)} ·{" "}
                      {image.contentType.replace("image/", "").replace("+xml", "").toUpperCase()}
                    </small>
                    <input
                      className="input"
                      style={{ minHeight: 34, fontSize: 12 }}
                      value={alt}
                      placeholder="Alternativtext (Bildbeschreibung)"
                      aria-label="Alternativtext"
                      maxLength={300}
                      onChange={(event) => setAltTexts((current) => ({ ...current, [image.id]: event.target.value }))}
                      onBlur={() => {
                        if (alt !== image.altText) run(() => updateImageAction(image.id, { altText: alt }));
                      }}
                    />
                  </div>
                  <div className="image-tile-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Als Hauptbild festlegen"
                      title="Als Hauptbild festlegen"
                      disabled={pending || image.isPrimary}
                      onClick={() => run(() => setPrimaryImageAction(image.id))}
                    >
                      <Star />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Nach vorne"
                      title="Nach vorne"
                      disabled={pending || index === 0}
                      onClick={() => run(() => moveImageAction(image.id, "up"))}
                    >
                      <ArrowLeft />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Nach hinten"
                      title="Nach hinten"
                      disabled={pending || index === images.length - 1}
                      onClick={() => run(() => moveImageAction(image.id, "down"))}
                    >
                      <ArrowRight />
                    </button>
                    <a
                      className="icon-button"
                      href={`/api/bilder/${image.id}?download=1`}
                      aria-label="Herunterladen"
                      title="Herunterladen"
                    >
                      <DownloadSimple />
                    </a>
                    <button
                      type="button"
                      className="icon-button danger"
                      aria-label="Bild löschen"
                      title="Bild löschen"
                      disabled={pending}
                      onClick={() => setDeleting(image)}
                      style={{ marginLeft: "auto" }}
                    >
                      <Trash />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {deleting && (
        <ConfirmDialog
          title="Bild löschen?"
          text={`Das Bild von «${productName}» wird endgültig aus dem Speicher entfernt.`}
          pending={pending}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const id = deleting.id;
            setDeleting(null);
            run(() => deleteImageAction(id));
          }}
        />
      )}
    </section>
  );
}
