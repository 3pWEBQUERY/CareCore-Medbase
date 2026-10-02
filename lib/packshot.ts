// Packungsabbildung als SVG: eine schlichte, einheitliche Darstellung je Darreichungsform (Faltschachtel,
// Tropfflasche, Flasche, Tube, Spray, Durchstechflasche, Beutel, Inhalator, Pflaster) mit Name, Stärke und
// Zulassungsinhaberin. Die Farbe richtet sich nach der ATC-Hauptgruppe. Verwendet für die Beispieldaten und als
// Symbolbild, solange für ein Arzneimittel kein Foto hochgeladen ist.

export type Illustration = "box" | "dropper" | "bottle" | "tube" | "spray" | "vial" | "sachet" | "inhaler" | "patch";

export type PackshotInput = {
  name: string;
  line?: string | null;
  form?: string | null;
  company?: string | null;
  atcCode?: string | null;
  illustration?: string | null;
};

export const ILLUSTRATIONS: { value: Illustration; label: string }[] = [
  { value: "box", label: "Faltschachtel" },
  { value: "dropper", label: "Tropfflasche" },
  { value: "bottle", label: "Flasche" },
  { value: "tube", label: "Tube" },
  { value: "spray", label: "Sprühflasche" },
  { value: "vial", label: "Durchstechflasche / Ampulle" },
  { value: "sachet", label: "Beutel" },
  { value: "inhaler", label: "Inhalator" },
  { value: "patch", label: "Pflaster" },
];

// Farbe je ATC-Hauptgruppe (dunkel genug für weisse Schrift, Kontrast mindestens 4.5:1).
const GROUP_COLORS: Record<string, string> = {
  A: "#0f766e",
  B: "#b42318",
  C: "#c2410c",
  D: "#a15c07",
  G: "#be185d",
  H: "#7e22ce",
  J: "#1d4ed8",
  L: "#6d28d9",
  M: "#0369a1",
  N: "#2563eb",
  P: "#4d7c0f",
  R: "#0e7490",
  S: "#047857",
  V: "#475569",
};

export function groupColor(atcCode?: string | null) {
  return GROUP_COLORS[(atcCode ?? "").charAt(0).toUpperCase()] ?? "#334155";
}

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

// Schriftgrösse, damit ein Text in die Breite passt (Arial: durchschnittlich ~0.56 em je Zeichen, fett ~0.6 em).
function fit(text: string, width: number, max: number, min: number, bold = false) {
  const perChar = bold ? 0.6 : 0.54;
  return Math.max(min, Math.min(max, Math.floor(width / (Math.max(text.length, 1) * perChar))));
}

function truncate(text: string, width: number, size: number, bold = false) {
  const perChar = bold ? 0.6 : 0.54;
  const maxChars = Math.floor(width / (size * perChar));
  return text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…` : text;
}

function textLine(
  text: string,
  x: number,
  y: number,
  width: number,
  max: number,
  min: number,
  opts: string,
  bold = false,
) {
  if (!text) return "";
  const size = fit(text, width, max, min, bold);
  return `<text x="${x}" y="${y}" font-size="${size}" ${opts}>${escape(truncate(text, width, size, bold))}</text>`;
}

// Etikett mit Farbband: Name, Stärke/Form und Firma, linksbündig in einem Rechteck.
function label(input: Labelled, x: number, y: number, width: number, height: number, color: string, scale = 1) {
  const pad = 18 * scale;
  const inner = width - pad * 2;
  const band = Math.max(10, height * 0.12);
  const nameSize = fit(input.name, inner, 46 * scale, 15 * scale, true);
  const top = y + band + pad + nameSize * 0.8;
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${6 * scale}" fill="#ffffff"/>`,
    `<rect x="${x}" y="${y}" width="${width}" height="${band}" rx="${6 * scale}" fill="${color}"/>`,
    `<rect x="${x}" y="${y + band - 6 * scale}" width="${width}" height="${6 * scale}" fill="${color}"/>`,
    textLine(input.name, x + pad, top, inner, 46 * scale, 15 * scale, `font-weight="700" fill="#102a43"`, true),
    textLine(input.line, x + pad, top + 30 * scale, inner, 24 * scale, 11 * scale, `font-weight="600" fill="${color}"`),
    textLine(input.form, x + pad, top + 56 * scale, inner, 19 * scale, 10 * scale, `fill="#475569"`),
    textLine(
      input.company,
      x + pad,
      y + height - pad * 0.9,
      inner,
      15 * scale,
      9 * scale,
      `fill="#64748b" letter-spacing="0.02em"`,
    ),
  ].join("");
}

