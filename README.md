# CareCore Medbase

Verzeichnis der in der Schweiz zugelassenen Arzneimittel im Erscheinungsbild von CareCore: durchsuchbarer Katalog
mit Wirkstoffen, Packungen (GTIN, Pharmacode, Preise), ATC-Klassifikation, Abgabekategorie, Betäubungsmittel-
Verzeichnis und Bildern – vollständig verwaltbar über einen geschützten Verwaltungsbereich.

Next.js 16 (App Router), React 19, PostgreSQL, S3-kompatibler Bucket für Bilder, Betrieb auf Railway
(`docs/HOSTING.md`).

## Funktionen

**Katalog (ohne Anmeldung)**

- Suche während der Eingabe über Name, Stärke, Wirkstoff (deutsch und lateinisch), Firma, Darreichungsform, ATC-Code
  und -Bezeichnung, GTIN, Pharmacode und Zulassungsnummer; Umlaute und Akzente werden ignoriert
  (`medbase_normalize`, Trigramm-Index).
- Filter: Darreichungsform bzw. Formgruppe, ATC-Hauptgruppe, Abgabekategorie A–E, Spezialitätenliste,
  Betäubungsmittel, mit Abbildung, Status. Ansicht als Raster oder Liste, Sortierung, Seiten.
- Schnellsuche mit ⌘K / Ctrl+K von jeder Seite.
- Detailseite mit Galerie (Vergrösserung), Kennzahlen, Packungen, Wirkstoffen mit Mengen, Anwendungsgebiet,
  Zusammensetzung, Zulassungsdaten, weiteren Stärken und Alternativen mit gleichem ATC-Code.
- Verzeichnisse: Wirkstoffe und Zulassungsinhaberinnen (A–Z, Suche), ATC-Baum über alle Stufen.

**Verwaltung (`/admin`, Anmeldung)**

- Übersicht mit Bestand, letzten Änderungen und Protokoll.
- Arzneimittel anlegen, ändern, löschen: alle Felder, Wirkstoffe mit Mengen, Packungen mit GTIN-Prüfung (Prüfziffer,
  Eindeutigkeit) und automatischer GTIN aus Zulassungsnummer und Packungscode, Status (im Handel, ausser Handel,
  Entwurf). Neue Firmen, Wirkstoffe und ATC-Codes entstehen beim Speichern.
- Bilder je Arzneimittel: mehrere hochladen (Ziehen oder Auswählen), Hauptbild, Reihenfolge, Alternativtext,
  herunterladen, löschen. Hochgeladene Bilder werden über ihren Inhalt geprüft, nach EXIF gedreht, ohne Metadaten
  als WebP (max. 2000 px) mit Vorschaubild gespeichert.
- Medienbibliothek: alle Bilder mit Suche und Filtern, Hochladen ohne Arzneimittel, Zuordnen, Bearbeiten, Löschen.
- Stammdaten: Darreichungsformen (Gruppe, Abbildung, Schlüsselwörter für den Import), Wirkstoffe und Firmen
  (Umbenennen, Dubletten zusammenführen), ATC-Codes.
- Swissmedic-Import (nur Administration): Liste «Zugelassene Packungen» direkt von swissmedic.ch laden oder als Datei
  hochladen. Läuft im Hintergrund mit Protokoll je Lauf; gepflegte Bilder, Preise, Pharmacodes, SL, Notizen und
  korrigierte Formen bleiben erhalten; nicht mehr gelistete Arzneimittel werden «ausser Handel».
- Benutzer (Rollen Redaktion und Administration), eigenes Passwort, Protokoll aller Änderungen.

## Bilder und Beispieldaten

Eine leere Datenbank erhält beim ersten Deploy 152 von Hand erfasste Beispielarzneimittel (Tabletten, Tropfen,
Sirupe, Salben, Sprays, Injektionen, Pflaster, Inhalatoren …) mit Packungsabbildungen im Bucket
(`database/seed-data.ts`). Die Beispiele sind als solche gekennzeichnet, haben bewusst keine Zulassungsnummern,
GTIN oder Preise und lassen sich nach dem ersten Swissmedic-Import unter Verwaltung › Import entfernen.

Die Abbildungen sind Symbolbilder: schematische Packungen je Darreichungsform in der Farbe der ATC-Hauptgruppe
(`lib/packshot.ts`), deutlich als «Symbolbild» beschriftet. Fotos der Originalpackungen sind urheberrechtlich
geschützt und werden nicht mitgeliefert; sie werden in der Verwaltung hochgeladen und ersetzen das Symbolbild.
Arzneimittel ohne eigenes Bild (z. B. nach dem Import) zeigen ein aus ihren Angaben erzeugtes Symbolbild.

## Lokal starten

```bash
cp .env.example .env.local          # DATABASE_URL und MEDBASE_ADMIN_PASSWORD setzen
npm install
npm run db:migrate && npm run db:seed
npm run dev                         # http://localhost:3000, Verwaltung unter /admin (Konto „admin“)
```

Ohne Bucket-Variablen liegen Bilder in der Datenbank.

## Prüfen

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

`npm test` prüft GTIN, Normalisierung, Zerlegung der Swissmedic-Bezeichnungen, Erkennung der Darreichungsform, das
Symbolbild und das Lesen einer Swissmedic-Datei (`tests/fixtures/swissmedic-sample.xlsx`). Die CI führt alles mit
einer echten Postgres aus.

## Aufbau

| Pfad                   | Inhalt                                                          |
| ---------------------- | --------------------------------------------------------------- |
| `app/(site)/`          | Katalog und Verwaltung (gemeinsamer Rahmen mit Navigation)      |
| `app/anmelden/`        | Anmeldung                                                       |
| `app/api/`             | Bilder, Symbolbilder, Schnellsuche, Hochladen, Import, Zustand  |
| `app/actions/`         | Server-Aktionen der Verwaltung (mit Rechte- und Eingabeprüfung) |
| `app/styles/`          | Gestaltung nach CareCore                                        |
| `lib/`                 | Datenzugriff, Import, Bilder, Anmeldung                         |
| `database/migrations/` | Schema (Migrationen in Reihenfolge, je Transaktion)             |
| `database/seed.ts`     | Stammdaten, erstes Konto, Beispieldaten                         |

## Sicherheit

- Passwörter mit scrypt; Sitzungen als zufälliges Token (in der Datenbank nur der Hash), 12 h ohne Aktivität,
  höchstens 7 Tage. Nach fünf Fehlversuchen 15 Minuten Sperre.
- Jede Server-Aktion und Schnittstelle prüft Anmeldung und Rolle selbst; Uploads und Import prüfen die Herkunft der
  Anfrage. Alle Eingaben werden auf dem Server geprüft.
- Strenge Sicherheits-Header (CSP ohne fremde Quellen, kein Einbetten). Bilder werden aus dem privaten Bucket über
  Medbase ausgeliefert; SVG nur für selbst erzeugte Symbolbilder, mit eigener CSP.
