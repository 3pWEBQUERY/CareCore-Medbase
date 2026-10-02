"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowSquareOut, DownloadSimple, FloppyDisk, Star, Trash, X } from "@phosphor-icons/react/ssr";
import { deleteImageAction, setPrimaryImageAction, updateImageAction } from "@/app/actions/images";
import type { ActionResult } from "@/app/actions/result";
import { formatBytes, formatDateTime } from "@/lib/text";
import { Combobox } from "./combobox";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast";

export type MediaItem = {
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
};

// Raster aller Bilder; ein Klick öffnet das Seitenpanel zum Bearbeiten.
export function MediaGrid({ items }: { items: MediaItem[] }) {
  const [open, setOpen] = useState<MediaItem | null>(null);
  return (
    <>
      <div className="image-grid">
        {items.map((item) => (
          <div key={item.id} className={`image-tile ${item.isPrimary ? "primary" : ""}`}>
            <button
              type="button"
              className="image-tile-media"
              onClick={() => setOpen(item)}
              aria-label={`Bild bearbeiten: ${item.productName ?? item.originalFilename ?? "ohne Arzneimittel"}`}
            >
              <Image
                src={`/api/bilder/${item.id}?groesse=klein`}
                alt={item.altText}
                width={320}
                height={240}
                unoptimized
              />
              {item.origin === "generiert" ? (
                <span className="badge">Symbolbild</span>
              ) : item.isPrimary ? (
                <span className="badge badge-brand">Hauptbild</span>
              ) : null}
            </button>
            <div className="image-tile-body">
              <strong>
                {item.productName ? `${item.productName} ${item.productLine ?? ""}` : "Ohne Arzneimittel"}
              </strong>
              <small>
                {item.originalFilename ?? (item.origin === "generiert" ? "Erzeugt" : "Bild")} ·{" "}
                {formatBytes(item.byteSize)}
              </small>
            </div>
          </div>
        ))}
      </div>
      {open && <MediaPanel key={open.id} item={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function MediaPanel({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [altText, setAltText] = useState(item.altText);
  const [product, setProduct] = useState<{ id: string | null; label: string }>({
    id: item.productId,
    label: item.productName ? `${item.productName} ${item.productLine ?? ""}`.trim() : "",
  });
  const [search, setSearch] = useState(product.label);
  const [confirm, setConfirm] = useState(false);

  const run = (action: () => Promise<ActionResult>, close = false) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      toast(result.message ?? "Gespeichert");
      router.refresh();
      if (close) onClose();
    });

  return (
    <div className="panel-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        className="side-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-title"
        onKeyDown={(event) => event.key === "Escape" && onClose()}
      >
        <header>
          <div>
            <h2 id="media-title">Bild bearbeiten</h2>
            <p>
              {item.originalFilename ?? (item.origin === "generiert" ? "Erzeugtes Symbolbild" : "Bild")} · hochgeladen{" "}
              {formatDateTime(item.createdAt)}
              {item.createdBy ? ` von ${item.createdBy}` : ""}
            </p>
          </div>
          <button className="icon-button" type="button" aria-label="Schliessen" onClick={onClose} autoFocus>
            <X />
          </button>
        </header>
        <div className="side-panel-body image-detail">
          <figure>
            <Image src={`/api/bilder/${item.id}`} alt={item.altText} width={1200} height={900} unoptimized />
          </figure>
          <dl className="stat-list">
            <div>
              <dt>Format</dt>
              <dd style={{ fontSize: 14 }}>
                {item.contentType.replace("image/", "").replace("+xml", "").toUpperCase()}
              </dd>
            </div>
            <div>
              <dt>Abmessungen</dt>
              <dd style={{ fontSize: 14 }}>{item.width && item.height ? `${item.width} × ${item.height}` : "–"}</dd>
            </div>
            <div>
              <dt>Grösse</dt>
              <dd style={{ fontSize: 14 }}>{formatBytes(item.byteSize)}</dd>
            </div>
          </dl>
          <div className="field">
            <label htmlFor="media-alt">Alternativtext</label>
            <input
              id="media-alt"
              className="input"
              value={altText}
              maxLength={300}
              onChange={(event) => setAltText(event.target.value)}
            />
            <p className="field-hint">
              Beschreibt das Bild für Screenreader, z. B. «Faltschachtel Dafalgan 500 mg, 16 Tabletten».
            </p>
          </div>
          <div className="field">
            <label htmlFor="media-product">Arzneimittel</label>
            <Combobox
              id="media-product"
              kind="arzneimittel"
              value={search}
              placeholder="Arzneimittel suchen …"
              onChange={(value) => {
                setSearch(value);
                if (!value) setProduct({ id: null, label: "" });
              }}
              onSelect={(selected) => {
                setProduct({ id: selected.value, label: selected.label });
                setSearch(selected.label);
              }}
            />
            <p className="field-hint">
              {product.id
                ? `Zugeordnet: ${product.label}`
                : "Keinem Arzneimittel zugeordnet (erscheint nicht im Katalog)."}
            </p>
          </div>
        </div>
        <footer>
          <button type="button" className="danger-button" disabled={pending} onClick={() => setConfirm(true)}>
            <Trash /> Löschen
          </button>
          <a className="secondary-button" href={`/api/bilder/${item.id}?download=1`}>
            <DownloadSimple /> Herunterladen
          </a>
          {item.productId && (
            <Link className="secondary-button" href={`/admin/arzneimittel/${item.productId}#bilder`}>
              <ArrowSquareOut /> Arzneimittel
            </Link>
          )}
          {item.productId && !item.isPrimary && (
            <button
              type="button"
              className="secondary-button"
              disabled={pending}
              onClick={() => run(() => setPrimaryImageAction(item.id), true)}
            >
              <Star /> Hauptbild
            </button>
          )}
          <span className="spacer" />
          <button
            type="button"
            className="primary-button"
            disabled={pending || (altText === item.altText && product.id === item.productId)}
            onClick={() =>
              run(
                () =>
                  updateImageAction(item.id, {
                    altText,
                    ...(product.id !== item.productId ? { productId: product.id } : {}),
                  }),
                true,
              )
            }
          >
            <FloppyDisk /> Speichern
          </button>
        </footer>
      </section>
      {confirm && (
        <ConfirmDialog
          title="Bild löschen?"
          text="Das Bild wird endgültig aus dem Speicher entfernt."
          pending={pending}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            run(() => deleteImageAction(item.id), true);
          }}
        />
      )}
    </div>
  );
}
