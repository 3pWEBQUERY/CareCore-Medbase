"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowSquareOut,
  ArrowUp,
  Barcode,
  Flask,
  FloppyDisk,
  IdentificationCard,
  Images,
  Package,
  Plus,
  TextAlignLeft,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react/ssr";
import { deleteProductAction, saveProductAction } from "@/app/actions/products";
import type { PackageInput, ProductInput, SubstanceInput } from "@/lib/admin-products";
import { emptyPackage } from "@/lib/product-form";
import {
  DISPENSING_CATEGORIES,
  FORM_GROUPS,
  NARCOTIC_LISTS,
  PRODUCT_STATUS,
  PRODUCT_TYPES,
} from "@/lib/reference-data";
import { Combobox } from "./combobox";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast";

type FormOption = { id: number; name: string; group: string };

function Field({
  label,
  error,
  hint,
  required,
  className = "span-6",
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className={`field ${className}`}>
      <label htmlFor={htmlFor}>
        {label} {required && <em aria-hidden="true">*</em>}
      </label>
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function ProductEditor({
  productId,
  slug,
  initial,
  forms,
  knownAtc,
  aside,
  images,
}: {
  productId: string | null;
  slug: string | null;
  initial: ProductInput;
  forms: FormOption[];
  knownAtc: boolean;
  aside?: ReactNode;
  images?: ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<ProductInput>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [atcKnown, setAtcKnown] = useState(knownAtc || !initial.atcCode);
  const dirty = useMemo(() => JSON.stringify(data) !== saved, [data, saved]);

  // Ungespeicherte Änderungen: beim Verlassen der Seite nachfragen.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setData((current) => ({ ...current, [key]: value }));
  const setSubstance = (index: number, changes: Partial<SubstanceInput>) =>
    set(
      "substances",
      data.substances.map((row, position) => (position === index ? { ...row, ...changes } : row)),
    );
  const setPackage = (index: number, changes: Partial<PackageInput>) =>
    set(
      "packages",
      data.packages.map((row, position) => (position === index ? { ...row, ...changes } : row)),
    );
  const move = <T,>(list: T[], index: number, offset: number) => {
    const next = [...list];
    const target = index + offset;
    if (target < 0 || target >= next.length) return list;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  };
  const err = (key: string) => errors[key];

  const save = () => {
    setFormError("");
    startTransition(async () => {
      const result = await saveProductAction(productId, data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.error);
        toast(result.error, "error");
        const first = Object.keys(result.fieldErrors ?? {})[0];
        if (first) document.getElementById(`f-${first}`)?.focus();
        return;
      }
      setErrors({});
      setSaved(JSON.stringify(data));
      toast(result.message ?? "Gespeichert");
      if (!productId && result.data) router.push(`/admin/arzneimittel/${result.data.id}`);
      else router.refresh();
    });
  };

  const remove = () => {
    startTransition(async () => {
      const result = await deleteProductAction(productId!);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      setSaved(JSON.stringify(data));
      toast(result.message ?? "Gelöscht");
      router.push("/admin/arzneimittel");
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      noValidate
    >
      <div className="editor-layout">
        <div className="editor-main">
          {formError && (
            <div className="notice critical" role="alert">
              <WarningCircle />
              <p style={{ margin: 0 }}>{formError}</p>
            </div>
          )}

          <section className="card" id="bezeichnung">
            <div className="card-head">
              <div>
                <h2>Bezeichnung</h2>
                <p>Name und Zeile erscheinen so im Katalog und auf dem Symbolbild.</p>
              </div>
            </div>
            <div className="card-body form-grid">
              <Field label="Name" required error={err("name")} htmlFor="f-name" className="span-6">
                <input
                  id="f-name"
                  className="input"
                  value={data.name}
                  onChange={(event) => set("name", event.target.value)}
                  aria-invalid={!!err("name")}
                  placeholder="z. B. Dafalgan"
                />
              </Field>
              <Field
                label="Stärke und Form"
                htmlFor="f-descriptionLine"
                hint="Wie auf der Packung, z. B. «500 mg, Filmtabletten»"
                className="span-6"
              >
                <input
                  id="f-descriptionLine"
                  className="input"
                  value={data.descriptionLine}
                  onChange={(event) => set("descriptionLine", event.target.value)}
                />
              </Field>
              <Field label="Status" htmlFor="f-status" error={err("status")} className="span-4">
                <select
                  id="f-status"
                  className="select"
                  value={data.status}
                  onChange={(event) => set("status", event.target.value)}
                >
                  {PRODUCT_STATUS.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Art" htmlFor="f-productType" error={err("productType")} className="span-4">
                <select
                  id="f-productType"
                  className="select"
                  value={data.productType}
                  onChange={(event) => set("productType", event.target.value)}
                >
                  <option value="">Nicht angegeben</option>
                  {PRODUCT_TYPES.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Darreichungsform" htmlFor="f-dosageFormId" error={err("dosageFormId")} className="span-4">
                <select
                  id="f-dosageFormId"
                  className="select"
                  value={data.dosageFormId}
                  onChange={(event) => set("dosageFormId", event.target.value)}
                >
                  <option value="">Nicht angegeben</option>
                  {FORM_GROUPS.map((group) => (
                    <optgroup key={group.value} label={group.label}>
                      {forms
                        .filter((form) => form.group === group.value)
                        .map((form) => (
                          <option key={form.id} value={form.id}>
                            {form.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <section className="card" id="zulassung">
            <div className="card-head">
              <div>
                <h2>Zulassung und Abgabe</h2>
                <p>Mit Zulassungsnummer und Packungscode berechnet Medbase die GTIN der Packungen.</p>
              </div>
            </div>
            <div className="card-body form-grid">
              <Field
                label="Zulassungsnummer"
                htmlFor="f-authorizationNumber"
                error={err("authorizationNumber")}
                hint="Fünf Ziffern (Swissmedic)"
                className="span-3"
              >
                <input
                  id="f-authorizationNumber"
                  className="input mono"
                  inputMode="numeric"
                  maxLength={5}
                  value={data.authorizationNumber}
                  onChange={(event) => set("authorizationNumber", event.target.value)}
                  aria-invalid={!!err("authorizationNumber")}
                />
              </Field>
              <Field label="Dosisstärke-Nr." htmlFor="f-dosageNumber" error={err("dosageNumber")} className="span-3">
                <input
                  id="f-dosageNumber"
                  className="input mono"
                  inputMode="numeric"
                  maxLength={3}
                  value={data.dosageNumber}
                  onChange={(event) => set("dosageNumber", event.target.value)}
                  aria-invalid={!!err("dosageNumber")}
                />
              </Field>
              <Field
                label="Zulassungsinhaberin"
                htmlFor="f-company"
                hint="Neue Firmen werden beim Speichern angelegt."
                className="span-6"
              >
                <Combobox
                  id="f-company"
                  kind="firma"
                  value={data.company}
                  onChange={(value) => set("company", value)}
                />
              </Field>
              <Field
                label="Abgabekategorie"
                htmlFor="f-dispensingCategory"
                error={err("dispensingCategory")}
                className="span-4"
              >
                <select
                  id="f-dispensingCategory"
                  className="select"
                  value={data.dispensingCategory}
                  onChange={(event) => set("dispensingCategory", event.target.value)}
                >
                  <option value="">Nicht angegeben</option>
                  {DISPENSING_CATEGORIES.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.value} – {entry.description}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Betäubungsmittel" htmlFor="f-narcoticList" error={err("narcoticList")} className="span-4">
                <select
                  id="f-narcoticList"
                  className="select"
                  value={data.narcoticList}
                  onChange={(event) => set("narcoticList", event.target.value)}
                >
                  <option value="">Kein Betäubungsmittel</option>
                  {NARCOTIC_LISTS.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      Verzeichnis {entry.value}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Heilmittelcode" htmlFor="f-remedyCode" className="span-4">
                <input
                  id="f-remedyCode"
                  className="input"
                  value={data.remedyCode}
                  onChange={(event) => set("remedyCode", event.target.value)}
                  placeholder="z. B. Synthetika human"
                />
              </Field>
              <Field
                label="Erstzulassung"
                htmlFor="f-firstAuthorizedOn"
                error={err("firstAuthorizedOn")}
                className="span-4"
              >
                <input
                  id="f-firstAuthorizedOn"
                  type="date"
                  className="input"
                  value={data.firstAuthorizedOn}
                  onChange={(event) => set("firstAuthorizedOn", event.target.value)}
                />
              </Field>
              <Field
                label="Zulassung gültig bis"
                htmlFor="f-authorizationValidUntil"
                error={err("authorizationValidUntil")}
                className="span-4"
              >
                <input
                  id="f-authorizationValidUntil"
                  type="date"
                  className="input"
                  value={data.authorizationValidUntil}
                  onChange={(event) => set("authorizationValidUntil", event.target.value)}
                />
              </Field>
              <div className="field span-4">
                <span className="field-label">Spezialitätenliste</span>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={data.slListed}
                    onChange={(event) => set("slListed", event.target.checked)}
                  />{" "}
                  In der SL (BAG)
                </label>
              </div>
              <Field
                label="ATC-Code"
                htmlFor="f-atcCode"
                error={err("atcCode")}
                hint="Code oder Bezeichnung eingeben und Vorschlag wählen"
                className="span-4"
              >
                <Combobox
                  id="f-atcCode"
                  kind="atc"
                  className="input mono"
                  value={data.atcCode}
                  invalid={!!err("atcCode")}
                  onChange={(value) => {
                    set("atcCode", value.toUpperCase());
                    setAtcKnown(false);
                  }}
                  onSelect={(item) => {
                    set("atcCode", item.value);
                    setAtcKnown(true);
                  }}
                />
              </Field>
              {!atcKnown && data.atcCode && (
                <Field
                  label="Bezeichnung des ATC-Codes"
                  htmlFor="f-atcName"
                  hint="Nur für neue Codes; wird in der Klassifikation ergänzt."
                  className="span-8"
                >
                  <input
                    id="f-atcName"
                    className="input"
                    value={data.atcName}
                    onChange={(event) => set("atcName", event.target.value)}
                  />
                </Field>
              )}
            </div>
          </section>

          <section className="card" id="wirkstoffe">
            <div className="card-head">
              <div>
                <h2>Wirkstoffe</h2>
                <p>Menge je Einheit, z. B. 500 mg je Tablette oder 30 mg/ml.</p>
              </div>
              <button
                type="button"
                className="secondary-button small-button"
                onClick={() => set("substances", [...data.substances, { name: "", amount: "", unit: "" }])}
              >
                <Plus /> Wirkstoff
              </button>
            </div>
            <div className="card-body row-editor">
              {data.substances.length > 0 && (
                <div className="row-editor-head substance-row">
                  <span>Wirkstoff</span>
                  <span>Menge</span>
                  <span>Einheit</span>
                  <span />
                  <span />
                  <span />
                </div>
              )}
              {data.substances.map((row, index) => (
                <div key={index} className="row-editor-row substance-row">
                  <div>
                    <Combobox
                      id={`f-substances.${index}.name`}
                      kind="wirkstoff"
                      value={row.name}
                      ariaLabel={`Wirkstoff ${index + 1}`}
                      invalid={!!err(`substances.${index}.name`)}
                      onChange={(value) => setSubstance(index, { name: value })}
                    />
                    {err(`substances.${index}.name`) && (
                      <p className="field-error">{err(`substances.${index}.name`)}</p>
                    )}
                  </div>
                  <div>
                    <input
                      id={`f-substances.${index}.amount`}
                      className="input"
                      inputMode="decimal"
                      aria-label="Menge"
                      value={row.amount}
                      onChange={(event) => setSubstance(index, { amount: event.target.value })}
                      aria-invalid={!!err(`substances.${index}.amount`)}
                    />
                    {err(`substances.${index}.amount`) && (
                      <p className="field-error">{err(`substances.${index}.amount`)}</p>
                    )}
                  </div>
                  <input
                    className="input"
                    aria-label="Einheit"
                    list="units"
                    value={row.unit}
                    onChange={(event) => setSubstance(index, { unit: event.target.value })}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Nach oben"
                    disabled={index === 0}
                    onClick={() => set("substances", move(data.substances, index, -1))}
                  >
                    <ArrowUp />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Nach unten"
                    disabled={index === data.substances.length - 1}
                    onClick={() => set("substances", move(data.substances, index, 1))}
                  >
                    <ArrowDown />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label="Wirkstoff entfernen"
                    onClick={() =>
                      set(
                        "substances",
                        data.substances.filter((_, position) => position !== index),
                      )
                    }
                  >
                    <Trash />
                  </button>
                </div>
              ))}
              {data.substances.length === 0 && <p className="field-hint">Keine Wirkstoffe erfasst.</p>}
              <datalist id="units">
                {[
                  "mg",
                  "g",
                  "µg",
                  "mg/ml",
                  "mg/g",
                  "µg/ml",
                  "IE",
                  "IE/ml",
                  "E/ml",
                  "%",
                  "mmol",
                  "µg/Dosis",
                  "µg/h",
                ].map((unit) => (
                  <option key={unit} value={unit} />
                ))}
              </datalist>
            </div>
          </section>

          <section className="card" id="packungen">
            <div className="card-head">
              <div>
                <h2>Packungen</h2>
                <p>Ohne GTIN, aber mit Packungscode und Zulassungsnummer wird die GTIN beim Speichern berechnet.</p>
              </div>
              <button
                type="button"
                className="secondary-button small-button"
                onClick={() => set("packages", [...data.packages, emptyPackage()])}
              >
                <Plus /> Packung
              </button>
            </div>
            <div className="card-body package-rows">
              {data.packages.length === 0 && <p className="field-hint">Keine Packungen erfasst.</p>}
              {data.packages.map((row, index) => {
                const e = (field: string) => err(`packages.${index}.${field}`);
                const fid = (field: string) => `f-packages.${index}.${field}`;
                return (
                  <div key={row.id ?? `neu-${index}`} className="package-row">
                    <header>
                      <strong>
                        Packung {index + 1}
                        {row.quantity || row.unit ? ` · ${row.quantity} ${row.unit}`.trimEnd() : ""}
                      </strong>
                      <div>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Nach oben"
                          disabled={index === 0}
                          onClick={() => set("packages", move(data.packages, index, -1))}
                        >
                          <ArrowUp />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Nach unten"
                          disabled={index === data.packages.length - 1}
                          onClick={() => set("packages", move(data.packages, index, 1))}
                        >
                          <ArrowDown />
                        </button>
                        <button
                          type="button"
                          className="icon-button danger"
                          aria-label="Packung entfernen"
                          onClick={() =>
                            set(
                              "packages",
                              data.packages.filter((_, position) => position !== index),
                            )
                          }
                        >
                          <Trash />
                        </button>
                      </div>
                    </header>
                    <Field label="Menge" htmlFor={fid("quantity")} error={e("quantity")} className="span-2">
                      <input
                        id={fid("quantity")}
                        className="input"
                        inputMode="decimal"
                        value={row.quantity}
                        onChange={(event) => setPackage(index, { quantity: event.target.value })}
                        aria-invalid={!!e("quantity")}
                      />
                    </Field>
                    <Field label="Einheit" htmlFor={fid("unit")} error={e("unit")} className="span-4">
                      <input
                        id={fid("unit")}
                        className="input"
                        value={row.unit}
                        placeholder="Tablette(n), ml, Beutel …"
                        onChange={(event) => setPackage(index, { unit: event.target.value })}
                        aria-invalid={!!e("unit")}
                      />
                    </Field>
                    <Field
                      label="Packungscode"
                      htmlFor={fid("packageCode")}
                      error={e("packageCode")}
                      className="span-2"
                    >
                      <input
                        id={fid("packageCode")}
                        className="input mono"
                        inputMode="numeric"
                        maxLength={3}
                        value={row.packageCode}
                        onChange={(event) => setPackage(index, { packageCode: event.target.value })}
                        aria-invalid={!!e("packageCode")}
                      />
                    </Field>
                    <Field label="GTIN" htmlFor={fid("gtin")} error={e("gtin")} className="span-4">
                      <input
                        id={fid("gtin")}
                        className="input mono"
                        inputMode="numeric"
                        maxLength={13}
                        value={row.gtin}
                        onChange={(event) => setPackage(index, { gtin: event.target.value })}
                        aria-invalid={!!e("gtin")}
                      />
                    </Field>
                    <Field label="Pharmacode" htmlFor={fid("pharmacode")} error={e("pharmacode")} className="span-3">
                      <input
                        id={fid("pharmacode")}
                        className="input mono"
                        inputMode="numeric"
                        value={row.pharmacode}
                        onChange={(event) => setPackage(index, { pharmacode: event.target.value })}
                        aria-invalid={!!e("pharmacode")}
                      />
                    </Field>
                    <Field
                      label="Abgabekat."
                      htmlFor={fid("dispensingCategory")}
                      error={e("dispensingCategory")}
                      className="span-2"
                    >
                      <select
                        id={fid("dispensingCategory")}
                        className="select"
                        value={row.dispensingCategory}
                        onChange={(event) => setPackage(index, { dispensingCategory: event.target.value })}
                      >
                        <option value="">–</option>
                        {DISPENSING_CATEGORIES.map((entry) => (
                          <option key={entry.value} value={entry.value}>
                            {entry.value}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label="Publikumspreis CHF"
                      htmlFor={fid("publicPrice")}
                      error={e("publicPrice")}
                      className="span-2"
                    >
                      <input
                        id={fid("publicPrice")}
                        className="input"
                        inputMode="decimal"
                        value={row.publicPrice}
                        onChange={(event) => setPackage(index, { publicPrice: event.target.value })}
                        aria-invalid={!!e("publicPrice")}
                      />
                    </Field>
                    <Field
                      label="Fabrikabgabepreis CHF"
                      htmlFor={fid("exFactoryPrice")}
                      error={e("exFactoryPrice")}
                      className="span-2"
                    >
                      <input
                        id={fid("exFactoryPrice")}
                        className="input"
                        inputMode="decimal"
                        value={row.exFactoryPrice}
                        onChange={(event) => setPackage(index, { exFactoryPrice: event.target.value })}
                        aria-invalid={!!e("exFactoryPrice")}
                      />
                    </Field>
                    <Field label="Status" htmlFor={fid("status")} className="span-2">
                      <select
                        id={fid("status")}
                        className="select"
                        value={row.status}
                        onChange={(event) => setPackage(index, { status: event.target.value })}
                      >
                        <option value="aktiv">Im Handel</option>
                        <option value="ausser_handel">Ausser Handel</option>
                      </select>
                    </Field>
                    <div className="field span-1" style={{ alignSelf: "end" }}>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={row.slListed}
                          onChange={(event) => setPackage(index, { slListed: event.target.checked })}
                        />{" "}
                        SL
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card" id="texte">
            <div className="card-head">
              <div>
                <h2>Texte</h2>
                <p>Kurzfassungen; massgebend ist die genehmigte Arzneimittelinformation.</p>
              </div>
            </div>
            <div className="card-body form-grid">
              <Field label="Anwendungsgebiet" htmlFor="f-indication" className="span-12">
                <textarea
                  id="f-indication"
                  className="textarea"
                  value={data.indication}
                  onChange={(event) => set("indication", event.target.value)}
                />
              </Field>
              <Field label="Zusammensetzung" htmlFor="f-composition" className="span-12">
                <textarea
                  id="f-composition"
                  className="textarea"
                  value={data.composition}
                  onChange={(event) => set("composition", event.target.value)}
                />
              </Field>
              <Field
                label="Interne Notiz"
                htmlFor="f-notes"
                hint="Nur für angemeldete Personen sichtbar."
                className="span-12"
              >
                <textarea
                  id="f-notes"
                  className="textarea"
                  value={data.notes}
                  onChange={(event) => set("notes", event.target.value)}
                />
              </Field>
            </div>
          </section>

          {images}
        </div>

        <aside className="editor-aside">
          {aside}
          <nav className="card section-nav" aria-label="Abschnitte">
            <a href="#bezeichnung">
              <IdentificationCard /> Bezeichnung
            </a>
            <a href="#zulassung">
              <Barcode /> Zulassung und Abgabe
            </a>
            <a href="#wirkstoffe">
              <Flask /> Wirkstoffe ({data.substances.length})
            </a>
            <a href="#packungen">
              <Package /> Packungen ({data.packages.length})
            </a>
            <a href="#texte">
              <TextAlignLeft /> Texte
            </a>
            {productId && (
              <a href="#bilder">
                <Images /> Bilder
              </a>
            )}
          </nav>
          {slug && (
            <Link className="secondary-button" href={`/arzneimittel/${slug}`} target="_blank">
              <ArrowSquareOut /> Im Katalog ansehen
            </Link>
          )}
        </aside>
      </div>

      <div className="form-footer editor-footer">
        {productId && (
          <button type="button" className="danger-button" onClick={() => setConfirmDelete(true)} disabled={pending}>
            <Trash /> Löschen
          </button>
        )}
        <span className="spacer" />
        <span className="muted" style={{ fontSize: 12 }} aria-live="polite">
          {dirty ? "Ungespeicherte Änderungen" : "Alle Änderungen gespeichert"}
        </span>
        <Link className="secondary-button" href="/admin/arzneimittel">
          Abbrechen
        </Link>
        <button type="submit" className="primary-button" disabled={pending || (!dirty && !!productId)}>
          <FloppyDisk /> {pending ? "Speichern …" : productId ? "Änderungen speichern" : "Arzneimittel anlegen"}
        </button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Arzneimittel löschen?"
          text={`«${data.name}» wird mit allen Packungen und Bildern endgültig gelöscht. Arzneimittel aus dem Swissmedic-Import besser auf «Ausser Handel» setzen – beim nächsten Import entstehen sie sonst neu.`}
          pending={pending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={remove}
        />
      )}
    </form>
  );
}