type Labelled = { name: string; line: string; form: string; company: string };

function box(input: Labelled, color: string) {
  // Faltschachtel schräg von vorne: Vorderseite, Deckel und rechte Seite.
  const [x, y, w, h, d] = [110, 160, 500, 300, 80];
  return `
    <path d="M${x} ${y} l${d} -${d * 0.55} h${w} l-${d} ${d * 0.55} z" fill="#e8eef6"/>
    <path d="M${x + w} ${y} l${d} -${d * 0.55} v${h} l-${d} ${d * 0.55} z" fill="${color}" opacity="0.92"/>
    <path d="M${x + w} ${y} l${d} -${d * 0.55} v${h} l-${d} ${d * 0.55} z" fill="#000" opacity="0.12"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>
    <rect x="${x}" y="${y + h - 44}" width="${w}" height="44" fill="${color}"/>
    <rect x="${x + w - 92}" y="${y + 24}" width="66" height="66" rx="33" fill="${color}" opacity="0.1"/>
    <rect x="${x + w - 74}" y="${y + 42}" width="30" height="30" rx="15" fill="${color}" opacity="0.85"/>
    ${textLine(input.name, x + 30, y + 78, w - 140, 56, 24, `font-weight="700" fill="#102a43"`, true)}
    ${textLine(input.line, x + 30, y + 126, w - 60, 32, 16, `font-weight="600" fill="${color}"`)}
    ${textLine(input.form, x + 30, y + 164, w - 60, 24, 14, `fill="#475569"`)}
    ${textLine(input.company, x + 30, y + h - 14, w - 60, 18, 12, `fill="#ffffff" letter-spacing="0.03em"`)}
  `;
}

function dropper(input: Labelled, color: string) {
  return `
    <rect x="335" y="78" width="70" height="40" rx="8" fill="#f8fafc" stroke="#cbd5e1"/>
    <path d="M350 118 h40 v34 h-40 z" fill="#e2e8f0"/>
    <path d="M300 152 h140 q20 0 20 22 v26 q36 10 36 52 v188 q0 34 -34 34 h-184 q-34 0 -34 -34 v-188 q0 -42 36 -52 v-26 q0 -22 20 -22 z" fill="#8a4b12"/>
    <path d="M300 152 h140 q20 0 20 22 v26 q36 10 36 52 v188 q0 34 -34 34 h-184 q-34 0 -34 -34 v-188 q0 -42 36 -52 v-26 q0 -22 20 -22 z" fill="url(#glass)"/>
    <rect x="300" y="150" width="140" height="44" rx="8" fill="#ffffff"/>
    <rect x="300" y="186" width="140" height="8" fill="${color}"/>
    ${label(input, 262, 268, 216, 160, color, 0.62)}
  `;
}

function bottle(input: Labelled, color: string) {
  return `
    <rect x="318" y="62" width="104" height="58" rx="10" fill="#ffffff" stroke="#cbd5e1"/>
    <path d="M326 72 v40 M342 72 v40 M358 72 v40 M374 72 v40 M390 72 v40 M406 72 v40" stroke="#e2e8f0" stroke-width="4"/>
    <path d="M330 120 h80 v24 q0 18 30 30 q40 18 40 64 v210 q0 32 -32 32 h-156 q-32 0 -32 -32 v-210 q0 -46 40 -64 q30 -12 30 -30 z" fill="#7c3f0f"/>
    <path d="M330 120 h80 v24 q0 18 30 30 q40 18 40 64 v210 q0 32 -32 32 h-156 q-32 0 -32 -32 v-210 q0 -46 40 -64 q30 -12 30 -30 z" fill="url(#glass)"/>
    ${label(input, 266, 262, 208, 176, color, 0.64)}
  `;
}

