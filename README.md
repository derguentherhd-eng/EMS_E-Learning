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

## In VS Code arbeiten

Den Ordner **`onboarding/`** in VS Code öffnen („Datei → Ordner öffnen…"). VS Code schlägt dann
vier Erweiterungen vor (Prettier, ESLint, Stylelint, EditorConfig) – annehmen. Danach wird beim
Speichern automatisch einheitlich formatiert. HTML wird von Hand formatiert.

### Wo finde ich was?

```text
onboarding/
├── index.html            Kurs              → css/index.css         + js/pages/index.js
├── editor.html           Editor            → css/editor.css        + js/pages/editor.js
├── pruefen.html          Prüfseite         → css/pruefen.css       + js/pages/pruefen.js
├── tests.html            Selbsttests       → css/tests.css         + js/pages/tests.js
├── designsystem.html     Designsystem      → css/designsystem.css  + js/pages/designsystem.js
│
├── content/              INHALTE (Kursdown-Dateien) – hier wird der Kurs gepflegt
│   ├── kurs.md, glossar.md, kapitel/*.md
│   └── inhalte.js        automatisch erzeugte Kopie für den Doppelklick-Start (nicht bearbeiten)
│
├── css/
│   ├── index.css …       Einstiegsdateien: je Seite eine Liste von @import
│   ├── base/             Ebenen, Schrift, Design-Token, HTML-Elemente, Seitengerüst, Hilfsklassen
│   ├── components/       Bedienelemente: Buttons, Symbol-Kacheln, Schalter, Statusbar, Kopfleiste …
│   ├── blocks/           je Baustein eine Datei (gleiche Namen wie in js/blocks/)
│   ├── views/            Ansichten des Kurses: Startseite, Kapitel, Quiz, Glossar, Zertifikat, Druck
│   ├── pages/            Teile nur für eine Seite (Prüfseite, Designsystem)
│   └── editor/           Editor: Gerüst, Kursstruktur, Arbeitsfläche, Formulare, Vorschau …
│
├── js/
│   ├── pages/            Einstieg je HTML-Seite (hier beginnt man beim Lesen)
│   ├── core/             Grundlagen: Modulsystem (em.js), Lade-Reihenfolge (scripts.js), DOM,
│   │                     Router, Speicher, Darstellung
│   ├── content/          Kursdown lesen, prüfen und schreiben
│   ├── blocks/           je Baustein eine Datei + registry.js (Liste aller Bausteine)
│   ├── views/            je Kurs-Ansicht eine Datei (Startseite, Kapitel, Quiz …)
│   ├── course/           Quiz-Ablauf und PDF-Zertifikat
│   ├── ui/               kleine Oberflächenteile: Symbole, Schalter, Sektoranzeige, Glossar …
│   └── editor/           Bausteine des Editors
│
├── assets/               Bilder, Schriften, Symbole, Logo
├── vendor/jspdf/         fremde Bibliothek für das PDF (nicht verändern)
└── docs/                 Dokumentation (siehe unten)
```

**Faustregeln:** Neue Skriptdatei → in `js/core/scripts.js` eintragen. Neue CSS-Datei → in die
passende Einstiegsdatei `css/*.css` per `@import` eintragen. Jede Datei beginnt mit einem Kommentar:
wozu sie da ist, womit sie zusammenspielt und „Wenn du hier etwas ändern willst …".

**Code-Stil:** nach den MDN-Richtlinien (developer.mozilla.org) – formatiert mit Prettier, geprüft
mit ESLint und Stylelint, HTML/CSS mit dem W3C-Validator. Details: [docs/ENTWICKLER.md](docs/ENTWICKLER.md).

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
