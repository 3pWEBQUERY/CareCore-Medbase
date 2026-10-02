import { PasswordForm } from "@/app/components/password-form";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Konto" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <main className="workspace">
      <div className="page-heading">
        <div className="heading-copy">
          <p className="eyebrow">Konto</p>
          <h1>{user.displayName}</h1>
          <p>
            Angemeldet als <span className="mono">@{user.username}</span> ·{" "}
            {user.role === "admin" ? "Administration" : "Redaktion"}
          </p>
        </div>
      </div>
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Passwort ändern</h2>
            <p>Die Sitzung läuft nach 12 Stunden ohne Aktivität ab.</p>
          </div>
        </div>
        <PasswordForm />
      </section>
    </main>
  );
}
