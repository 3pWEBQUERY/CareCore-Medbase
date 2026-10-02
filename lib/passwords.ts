import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Passwörter mit scrypt (N=2^15, r=8, p=1) und zufälligem Salz; Format „scrypt$N$r$p$salz$hash“ (Base64).
const N = 32768;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, n: number, r: number, p: number) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { N: n, r, p, maxmem: 128 * n * r * 2 }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), Number(n), Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const PASSWORD_MIN_LENGTH = 12;

export function passwordProblem(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) return `Das Passwort braucht mindestens ${PASSWORD_MIN_LENGTH} Zeichen.`;
  if (password.length > 200) return "Das Passwort ist zu lang (höchstens 200 Zeichen).";
  return null;
}
