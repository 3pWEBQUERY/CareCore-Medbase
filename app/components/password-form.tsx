"use client";

import { useState, useTransition } from "react";
import { FloppyDisk } from "@phosphor-icons/react/ssr";
import { changePasswordAction } from "@/app/actions/users";
import { useToast } from "./toast";

export function PasswordForm() {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({ current: "", next: "", repeat: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <form
      className="card-body"
      style={{ display: "grid", gap: 16, maxWidth: 460 }}
      onSubmit={(event) => {
        event.preventDefault();
        if (values.next !== values.repeat) {
          setErrors({ repeat: "Die Wiederholung stimmt nicht überein." });
          return;
        }
        startTransition(async () => {
          const result = await changePasswordAction(values.current, values.next);
          if (!result.ok) {
            setErrors(result.fieldErrors ?? {});
            toast(result.error, "error");
            return;
          }
          setErrors({});
          setValues({ current: "", next: "", repeat: "" });
          toast(result.message ?? "Passwort geändert");
        });
      }}
    >
      {(
        [
          ["current", "Aktuelles Passwort", "current-password"],
          ["next", "Neues Passwort", "new-password"],
          ["repeat", "Neues Passwort wiederholen", "new-password"],
        ] as const
      ).map(([key, label, autoComplete]) => (
        <div className="field" key={key}>
          <label htmlFor={`pw-${key}`}>{label}</label>
          <input
            id={`pw-${key}`}
            className="input"
            type="password"
            autoComplete={autoComplete}
            value={values[key]}
            required
            onChange={(event) => setValues({ ...values, [key]: event.target.value })}
            aria-invalid={!!errors[key]}
          />
          {errors[key] ? (
            <p className="field-error">{errors[key]}</p>
          ) : key === "next" ? (
            <p className="field-hint">Mindestens 12 Zeichen. Andere Geräte werden danach abgemeldet.</p>
          ) : null}
        </div>
      ))}
      <button className="primary-button" type="submit" disabled={pending} style={{ justifySelf: "start" }}>
        <FloppyDisk /> Passwort ändern
      </button>
    </form>
  );
}
