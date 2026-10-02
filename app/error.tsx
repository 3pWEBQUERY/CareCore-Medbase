"use client";

import { StatusPage } from "./components/status-page";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StatusPage
      code={error.digest ? `Fehler ${error.digest}` : "Fehler"}
      title="Etwas ist schiefgelaufen"
      text="Die Seite konnte nicht geladen werden. Bitte erneut versuchen; bleibt der Fehler, die Administration informieren."
    >
      <button className="primary-button" type="button" onClick={reset}>
        Erneut versuchen
      </button>
    </StatusPage>
  );
}
