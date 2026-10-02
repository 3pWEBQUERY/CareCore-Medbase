"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Funnel, GridFour, ListBullets, MagnifyingGlass, X } from "@phosphor-icons/react/ssr";

// Bedienelemente des Katalogs: Suche (aktualisiert die Adresse während der Eingabe), Filter, Sortierung, Ansicht.

function useParamUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const update = (changes: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("seite" in changes)) next.delete("seite");
    const query = next.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    startTransition(() => (replace ? router.replace(href, { scroll: false }) : router.push(href, { scroll: false })));
  };
  return { params, update, pending };
}

export function CatalogSearch({ total }: { total: number }) {
  const { params, update, pending } = useParamUpdater();
  const [value, setValue] = useState(params.get("q") ?? "");
  const last = useRef(params.get("q") ?? "");
  const updateRef = useRef(update);
  useEffect(() => {
    updateRef.current = update;
  });

  // Zurück/Vor im Browser: Feld an die Adresse angleichen.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (current !== last.current) {
      last.current = current;
      setValue(current);
    }
  }, [params]);

  useEffect(() => {
    if (value.trim() === last.current.trim()) return;
    const timer = window.setTimeout(() => {
      last.current = value.trim();
      updateRef.current({ q: value.trim() || null }, true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <form
      className="catalog-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        last.current = value.trim();
        update({ q: value.trim() || null });
      }}
    >
      <MagnifyingGlass aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Arzneimittel, Wirkstoff, ATC-Code, GTIN, Zulassungsnummer …"
        aria-label="Arzneimittel suchen"
        autoComplete="off"
        spellCheck={false}
      />
      <span className="search-meta" aria-live="polite">
        <span>{pending ? "Suche läuft …" : `${total.toLocaleString("de-CH")} Treffer`}</span>
        {value && (
          <button
            type="button"
            aria-label="Suche leeren"
            onClick={() => {
              setValue("");
              last.current = "";
              update({ q: null });
            }}
          >
            <X />
          </button>
        )}
      </span>
    </form>
  );
}

type FormOption = { id: number; name: string; group: string; count: number };

export function FilterPanel({
  forms,
  groups,
  atcGroups,
  showAdminFilters = false,
}: {
  forms: FormOption[];
  groups: { value: string; label: string }[];
  atcGroups: { code: string; name: string }[];
  showAdminFilters?: boolean;
}) {
  const { params, update } = useParamUpdater();
  const [collapsed, setCollapsed] = useState(true);
  const active = (key: string) => params.get(key) ?? "";
  const toggle = (key: string) => update({ [key]: active(key) === "1" ? null : "1" });
  const hasFilters = [
    "form",
    "gruppe",
    "kategorie",
    "atc",
    "sl",
    "btm",
    "bild",
    "status",
    "quelle",
    "firma",
    "wirkstoff",
  ].some((key) => params.has(key));

  return (
    <aside className={`card filter-panel ${collapsed ? "collapsed" : ""}`} aria-label="Filter">
      <header>
        <h2>
          <Funnel /> Filter
        </h2>
        <span style={{ display: "flex", gap: 10 }}>
          {hasFilters && (
            <button
              type="button"
              onClick={() =>
                update({
                  form: null,
                  gruppe: null,
                  kategorie: null,
                  atc: null,
                  sl: null,
                  btm: null,
                  bild: null,
                  status: null,
                  quelle: null,
                  firma: null,
                  wirkstoff: null,
                })
              }
            >
              Zurücksetzen
            </button>
          )}
          <button
            type="button"
            className="filter-toggle"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? "Anzeigen" : "Ausblenden"}
          </button>
        </span>
      </header>
      <div className="filter-section">
        <span>Darreichungsform</span>
        <select
          className="select"
          aria-label="Darreichungsform"
          value={active("form") ? `f:${active("form")}` : active("gruppe") ? `g:${active("gruppe")}` : ""}
          onChange={(event) => {
            const [kind, value] = event.target.value.split(":");
            update({ form: kind === "f" ? value : null, gruppe: kind === "g" ? value : null });
          }}
        >
          <option value="">Alle Formen</option>
          {groups
            .filter((group) => forms.some((form) => form.group === group.value))
            .map((group) => (
              <optgroup key={group.value} label={group.label}>
                <option value={`g:${group.value}`}>Alle: {group.label}</option>
                {forms
                  .filter((form) => form.group === group.value)
                  .map((form) => (
                    <option key={form.id} value={`f:${form.id}`}>
                      {form.name} ({form.count.toLocaleString("de-CH")})
                    </option>
                  ))}
              </optgroup>
            ))}
        </select>
      </div>
      <div className="filter-section">
        <span>Anatomische Hauptgruppe (ATC)</span>
        <select
          className="select"
          aria-label="ATC-Hauptgruppe"
          value={active("atc")}
          onChange={(event) => update({ atc: event.target.value || null })}
        >
          <option value="">Alle Gruppen</option>
          {atcGroups.map((group) => (
            <option key={group.code} value={group.code}>
              {group.code} – {group.name}
            </option>
          ))}
          {active("atc").length > 1 && <option value={active("atc")}>{active("atc")} (gewählt)</option>}
        </select>
      </div>
      <div className="filter-section">
        <span>Abgabekategorie</span>
        <div className="category-buttons" role="group" aria-label="Abgabekategorie">
          {["A", "B", "C", "D", "E"].map((category) => (
            <button
              key={category}
              type="button"
              className={active("kategorie") === category ? "active" : ""}
              aria-pressed={active("kategorie") === category}
              onClick={() => update({ kategorie: active("kategorie") === category ? null : category })}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
      <div className="filter-section">
        <span>Eigenschaften</span>
        <label className="checkbox">
          <input type="checkbox" checked={active("sl") === "1"} onChange={() => toggle("sl")} /> Spezialitätenliste (SL)
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={active("btm") === "1"} onChange={() => toggle("btm")} /> Betäubungsmittel
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={active("bild") === "1"} onChange={() => toggle("bild")} /> Mit Abbildung
        </label>
      </div>
      <div className="filter-section">
        <span>Status</span>
        <select
          className="select"
          aria-label="Status"
          value={active("status")}
          onChange={(event) => update({ status: event.target.value || null })}
        >
          <option value="">Im Handel</option>
          <option value="ausser_handel">Ausser Handel</option>
          {showAdminFilters && <option value="entwurf">Entwurf</option>}
          <option value="alle">Alle</option>
        </select>
      </div>
      {showAdminFilters && (
        <div className="filter-section">
          <span>Quelle</span>
          <select
            className="select"
            aria-label="Quelle"
            value={active("quelle")}
            onChange={(event) => update({ quelle: event.target.value || null })}
          >
            <option value="">Alle Quellen</option>
            <option value="swissmedic">Swissmedic-Import</option>
            <option value="manuell">Manuell erfasst</option>
            <option value="beispiel">Beispieldaten</option>
          </select>
        </div>
      )}
    </aside>
  );
}

export function ResultControls({ sort, view, hasQuery }: { sort: string; view: string; hasQuery: boolean }) {
  const { update } = useParamUpdater();
  return (
    <div className="result-controls">
      <select
        className="select"
        aria-label="Sortierung"
        value={sort}
        onChange={(event) => update({ sort: event.target.value === "relevanz" ? null : event.target.value })}
      >
        <option value="relevanz">{hasQuery ? "Beste Treffer" : "Alphabetisch"}</option>
        <option value="name">Name A–Z</option>
        <option value="neu">Zuletzt geändert</option>
      </select>
      <div className="segmented" role="group" aria-label="Ansicht">
        <button
          type="button"
          className={view !== "liste" ? "active" : ""}
          aria-pressed={view !== "liste"}
          onClick={() => update({ ansicht: null, seite: currentPage() })}
        >
          <GridFour /> Raster
        </button>
        <button
          type="button"
          className={view === "liste" ? "active" : ""}
          aria-pressed={view === "liste"}
          onClick={() => update({ ansicht: "liste", seite: currentPage() })}
        >
          <ListBullets /> Liste
        </button>
      </div>
    </div>
  );
}

// Beim Wechsel der Ansicht bleibt die Seite erhalten.
function currentPage() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("seite");
}
