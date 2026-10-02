import type { NextConfig } from "next";

// Sicherheits-Header für alle Antworten. Schriften, Bilder und Skripte kommen nur von Medbase selbst.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "exceljs", "sharp"],
  // /api/health vergleicht die angewendeten Migrationen mit den Dateien im Deployment.
  outputFileTracingIncludes: { "/api/health": ["./database/migrations/*.sql"] },
  // Bilder und die Swissmedic-Datei werden über eigene Schnittstellen hochgeladen, nicht über Server-Aktionen.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/((?!api/bilder|api/symbolbild).*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
