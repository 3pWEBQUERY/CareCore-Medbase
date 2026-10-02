"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { verifyPassword } from "@/lib/passwords";
import { audit } from "@/lib/audit";

export type LoginState = { error?: string; username?: string };

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

// Nur relative Ziele innerhalb von Medbase (kein offener Redirect).
const safeTarget = (value: FormDataEntryValue | null) => {
  const target = typeof value === "string" ? value : "";
  return target.startsWith("/") && !target.startsWith("//") && !target.startsWith("/\\") ? target : "/admin";
};

export async function login(_state: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get("username") ?? "")
    .trim()
    .slice(0, 100);
  const password = String(form.get("password") ?? "").slice(0, 200);
  if (!username || !password) return { error: "Bitte Benutzername und Passwort eingeben.", username };

  const user = await queryOne<{ id: string; password_hash: string; active: boolean; locked: boolean }>(
    `SELECT id, password_hash, active, COALESCE(locked_until > NOW(), FALSE) AS locked
     FROM medbase_users WHERE lower(username) = lower($1)`,
    [username],
  );
  // Gleiche Meldung für unbekannte Namen und falsche Passwörter; die Prüfung läuft trotzdem (gleiche Antwortzeit).
  const valid = await verifyPassword(
    password,
    user?.password_hash ??
      "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  );
  if (user?.locked)
    return { error: `Zu viele Fehlversuche. Das Konto ist für ${LOCK_MINUTES} Minuten gesperrt.`, username };
  if (!user || !valid || !user.active) {
    if (user)
      await query(
        `UPDATE medbase_users SET failed_logins = failed_logins + 1,
           locked_until = CASE WHEN failed_logins + 1 >= $2 THEN NOW() + make_interval(mins => $3) END
         WHERE id = $1`,
        [user.id, MAX_FAILURES, LOCK_MINUTES],
      );
    return { error: "Benutzername oder Passwort ist falsch.", username };
  }
  await query("UPDATE medbase_users SET failed_logins = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1", [
    user.id,
  ]);
  await createSession(user.id);
  await audit(user.id, "anmelden", "benutzer", user.id, "Angemeldet");
  redirect(safeTarget(form.get("weiter")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}
