# Hosting auf Railway

Projekt **CareCore-Medbase** (eigenes Railway-Projekt, Region Europa).

| Dienst     | Art               | Aufgabe                                               |
| ---------- | ----------------- | ----------------------------------------------------- |
| `medbase`  | GitHub-Repository | Next.js-App, Branch `main`                            |
| `Postgres` | Railway Postgres  | Datenbank, über das private Netz verbunden            |
| Bucket     | Railway Bucket    | Bilder (privat, ausgeliefert über `/api/bilder/<id>`) |

## Einstellungen des Dienstes `medbase`

- Build `npm run build`, Start `npm run start`.
- Pre-Deploy `npm run release` (Zeitlimit 600 s): Migrationen, danach Stammdaten, erstes Konto und – nur bei leerer
  Datenbank – Beispieldaten mit Bildern.
- Statusprüfung `/api/health` (120 s), Neustart bei Fehler.

## Variablen

| Variable                                   | Inhalt                                                     |
| ------------------------------------------ | ---------------------------------------------------------- |
| `DATABASE_URL`                             | `${{Postgres.DATABASE_URL}}`                               |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`    | Verweise auf den Bucket (`${{<Bucket>.ENDPOINT}}` usw.)    |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Verweise auf den Bucket                                    |
| `S3_FORCE_PATH_STYLE`                      | `false` (Railway Buckets: virtuelle Hosts)                 |
| `MEDBASE_ADMIN_PASSWORD`                   | Passwort des ersten Kontos `admin` (nur beim ersten Start) |
| `SWISSMEDIC_PACKAGES_URL`                  | optional, falls Swissmedic die Adresse der Liste ändert    |

Die Werte stehen nur in Railway, nie im Repository. Nach der ersten Anmeldung das Passwort unter Konto ändern.

## Erster Import

Verwaltung › Swissmedic-Import › «Jetzt laden und importieren». Der Import läuft im Hintergrund (einige Minuten)
und übernimmt alle zugelassenen Humanarzneimittel. Danach die Beispieldaten auf derselben Seite entfernen.
Der Import lässt sich jederzeit wiederholen (z. B. monatlich, nach Aktualisierung der Swissmedic-Liste).
