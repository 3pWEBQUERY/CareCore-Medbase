"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FloppyDisk, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react/ssr";
import { deleteUserAction, saveUserAction } from "@/app/actions/users";
import type { ActionResult } from "@/app/actions/result";
import { formatDateTime } from "@/lib/text";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast";

export type UserRow = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "editor";
  active: boolean;
  lastLoginAt: string | null;
  sessions: number;
  locked: boolean;
};

export function UserAdmin({ users, selfId }: { users: UserRow[]; selfId: string }) {
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);
  return (
    <>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <span className="result-count">
          <strong>{users.length}</strong> Konten
        </span>
        <button type="button" className="primary-button small-button" onClick={() => setEditing("new")}>
          <Plus /> Neues Konto
        </button>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Rolle</th>
              <th>Status</th>
              <th className="hide-sm">Letzte Anmeldung</th>
              <th className="num hide-sm">Sitzungen</th>
              <th className="actions" aria-label="Aktionen" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.displayName}</strong>
                  {user.id === selfId && (
                    <span className="badge badge-brand" style={{ marginLeft: 8 }}>
                      Sie
                    </span>
                  )}
                  <span className="cell-sub mono">@{user.username}</span>
                </td>
                <td>
                  <span className={`badge ${user.role === "admin" ? "badge-brand" : ""}`}>
                    {user.role === "admin" ? "Administration" : "Redaktion"}
                  </span>
                </td>
                <td>
                  <span className="status-line">
                    <span className={`status-dot ${!user.active ? "off" : user.locked ? "warn" : ""}`} />
                    {!user.active ? "Deaktiviert" : user.locked ? "Vorübergehend gesperrt" : "Aktiv"}
                  </span>
                </td>
                <td className="hide-sm muted">{formatDateTime(user.lastLoginAt)}</td>
                <td className="num hide-sm">{user.sessions}</td>
                <td className="actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`${user.displayName} bearbeiten`}
                    onClick={() => setEditing(user)}
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
        <UserPanel
          key={editing === "new" ? "new" : editing.id}
          user={editing === "new" ? null : editing}
          self={editing !== "new" && editing.id === selfId}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function UserPanel({ user, self, onClose }: { user: UserRow | null; self: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({
    username: user?.username ?? "",
    displayName: user?.displayName ?? "",
    role: user?.role ?? "editor",
    active: user?.active ?? true,
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
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
        aria-labelledby="user-title"
        onKeyDown={(event) => event.key === "Escape" && !confirm && onClose()}
      >
        <header>
          <div>
            <h2 id="user-title">{user ? "Konto bearbeiten" : "Neues Konto"}</h2>
            <p>Redaktion: Arzneimittel, Bilder und Stammdaten. Administration: zusätzlich Import und Benutzer.</p>
          </div>
          <button className="icon-button" type="button" aria-label="Schliessen" onClick={onClose}>
            <X />
          </button>
        </header>
        <form
          id="user-form"
          className="side-panel-body"
          style={{ display: "grid", gap: 16, alignContent: "start" }}
          onSubmit={(event) => {
            event.preventDefault();
            run(() => saveUserAction(user?.id ?? null, values));
          }}
        >
          <div className="field">
            <label htmlFor="u-displayName">
              Name <em>*</em>
            </label>
            <input
              id="u-displayName"
              className="input"
              value={values.displayName}
              autoFocus
              onChange={(event) => setValues({ ...values, displayName: event.target.value })}
              aria-invalid={!!errors.displayName}
            />
            {errors.displayName && <p className="field-error">{errors.displayName}</p>}
          </div>
          <div className="field">
            <label htmlFor="u-username">
              Benutzername <em>*</em>
            </label>
            <input
              id="u-username"
              className="input mono"
              value={values.username}
              autoComplete="off"
              onChange={(event) => setValues({ ...values, username: event.target.value })}
              aria-invalid={!!errors.username}
            />
            {errors.username ? (
              <p className="field-error">{errors.username}</p>
            ) : (
              <p className="field-hint">Für die Anmeldung, z. B. «m.muster»</p>
            )}
          </div>
          <div className="field">
            <label htmlFor="u-role">Rolle</label>
            <select
              id="u-role"
              className="select"
              value={values.role}
              disabled={self}
              onChange={(event) => setValues({ ...values, role: event.target.value as "admin" | "editor" })}
            >
              <option value="editor">Redaktion</option>
              <option value="admin">Administration</option>
            </select>
            {errors.role && <p className="field-error">{errors.role}</p>}
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={values.active}
              disabled={self}
              onChange={(event) => setValues({ ...values, active: event.target.checked })}
            />{" "}
            Konto aktiv
          </label>
          <div className="field">
            <label htmlFor="u-password">
              {user ? "Neues Passwort" : "Passwort"} {!user && <em>*</em>}
            </label>
            <input
              id="u-password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(event) => setValues({ ...values, password: event.target.value })}
              aria-invalid={!!errors.password}
            />
            {errors.password ? (
              <p className="field-error">{errors.password}</p>
            ) : (
              <p className="field-hint">
                {user
                  ? "Leer lassen, um das Passwort zu behalten. Ein neues Passwort meldet alle Geräte ab."
                  : "Mindestens 12 Zeichen."}
              </p>
            )}
          </div>
        </form>
        <footer>
          {user && !self && (
            <button type="button" className="danger-button" onClick={() => setConfirm(true)} disabled={pending}>
              <Trash /> Löschen
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="secondary-button" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" form="user-form" className="primary-button" disabled={pending}>
            <FloppyDisk /> Speichern
          </button>
        </footer>
      </section>
      {confirm && user && (
        <ConfirmDialog
          title="Konto löschen?"
          text={`Das Konto «${user.username}» wird gelöscht. Im Protokoll bleiben die Einträge ohne Namen erhalten. Alternativ das Konto deaktivieren.`}
          pending={pending}
          onCancel={() => setConfirm(false)}
          onConfirm={() => run(() => deleteUserAction(user.id))}
        />
      )}
    </div>
  );
}