function tube(input: Labelled, color: string) {
  return `
    <path d="M120 250 h420 l60 18 v84 l-60 18 h-420 q-14 0 -14 -14 v-92 q0 -14 14 -14 z" fill="#ffffff" stroke="#d6dfeb"/>
    <path d="M106 262 h22 v96 h-22 z" fill="#e2e8f0"/>
    <path d="M110 262 v96 M116 262 v96 M122 262 v96" stroke="#cbd5e1" stroke-width="2"/>
    <rect x="600" y="276" width="34" height="68" rx="4" fill="${color}"/>
    <rect x="634" y="268" width="70" height="84" rx="10" fill="${color}"/>
    <rect x="634" y="268" width="70" height="84" rx="10" fill="#000" opacity="0.1"/>
    <rect x="150" y="250" width="16" height="120" fill="${color}"/>
    ${textLine(input.name, 190, 302, 360, 40, 16, `font-weight="700" fill="#102a43"`, true)}
    ${textLine(input.line, 190, 334, 360, 22, 11, `font-weight="600" fill="${color}"`)}
    ${textLine(input.company, 190, 358, 360, 14, 9, `fill="#64748b"`)}
  `;
}

function spray(input: Labelled, color: string) {
  return `
    <path d="M352 52 h36 l6 70 h-48 z" fill="#f1f5f9" stroke="#cbd5e1"/>
    <rect x="330" y="120" width="80" height="52" rx="10" fill="${color}"/>
    <rect x="322" y="166" width="96" height="18" rx="5" fill="#e2e8f0"/>
    <path d="M300 184 h140 q22 0 22 24 v232 q0 30 -30 30 h-124 q-30 0 -30 -30 v-232 q0 -24 22 -24 z" fill="#ffffff" stroke="#d6dfeb"/>
    ${label(input, 286, 236, 168, 196, color, 0.54)}
  `;
}

function vial(input: Labelled, color: string) {
  // Durchstechflasche vorne, zwei Ampullen dahinter.
  const ampoule = (x: number) => `
    <path d="M${x} 150 q0 -40 12 -54 q12 14 12 54 v8 q-4 6 0 12 v12 q22 8 22 34 v200 q0 16 -16 16 h-36 q-16 0 -16 -16 v-200 q0 -26 22 -34 v-12 q4 -6 0 -12 z" fill="#eef6ff" stroke="#c7d6ea"/>
    <rect x="${x - 22}" y="300" width="68" height="70" fill="${color}" opacity="0.18"/>`;
  return `
    ${ampoule(170)}${ampoule(560)}
    <rect x="300" y="110" width="140" height="58" rx="8" fill="${color}"/>
    <rect x="300" y="110" width="140" height="18" rx="6" fill="#ffffff" opacity="0.25"/>
    <rect x="316" y="166" width="108" height="34" fill="#cbd5e1"/>
    <path d="M300 200 h140 q30 0 30 34 v196 q0 30 -30 30 h-140 q-30 0 -30 -30 v-196 q0 -34 30 -34 z" fill="#eef6ff" stroke="#c7d6ea"/>
    <path d="M300 200 h140 q30 0 30 34 v196 q0 30 -30 30 h-140 q-30 0 -30 -30 v-196 q0 -34 30 -34 z" fill="url(#glass)" opacity="0.5"/>
    ${label(input, 278, 252, 184, 168, color, 0.58)}
  `;
}

