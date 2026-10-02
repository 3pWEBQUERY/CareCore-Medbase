"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MagnifyingGlass, X } from "@phosphor-icons/react/ssr";

type Hit = {
  id: string;
  slug: string;
  name: string;
  line: string | null;
  meta: string;
  image: string;
  category: string | null;
};

// Schnellsuche (⌘K): Treffer während der Eingabe, Pfeiltasten und Enter zum Öffnen, Escape schliesst.
export function SearchDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [count, setCount] = useState(0);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    input.current?.focus();
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus?.();
  }, []);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/suche?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) return;
        const data = (await response.json()) as { hits: Hit[]; total: number };
        setResults(data.hits);
        setCount(data.total);
        setSelected(0);
      } catch {
        // abgebrochen oder offline: Liste bleibt
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 160);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term]);

  // Unter zwei Zeichen keine Treffer anzeigen (die letzte Antwort bleibt im Zustand, wird aber ausgeblendet).
  const short = term.trim().length < 2;
  const hits = short ? [] : results;
  const total = short ? 0 : count;

  const open = (hit?: Hit) => {
    onClose();
    router.push(hit ? `/arzneimittel/${hit.slug}` : `/?q=${encodeURIComponent(term.trim())}`);
  };

  return (
    <div
      className="overlay"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="search-dialog" role="dialog" aria-modal="true" aria-label="Arzneimittel suchen">
        <div className="search-dialog-input">
          <MagnifyingGlass aria-hidden="true" />
          <input
            ref={input}
            value={term}
            placeholder="Name, Wirkstoff, ATC-Code, GTIN oder Zulassungsnummer"
            aria-label="Suchbegriff"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls="search-dialog-results"
            aria-activedescendant={hits[selected] ? `hit-${hits[selected].id}` : undefined}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              else if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelected((index) => Math.min(index + 1, hits.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelected((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter" && term.trim()) {
                event.preventDefault();
                open(hits[selected]);
              }
            }}
          />
          <button className="icon-button" type="button" aria-label="Suche schliessen" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="search-dialog-results" id="search-dialog-results" role="listbox">
          {hits.map((hit, index) => (
            <Link
              key={hit.id}
              id={`hit-${hit.id}`}
              href={`/arzneimittel/${hit.slug}`}
              className="search-result"
              role="option"
              aria-selected={index === selected}
              onMouseEnter={() => setSelected(index)}
              onClick={onClose}
            >
              <Image src={hit.image} alt="" width={56} height={42} unoptimized />
              <span>
                <strong>
                  {hit.name} {hit.line && <span className="muted">{hit.line}</span>}
                </strong>
                <small>{hit.meta}</small>
              </span>
              {hit.category && <span className={`badge badge-cat badge-cat-${hit.category}`}>{hit.category}</span>}
            </Link>
          ))}
          {term.trim().length >= 2 && !loading && hits.length === 0 && (
            <p className="empty-state" style={{ padding: 28 }}>
              Kein Arzneimittel gefunden.
            </p>
          )}
          {term.trim().length < 2 && (
            <p className="muted" style={{ margin: 0, padding: "18px 12px", fontSize: 13 }}>
              Mindestens zwei Zeichen eingeben, z. B. «Paracetamol», «N02BE», «Tropfen» oder eine GTIN.
            </p>
          )}
        </div>
        <footer className="search-dialog-footer">
          <span>↑ ↓ auswählen · Enter öffnen · Esc schliessen</span>
          {total > hits.length && (
            <Link href={`/?q=${encodeURIComponent(term.trim())}`} onClick={onClose}>
              Alle {total.toLocaleString("de-CH")} Treffer anzeigen
            </Link>
          )}
        </footer>
      </div>
    </div>
  );
}
