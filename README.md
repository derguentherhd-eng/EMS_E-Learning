# Rookie-Onboarding · Einstein Motorsport

Ein Onboarding-E-Learning für neue Mitglieder von **Einstein Motorsport**, dem Formula-Student-Team
der Technischen Hochschule Ulm. Sechs kurze Kapitel („Sektoren"), Quiz nach jedem Kapitel, eine
Abschlussrunde („Qualifying") und am Ende ein PDF-Zertifikat „Onboarding abgeschlossen".

- Läuft im Browser, auf dem Smartphone und am Rechner.
- Kein Konto, kein Server, kein Tracking. Der Fortschritt bleibt im Browser.
- Inhalte stehen in einfachen Textdateien (`content/`) und lassen sich ohne Programmierkenntnisse
  pflegen – von Hand oder mit dem eingebauten Editor.

## Schnellstart

1. Ordner `onboarding/` öffnen.
2. **`index.html` doppelklicken** – der Kurs öffnet sich im Browser.

Genauso per Doppelklick: `editor.html` (Editor, am besten in Chrome oder Edge), `pruefen.html`
(Prüfseite) und `tests.html` (Selbsttests). Es braucht keinen Server und keine Installation –
nur HTML, CSS und JavaScript.

Ohne Server liest der Kurs seine Inhalte aus `content/inhalte.js`, einer Kopie der `.md`-Dateien,
die der Editor beim Speichern automatisch erneuert. Auf einem Webspace liest er die `.md`-Dateien
direkt. Details: [docs/PFLEGE.md](docs/PFLEGE.md), Abschnitt 1.

**Online stellen:** über GitHub Pages (Branch `main`, Ordner `/ (root)`). Anleitung:
[docs/PFLEGE.md](docs/PFLEGE.md), Abschnitt 12. Die Datei `.nojekyll` muss erhalten bleiben.

## Dokumentation

| Datei | Für wen? |
|---|---|
| [docs/PFLEGE.md](docs/PFLEGE.md) | Alle, die Inhalte pflegen – ohne Programmierkenntnisse |
| [docs/BAUSTEINE.md](docs/BAUSTEINE.md) | Nachschlagewerk aller Bausteine mit Kopiervorlagen |
| [docs/DESIGNSYSTEM.md](docs/DESIGNSYSTEM.md) | Farben, Schrift, Bedienelemente – zum Ansehen: `designsystem.html` |
| [docs/ENTWICKLER.md](docs/ENTWICKLER.md) | Aufbau des Codes, neue Bausteine, Entscheidungen |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Was sich wann geändert hat |

## Lizenzen

- **Schrift Lato 2.015** (Regular, Italic, Medium, Bold, Bold Italic) – SIL Open Font License 1.1,
  © tyPoland Łukasz Dziedzic ([assets/fonts/OFL-Lato.txt](assets/fonts/OFL-Lato.txt)).
  Medium stammt aus dem offiziellen Web-Paket von latofonts.com (npm „lato-font" 3.0.0).
- **jsPDF 4.2.1** – MIT-Lizenz ([vendor/jspdf/LICENSE](vendor/jspdf/LICENSE)).
- **Logo** – Eigentum von Einstein Motorsport.
- **Bilder in `assets/bilder/sicherheit/`** – aus der Teampräsentation „GNTM 15.04.2026", Teil
  Arbeitssicherheit. Die Sicherheitszeichen sind genormte Symbole. Die Produktfotos (Werkzeuge,
  Trennscheiben) und das Plakat „Gefährliche Stoffe niemals in Getränkeflaschen!" (Suva) stammen von
  Dritten: **Nutzungsrechte vor einer öffentlichen Veröffentlichung klären** oder durch eigene Fotos
  aus der Werkstatt ersetzen.
