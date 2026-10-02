// Gleiche Normalisierung wie medbase_normalize() in der Datenbank: Kleinschreibung, ohne Akzente und Umlaute.
const FROM = "äàáâãåöòóôõøüùúûïìíîëèéêçñÿ";
const TO = "aaaaaaoooooouuuuiiiieeeecny";

export function normalize(value: string | null | undefined) {
  let result = "";
  for (const char of (value ?? "").toLowerCase()) {
    const index = FROM.indexOf(char);
    result += char === "ß" ? "ss" : index >= 0 ? TO[index] : char;
  }
  return result;
}

// Lesbare Adresse aus einem Namen, z. B. „Dafalgan 500 mg, Tabletten“ → „dafalgan-500-mg-tabletten“.
export function slugify(value: string) {
  return (
    normalize(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/g, "") || "arzneimittel"
  );
}

export function cleanText(value: unknown, maxLength = 4000) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

// Mehrzeiliger Text (Indikation, Zusammensetzung): Zeilenumbrüche bleiben, überflüssige Leerzeichen nicht.
export function cleanMultiline(value: unknown, maxLength = 20000) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

const numberFormat = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 3 });
const priceFormat = new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("de-CH", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Zurich",
});

export const formatNumber = (value: number | null | undefined) => (value == null ? "" : numberFormat.format(value));
export const formatPrice = (value: number | null | undefined) =>
  value == null ? "–" : `CHF ${priceFormat.format(value)}`;
export const formatCount = (value: number) => numberFormat.format(value);

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "–";
  const date = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value) : value;
  return Number.isNaN(date.getTime()) ? "–" : dateFormat.format(date);
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "–";
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "–" : dateTimeFormat.format(date);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${numberFormat.format(Math.round(bytes / 102.4) / 10)} KB`;
  return `${numberFormat.format(Math.round(bytes / 104857.6) / 10)} MB`;
}
