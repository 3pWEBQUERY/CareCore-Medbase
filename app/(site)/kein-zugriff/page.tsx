import Link from "next/link";
import { Lock } from "@phosphor-icons/react/ssr";

export const metadata = { title: "Kein Zugriff" };

export default function NoAccess() {
  return (
    <main className="workspace">
      <div className="card empty-state">
        <Lock />
        <strong>Kein Zugriff</strong>
        <p>
          Diese Seite ist der Administration vorbehalten. Bitte bei Bedarf eine Administratorin oder einen Administrator
          fragen.
        </p>
        <Link className="secondary-button" href="/admin">
          Zur Übersicht
        </Link>
      </div>
    </main>
  );
}
