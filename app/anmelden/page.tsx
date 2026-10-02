import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Barcode, Images, Pill, ShieldCheck } from "@phosphor-icons/react/ssr";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: PageProps<"/anmelden">) {
  const { weiter } = await searchParams;
  const target = typeof weiter === "string" && weiter.startsWith("/") && !weiter.startsWith("//") ? weiter : "/admin";
  if (await currentUser()) redirect(target);
  return (
    <main className="login-page">
      <section className="login-brand-panel" aria-label="CareCore Medbase">
        <Link href="/" className="login-brand">
          <span>
            <Pill />
          </span>
          <div>
            <strong>CareCore Medbase</strong>
            <small>Arzneimittel der Schweiz</small>
          </div>
        </Link>
        <div className="login-brand-copy">
          <p className="eyebrow">Verwaltung</p>
          <h1>Jedes Arzneimittel. Eine verlässliche Quelle.</h1>
          <p>
            Zulassungsdaten von Swissmedic, Packungen mit GTIN, Wirkstoffe und Abbildungen – gepflegt an einem Ort und
            sofort im Katalog sichtbar.
          </p>
        </div>
        <div className="login-trust-list">
          <span>
            <Barcode />
            <span>
              <strong>Amtliche Grundlage</strong>
              <small>Import der Swissmedic-Liste der zugelassenen Packungen.</small>
            </span>
          </span>
          <span>
            <Images />
            <span>
              <strong>Bilder im eigenen Speicher</strong>
              <small>Hochladen, ordnen und ersetzen – privat im Bucket.</small>
            </span>
          </span>
        </div>
        <footer>CareCore Medbase · Teil von CareCore</footer>
      </section>
      <section className="login-form-panel">
        <div className="login-form-wrap">
          <div className="login-heading">
            <p className="eyebrow">Anmeldung</p>
            <h2>Willkommen zurück</h2>
            <p>Mit dem Konto der Verwaltung anmelden. Der Katalog ist ohne Anmeldung zugänglich.</p>
          </div>
          <LoginForm target={target} />
          <p className="muted" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 26, fontSize: 12 }}>
            <ShieldCheck width={16} height={16} /> Nach fünf Fehlversuchen wird das Konto 15 Minuten gesperrt.
          </p>
          <Link href="/" className="login-back">
            <ArrowLeft /> Zurück zum Katalog
          </Link>
        </div>
      </section>
    </main>
  );
}
