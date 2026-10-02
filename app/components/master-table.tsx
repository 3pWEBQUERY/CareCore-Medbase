"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowsMerge, FloppyDisk, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react/ssr";
import { deleteMasterAction, mergeMasterAction, saveMasterAction } from "@/app/actions/master";
import type { ActionResult } from "@/app/actions/result";
import type { MasterKind } from "@/lib/admin-master";
import { Combobox } from "./combobox";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast";

export type MasterField = {
  name: string;
  label: string;
  type?: "text" | "select" | "number";
  options?: { value: string; label: string }[];
  hint?: string;
  required?: boolean;
  // Nur beim Anlegen änderbar (ATC-Code).
  createOnly?: boolean;
  mono?: boolean;
};

export type MasterRow = {
  id: string;
  values: Record<string, string>;
  cells: ReactNode[];
  count: number;
  catalogHref?: string;
};

// Tabelle mit Seitenpanel zum Anlegen, Ändern, Zusammenführen und Löschen von Stammdaten.
export function MasterTable({
  kind,
  title,
  columns,
  rows,
  fields,
  canMerge = false,
  newLabel,
}: {
  kind: MasterKind;
  title: string;
  columns: string[];
  rows: MasterRow[];
  fields: MasterField[];
  canMerge?: boolean;
  newLabel: string;
}) {
  const [editing, setEditing] = useState<MasterRow | "new" | null>(null);
  return (
    <>
      <div className="toolbar" style={{ justifyContent: "flex-end", borderBottom: 0, paddingBottom: 0 }}>
        <button type="button" className="primary-button small-button" onClick={() => setEditing("new")}>
          <Plus /> {newLabel}
        </button>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
              <th className="num">Arzneimittel</th>
              <th className="actions" aria-label="Aktionen" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {row.cells.map((cell, index) => (
                  <td key={index}>{cell}</td>
                ))}
                <td className="num">
                  {row.catalogHref && row.count > 0 ? (
                    <Link href={row.catalogHref}>{row.count.toLocaleString("de-CH")}</Link>
                  ) : (
                    row.count.toLocaleString("de-CH")
                  )}
                </td>
                <td className="actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`${title} bearbeiten`}
                    onClick={() => setEditing(row)}
                  >
                    <PencilSimple />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <MasterPanel
          key={editing === "new" ? "new" : editing.id}
          kind={kind}
          title={title}
          row={editing === "new" ? null : editing}
          fields={fields}
          canMerge={canMerge}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function MasterPanel({
  kind,
  title,
  row,
  fields,
  canMerge,
  onClose,
}: {
  kind: MasterKind;
  title: string;
  row: MasterRow | null;
  fields: MasterField[];
  canMerge: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(
    row?.values ?? Object.fromEntries(fields.map((field) => [field.name, field.options?.[0]?.value ?? ""])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mergeTarget, setMergeTarget] = useState("");
  const [confirm, setConfirm] = useState<"delete" | "merge" | null>(null);

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast(result.error, "error");
        return;
      }
      toast(result.message ?? "Gespeichert");
      router.refresh();
      onClose();
    });

  return (
    <div className="panel-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        className="side-panel narrow"
        role="dialog"
        aria-modal="true"
        aria-labelledby="master-title"
        onKeyDown={(event) => event.key === "Escape" && !confirm && onClose()}
      >
        <header>
          <div>
            <h2 id="master-title">{row ? `${title} bearbeiten` : `${title} anlegen`}</h2>
            {row && <p>Verwendet von {row.count.toLocaleString("de-CH")} Arzneimittel(n)</p>}
          </div>
          <button className="icon-button" type="button" aria-label="Schliessen" onClick={onClose}>
            <X />
          </button>
        </header>
        <form
          id="master-form"
          className="side-panel-body"
          style={{ display: "grid", gap: 16, alignContent: "start" }}
          onSubmit={(event) => {
            event.preventDefault();
            run(() => saveMasterAction(kind, row?.id ?? null, values));
          }}
        >
          {fields.map((field, index) => {
            const disabled = !!row && field.createOnly;
            const common = {
              id: `m-${field.name}`,
              value: values[field.name] ?? "",
              disabled,
              "aria-invalid": !!errors[field.name] || undefined,
              autoFocus: index === 0 && !disabled,
            };
            return (
              <div key={field.name} className="field">
                <label htmlFor={common.id}>
                  {field.label} {field.required && <em aria-hidden="true">*</em>}
                </label>
                {field.type === "select" ? (
                  <select
                    className="select"
                    {...common}
                    onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
                  >
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={`input ${field.mono ? "mono" : ""}`}
                    type={field.type === "number" ? "number" : "text"}
                    {...common}
                    onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
                  />
                )}
                {errors[field.name] ? (
                  <p className="field-error">{errors[field.name]}</p>
                ) : field.hint ? (
                  <p className="field-hint">{field.hint}</p>
                ) : null}
              </div>
            );
          })}
          {row && canMerge && (kind === "substance" || kind === "company") && (
            <div className="card" style={{ padding: 16, display: "grid", gap: 10, boxShadow: "none" }}>
              <strong style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
                <ArrowsMerge width={17} height={17} /> Mit anderem Eintrag zusammenführen
              </strong>
              <p className="field-hint" style={{ margin: 0 }}>
                Alle Arzneimittel werden dem Ziel zugeordnet, dieser Eintrag wird gelöscht. Für Dubletten wie
                «Paracetamol» und «Paracetamolum».
              </p>
              <Combobox
                kind={kind === "substance" ? "wirkstoff" : "firma"}
                value={mergeTarget}
                onChange={setMergeTarget}
                placeholder="Ziel suchen …"
                ariaLabel="Ziel der Zusammenführung"
              />
              <button
                type="button"
                className="secondary-button small-button"
                disabled={!mergeTarget || pending}
                onClick={() => setConfirm("merge")}
                style={{ justifySelf: "start" }}
              >
                Zusammenführen
              </button>
            </div>
          )}
        </form>
        <footer>
          {row && (
            <button
              type="button"
              className="danger-button"
              disabled={pending || row.count > 0}
              title={row.count > 0 ? "Wird noch verwendet" : undefined}
              onClick={() => setConfirm("delete")}
            >
              <Trash /> Löschen
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="secondary-button" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" form="master-form" className="primary-button" disabled={pending}>
            <FloppyDisk /> {pending ? "Speichern …" : "Speichern"}
          </button>
        </footer>
      </section>
      {confirm === "delete" && row && (
        <ConfirmDialog
          title="Eintrag löschen?"
          text={`«${row.values.name ?? row.id}» wird endgültig gelöscht.`}
          pending={pending}
          onCancel={() => setConfirm(null)}
          onConfirm={() => run(() => deleteMasterAction(kind, row.id))}
        />
      )}
      {confirm === "merge" && row && (kind === "substance" || kind === "company") && (
        <ConfirmDialog
          title="Zusammenführen?"
          text={`«${row.values.name}» wird mit «${mergeTarget}» zusammengeführt und danach gelöscht.`}
          confirmLabel="Zusammenführen"
          pending={pending}
          onCancel={() => setConfirm(null)}
          onConfirm={() => run(() => mergeMasterAction(kind, row.id, mergeTarget))}
        />
      )}
    </div>
  );
}
