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
2. Startskript doppelklicken:
   - **Mac:** `starten.command` (beim ersten Mal: Rechtsklick → „Öffnen")
   - **Windows:** `starten.bat`
   - **Linux:** `starten.sh`
3. Der Browser öffnet den Kurs unter `http://localhost:8765/`.
   - Editor: `http://localhost:8765/editor.html` (am besten in Chrome oder Edge)
   - Prüfseite: `http://localhost:8765/pruefen.html`
   - Selbsttests: `http://localhost:8765/tests.html`

Ein Doppelklick auf `index.html` funktioniert **nicht**: Browser verbieten Seiten, die direkt
von der Festplatte geöffnet werden, das Nachladen der Inhaltsdateien. Deshalb gibt es die
Startskripte. Sie brauchen Python 3 (Windows kommt notfalls ohne aus).

## Dokumentation

| Datei | Für wen? |
|---|---|
| [docs/PFLEGE.md](docs/PFLEGE.md) | Alle, die Inhalte pflegen – ohne Programmierkenntnisse |
| [docs/BAUSTEINE.md](docs/BAUSTEINE.md) | Nachschlagewerk aller Bausteine mit Kopiervorlagen |
| [docs/ENTWICKLER.md](docs/ENTWICKLER.md) | Aufbau des Codes, neue Bausteine, Entscheidungen |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Was sich wann geändert hat |

## Lizenzen

- **Schrift Lato** – SIL Open Font License 1.1, © tyPoland Łukasz Dziedzic
  ([assets/fonts/OFL-Lato.txt](assets/fonts/OFL-Lato.txt)).
- **jsPDF 4.2.1** – MIT-Lizenz ([vendor/jspdf/LICENSE](vendor/jspdf/LICENSE)).
- **Logo** – Eigentum von Einstein Motorsport.
