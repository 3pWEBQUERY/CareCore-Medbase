import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { query, queryOne } from "./db.ts";

// Anmeldung der Verwaltung: Sitzung als zufälliges Token im Cookie, in der Datenbank nur dessen SHA-256-Hash.
// Sitzungen laufen nach 12 Stunden ohne Aktivität ab, spätestens nach 7 Tagen.

export const SESSION_COOKIE = "medbase_session";
const IDLE_HOURS = 12;
const MAX_DAYS = 7;

export type Role = "admin" | "editor";
export type SessionUser = { id: string; username: string; displayName: string; role: Role };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await query(
    `INSERT INTO medbase_sessions (token_hash, user_id, user_agent, expires_at)
     VALUES ($1, $2, $3, NOW() + make_interval(hours => $4))`,
    [hashToken(token), userId, userAgent, IDLE_HOURS],
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_DAYS * 24 * 3600,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await query("DELETE FROM medbase_sessions WHERE token_hash = $1", [hashToken(token)]);
  store.delete(SESSION_COOKIE);
}

// Angemeldete Person der aktuellen Anfrage (einmal je Anfrage gelesen); verlängert die Sitzung höchstens alle 5 Minuten.
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const row = await queryOne<{ id: string; username: string; display_name: string; role: Role }>(
    `WITH session AS (
       UPDATE medbase_sessions s
       SET last_seen_at = NOW(),
           expires_at = LEAST(NOW() + make_interval(hours => $2), s.created_at + make_interval(days => $3))
       WHERE s.token_hash = $1 AND s.expires_at > NOW()
         AND s.last_seen_at < NOW() - INTERVAL '5 minutes'
       RETURNING s.user_id
     )
     SELECT u.id, u.username, u.display_name, u.role
     FROM medbase_sessions s JOIN medbase_users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.active`,
    [hashToken(token), IDLE_HOURS, MAX_DAYS],
  );
  return row ? { id: row.id, username: row.username, displayName: row.display_name, role: row.role } : null;
});

// Für Seiten der Verwaltung: ohne Anmeldung zur Anmeldung, ohne Recht „Kein Zugriff“.
export async function requireUser(role?: Role) {
  const user = await currentUser();
  if (!user) {
    const path = (await headers()).get("x-medbase-path") ?? "/admin";
    redirect(`/anmelden?weiter=${encodeURIComponent(path)}`);
  }
  if (role === "admin" && user.role !== "admin") redirect("/kein-zugriff");
  return user;
}

// Für Server-Aktionen und Schnittstellen: wirft statt umzuleiten.
export async function actionUser(role?: Role) {
  const user = await currentUser();
  if (!user) throw new AuthError("Die Anmeldung ist abgelaufen. Bitte neu anmelden.");
  if (role === "admin" && user.role !== "admin")
    throw new AuthError("Diese Aktion ist der Administration vorbehalten.");
  return user;
}

export class AuthError extends Error {}

// Hash der aktuellen Sitzung (um sie beim Passwortwechsel zu behalten).
export async function currentSessionHash() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? hashToken(token) : null;
}
