"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { MagnifyingGlassPlus, X } from "@phosphor-icons/react/ssr";

export type GalleryImage = { id: string; src: string; thumb: string; alt: string; generated: boolean };

// Bildergalerie der Detailansicht: grosses Bild, Vorschaubilder, Vergrösserung (Escape schliesst).
export function Gallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const current = images[Math.min(index, images.length - 1)];
  useEffect(() => {
    if (!zoom) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoom(false);
      if (event.key === "ArrowRight") setIndex((value) => (value + 1) % images.length);
      if (event.key === "ArrowLeft") setIndex((value) => (value - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, images.length]);
  if (!current) return null;
  return (
    <div className="card gallery">
      <div className="gallery-main">
        <Image src={current.src} alt={current.alt || name} width={1200} height={900} priority unoptimized />
        <button className="icon-button zoom" type="button" aria-label="Bild vergrössern" onClick={() => setZoom(true)}>
          <MagnifyingGlassPlus />
        </button>
      </div>
      {images.length > 1 && (
        <div className="gallery-thumbs" role="tablist" aria-label="Bilder">
          {images.map((image, position) => (
            <button
              key={image.id}
              type="button"
              role="tab"
              aria-selected={position === index}
              aria-label={`Bild ${position + 1} von ${images.length}`}
              className={position === index ? "active" : ""}
              onClick={() => setIndex(position)}
            >
              <Image src={image.thumb} alt="" width={76} height={57} unoptimized />
            </button>
          ))}
        </div>
      )}
      {current.generated && (
        <p className="gallery-caption">Symbolbild: schematische Darstellung, nicht die Originalpackung.</p>
      )}
      {zoom && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={name} onClick={() => setZoom(false)}>
          <Image src={current.src} alt={current.alt || name} width={1600} height={1200} unoptimized />
          <button
            className="icon-button"
            type="button"
            aria-label="Schliessen"
            onClick={() => setZoom(false)}
            autoFocus
          >
            <X />
          </button>
        </div>
      )}
    </div>
  );
}
