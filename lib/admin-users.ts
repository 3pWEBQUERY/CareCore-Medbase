import "server-only";
import { audit } from "./audit.ts";
import { query, queryOne, transaction } from "./db.ts";
import { hashPassword, passwordProblem, verifyPassword } from "./passwords.ts";
import { cleanText } from "./text.ts";

export class UserError extends Error {
  constructor(
    message: string,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

export async function listUsers() {
  return query<{
    id: string;
    username: string;
    displayName: string;
    role: "admin" | "editor";
    active: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    sessions: number;
    locked: boolean;
  }>(
    `SELECT u.id, u.username, u.display_name AS "displayName", u.role, u.active, u.last_login_at AS "lastLoginAt",
       u.created_at AS "createdAt", COALESCE(u.locked_until > NOW(), FALSE) AS locked,
       (SELECT COUNT(*)::int FROM medbase_sessions s WHERE s.user_id = u.id AND s.expires_at > NOW()) AS sessions
     FROM medbase_users u ORDER BY u.active DESC, lower(u.display_name)`,
  );
}

// Anlegen oder Ändern; das Passwort nur, wenn angegeben (beim Anlegen Pflicht).
export async function saveUser(actorId: string, id: string | null, raw: Record<string, unknown>) {
  const username = cleanText(raw.username, 60).toLowerCase();
  const displayName = cleanText(raw.displayName, 120);
  const role = raw.role === "admin" ? "admin" : "editor";
  const active = raw.active !== false;
  const password = typeof raw.password === "string" ? raw.password : "";
  const errors: Record<string, string> = {};
  if (!/^[a-z0-9._-]{3,60}$/.test(username))
    errors.username = "3–60 Zeichen: Kleinbuchstaben, Ziffern, Punkt, Bindestrich.";
  if (!displayName) errors.displayName = "Namen angeben.";
  if (!id || password) {
    const problem = passwordProblem(password);
    if (problem) errors.password = problem;
  }
  if (id === actorId && (!active || role !== "admin"))
    errors.role = "Das eigene Konto kann sich nicht selbst die Administration entziehen.";
  if (Object.keys(errors).length) throw new UserError("Bitte die markierten Felder prüfen.", errors);

  await transaction(async (client) => {
    const clash = await queryOne(
      "SELECT 1 FROM medbase_users WHERE lower(username) = $1 AND id IS DISTINCT FROM $2",
      [username, id],
      client,
    );
    if (clash) throw new UserError("Der Benutzername ist vergeben.", { username: "Bereits vergeben." });
    const hash = password ? await hashPassword(password) : null;
    if (id) {
      const row = await queryOne(
        `UPDATE medbase_users SET username = $2, display_name = $3, role = $4, active = $5,
           password_hash = COALESCE($6, password_hash), failed_logins = CASE WHEN $6::text IS NULL THEN failed_logins ELSE 0 END,
           locked_until = CASE WHEN $6::text IS NULL THEN locked_until END, updated_at = NOW()
         WHERE id = $1 RETURNING id`,
        [id, username, displayName, role, active, hash],
        client,
      );
      if (!row) throw new UserError("Das Konto gibt es nicht mehr.");
      // Deaktiviert oder neues Passwort: bestehende Sitzungen beenden.
      if (!active || hash) await query("DELETE FROM medbase_sessions WHERE user_id = $1", [id], client);
    } else {
      await query(
        "INSERT INTO medbase_users (username, display_name, password_hash, role, active) VALUES ($1, $2, $3, $4, $5)",
        [username, displayName, hash, role, active],
        client,
      );
    }
    const admins = await queryOne<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM medbase_users WHERE role = 'admin' AND active",
      [],
      client,
    );
    if (!admins?.count)
      throw new UserError("Es muss mindestens eine aktive Administratorin oder ein Administrator bleiben.");
    await audit(
      actorId,
      id ? "geaendert" : "angelegt",
      "benutzer",
      id,
      `Konto «${username}» ${id ? "geändert" : "angelegt"}${hash && id ? " (neues Passwort)" : ""}`,
      client,
    );
  });
}

export async function deleteUser(actorId: string, id: string) {
  if (id === actorId) throw new UserError("Das eigene Konto kann nicht gelöscht werden.");
  await transaction(async (client) => {
    const user = await queryOne<{ username: string }>(
      "DELETE FROM medbase_users WHERE id = $1 RETURNING username",
      [id],
      client,
    );
    if (!user) throw new UserError("Das Konto gibt es nicht mehr.");
    const admins = await queryOne<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM medbase_users WHERE role = 'admin' AND active",
      [],
      client,
    );
    if (!admins?.count)
      throw new UserError("Es muss mindestens eine aktive Administratorin oder ein Administrator bleiben.");
    await audit(actorId, "geloescht", "benutzer", id, `Konto «${user.username}» gelöscht`, client);
  });
}

export async function changeOwnPassword(userId: string, current: string, next: string, keepSession: string | null) {
  const user = await queryOne<{ password_hash: string }>("SELECT password_hash FROM medbase_users WHERE id = $1", [
    userId,
  ]);
  if (!user || !(await verifyPassword(current, user.password_hash)))
    throw new UserError("Das aktuelle Passwort stimmt nicht.", { current: "Stimmt nicht." });
  const problem = passwordProblem(next);
  if (problem) throw new UserError(problem, { next: problem });
  if (current === next)
    throw new UserError("Das neue Passwort muss sich vom alten unterscheiden.", { next: "Gleich wie bisher." });
  await transaction(async (client) => {
    await query(
      "UPDATE medbase_users SET password_hash = $2, updated_at = NOW() WHERE id = $1",
      [userId, await hashPassword(next)],
      client,
    );
    // Andere Geräte abmelden, die aktuelle Sitzung bleibt.
    await query(
      "DELETE FROM medbase_sessions WHERE user_id = $1 AND token_hash IS DISTINCT FROM $2",
      [userId, keepSession],
      client,
    );
    await audit(userId, "geaendert", "benutzer", userId, "Eigenes Passwort geändert", client);
  });
}
