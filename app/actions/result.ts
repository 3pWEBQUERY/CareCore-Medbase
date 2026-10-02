import { AuthError } from "@/lib/auth";

export type ActionResult<T = undefined> =
  { ok: true; message?: string; data?: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

// Bekannte Fehler (Prüfung, Rechte) als Meldung zurückgeben, alles andere protokollieren und allgemein melden.
export function failure(error: unknown, known: (new (...args: never[]) => Error)[] = []): ActionResult<never> {
  if (error instanceof AuthError || known.some((type) => error instanceof type)) {
    const fieldErrors = (error as { fieldErrors?: Record<string, string> }).fieldErrors;
    return { ok: false, error: (error as Error).message, fieldErrors };
  }
  console.error("Action failed", error);
  return { ok: false, error: "Speichern ist fehlgeschlagen. Bitte erneut versuchen." };
}