function sachet(input: Labelled, color: string) {
  const teeth = Array.from({ length: 22 }, () => "l10 8 l10 -8").join(" ");
  return `
    <path d="M200 110 ${teeth} v380 ${teeth.replace(/l10 8 l10 -8/g, "l-10 -8 l-10 8")} z" fill="#ffffff" stroke="#d6dfeb"/>
    <rect x="200" y="130" width="440" height="56" fill="${color}"/>
    ${textLine(input.name, 232, 254, 376, 48, 18, `font-weight="700" fill="#102a43"`, true)}
    ${textLine(input.line, 232, 298, 376, 26, 12, `font-weight="600" fill="${color}"`)}
    ${textLine(input.form, 232, 332, 376, 20, 11, `fill="#475569"`)}
    <rect x="200" y="404" width="440" height="56" fill="${color}" opacity="0.12"/>
    ${textLine(input.company, 232, 438, 376, 16, 10, `fill="#475569"`)}
  `;
}

function inhaler(input: Labelled, color: string) {
  return `
    <path d="M300 90 h130 q26 0 26 26 v262 h-182 v-262 q0 -26 26 -26 z" fill="${color}"/>
    <path d="M300 90 h130 q26 0 26 26 v262 h-182 v-262 q0 -26 26 -26 z" fill="url(#glass)" opacity="0.4"/>
    <path d="M274 360 h260 q20 0 20 20 v64 q0 20 -20 20 h-240 q-20 0 -20 -20 z" fill="#e2e8f0" stroke="#cbd5e1"/>
    <rect x="534" y="376" width="44" height="72" rx="10" fill="#cbd5e1"/>
    ${label(input, 292, 140, 156, 196, color, 0.5)}
  `;
}

function patch(input: Labelled, color: string) {
  return `
    <rect x="180" y="120" width="420" height="340" rx="56" fill="#f5efe6" stroke="#e5dccd"/>
    <rect x="222" y="160" width="336" height="260" rx="34" fill="#ffffff"/>
    <rect x="222" y="160" width="336" height="44" rx="20" fill="${color}"/>
    <rect x="222" y="184" width="336" height="20" fill="${color}"/>
    ${textLine(input.name, 250, 268, 280, 42, 16, `font-weight="700" fill="#102a43"`, true)}
    ${textLine(input.line, 250, 306, 280, 24, 11, `font-weight="600" fill="${color}"`)}
    ${textLine(input.form, 250, 338, 280, 18, 10, `fill="#475569"`)}
    ${textLine(input.company, 250, 396, 280, 14, 9, `fill="#64748b"`)}
  `;
}

const DRAW: Record<Illustration, (input: Labelled, color: string) => string> = {
  box,
  dropper,
  bottle,
  tube,
  spray,
  vial,
  sachet,
  inhaler,
  patch,
};

export function isIllustration(value: unknown): value is Illustration {
  return typeof value === "string" && value in DRAW;
}

export function renderPackshot(input: PackshotInput) {
  const color = groupColor(input.atcCode);
  const kind: Illustration = isIllustration(input.illustration) ? input.illustration : "box";
  const data: Labelled = {
    name: (input.name || "Arzneimittel").trim(),
    line: (input.line ?? "").trim(),
    form: (input.form ?? "").trim(),
    company: (input.company ?? "").trim(),
  };
  // Stärke und Form stehen oft beide in der Zeile („500 mg, Tabletten“); die Form dann nicht doppelt zeigen.
  if (data.form && data.line.toLowerCase().includes(data.form.toLowerCase())) data.form = "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img" aria-label="${escape(
    `Symbolbild: ${data.name} ${data.line}`.trim(),
  )}" font-family="Arial, Helvetica, sans-serif">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6f9fd"/><stop offset="1" stop-color="#e7eef8"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="0.35" stop-color="#ffffff" stop-opacity="0.04"/>
      <stop offset="0.8" stop-color="#000000" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.22"/>
    </linearGradient>
    <radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#0b1f3a" stop-opacity="0.22"/><stop offset="1" stop-color="#0b1f3a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <ellipse cx="400" cy="512" rx="290" ry="34" fill="url(#shadow)"/>
  ${DRAW[kind](data, color)}
  <text x="776" y="582" font-size="12" fill="#94a3b8" text-anchor="end">Symbolbild</text>
</svg>`.replace(/\n\s+/g, "\n");
}
