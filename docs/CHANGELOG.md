# Änderungsprotokoll

Alle nennenswerten Änderungen am Kurs und am Code. Neueste oben.
Format: Datum · Was · Warum (falls nicht offensichtlich).

## Unveröffentlicht

### Phase 1 – Gerüst (2026-10-12)
- Verzeichnisstruktur, `index.html`, CSS-Ebenen mit Design-Token, Schrift Lato lokal.
- Theme-Umschalter (dunkel/hell), Hash-Router mit allen Routen (Platzhalter), Fortschrittsspeicher.
- Startskripte für macOS, Windows (mit PowerShell-Ersatzserver) und Linux.

### Phase 2 – Inhaltsverarbeitung (2026-10-12)
- Parser für Kopfbereich, Markdown-Subset, Kapitel/Kurs/Glossar; Serializer in kanonische Form.
- Baustein-Registry; erste Bausteine info/tipp/achtung, aufklappen, quiz (Lesen/Schreiben/Prüfen).
- Prüflogik (`validate.js`), Prüfseite `pruefen.html`, Selbsttests `tests.html`.
- Eigener kleiner Python-Server (`tools/server.py`) mit `Cache-Control: no-cache`.

### Phase 3 – Kursoberfläche (2026-10-12)
- Startseite mit Zeitenmonitor-Liste und „Weiter, wo du aufgehört hast".
- Kapitelseiten mit Lernzielen, „Direkt zum Quiz", Freigabe-Hinweis für Sicherheitskapitel und Zurück/Weiter-Leiste.
- Sektoranzeige (dynamisch aus kurs.md), Glossar-Popover und Glossarseite, Einstellungen mit Zurücksetzen-Dialog.
- Fokus- und Titelmanagement bei jedem Seitenwechsel.

### Phase 4 – Interaktive Bausteine (2026-10-13)
- Neue Bausteine: karten, zuordnen, reihenfolge, szenario, hotspot, ordner (ARIA-Tree mit Suchaufgaben), teams, zeitstrahl, checkliste.
- Kommentierte Vorlage `js/blocks/_vorlage-baustein.js`.
- Parser- und Round-Trip-Tests für jeden Baustein (gültige und ungültige Beispiele).

### Phase 5 – Quiz, Fortschritt, Qualifying (2026-10-13)
- Kapitelquiz: Pool mit Zufallsauswahl, Sicherheitsfragen immer, sofortiges Feedback mit Erklärung, Ergebnis mit Links zum Nachlesen.
- Bestes Ergebnis bleibt; Sektor gelb (bestanden) bzw. lila (100 %); Versionserhöhung markiert „aktualisiert".
- Qualifying mit Startampel (überspringbar, ohne Animation bei „Bewegung reduzieren").

### Phase 6 – Zertifikat (2026-10-13)
- PDF-Zertifikat (A4 quer) mit jsPDF 4.2.1, Lato eingebettet, Logo, Sektorstreifen, Prüfcode und Pflichthinweis zur Sicherheitsunterweisung.
- Name wird erst beim Zertifikat abgefragt und bleibt im Browser.
- Druckansicht als Ersatz, falls jsPDF nicht geladen werden kann.

### Phase 7 – Editor (2026-10-13)
- `editor.html`: Baukasten mit Kursstruktur, Seiten-Arbeitsfläche, Eigenschaften und Live-Vorschau.
- Direktmodus (File System Access API, Ordner wird gemerkt) und Download-Modus.
- Schema-gesteuerte Formulare, Spezialeditoren für Quiz und Hotspot, Glossar-Editor, Bildimport.
- Quelltext-Ansicht; nicht lesbare Abschnitte bleiben erhalten.
- Rückgängig/Wiederholen (50 Schritte), Sicherungskopien in `content/_backup/`, Konfliktprüfung, Warnung beim Verlassen.
- Kapitel anlegen, umbenennen, duplizieren, umsortieren, deaktivieren, archivieren, wiederherstellen.
- Freigabe von Sicherheitskapiteln wird bei jeder Änderung zurückgesetzt; Vorschlag „Version erhöhen" bei Quizänderungen.

### Phase 8 – Inhalte (2026-10-13)
- Sechs Kapitel, Glossar mit 33 Begriffen, SVG-Platzhalter für Fahrzeug und Werkstattplan.
- Kapitel 6 „Dein Start" vollständig im Editor angelegt (Praxistest).
- Behoben: `[[Begriff|Text]]` in Bausteinen mit `|`-Trennern (Zeitstrahl, Lernkarten …) wurde getrennt bzw. beim Speichern maskiert.
- Behoben: Der Editor meldete unveränderte, aber anders formatierte Dateien als „ungespeichert" und hätte sie umformatiert.

### Phase 9 – Feinschliff und Barrierefreiheit (2026-10-13)
- Alle 56 Kursansichten ohne horizontales Scrollen bei 320 px, 640 px (200 % Zoom) und doppelter Schriftgröße.
- Automatische Prüfung aller Ansichten: genau eine h1, keine Sprünge in der Überschriftenhierarchie, benannte Bedienelemente, Alternativtexte, beschriftete Felder.
- Vollständige Kontrasttabelle (beide Themes) geprüft und in docs/ENTWICKLER.md dokumentiert.
- Sektorbeschriftung auf schmalen Handys ausgeblendet (lief am Rand aus dem Bild), favicon.ico ergänzt.

### Phase 10 – Dokumentation und Abschluss (2026-10-13)
- `docs/PFLEGE.md` (Pflege ohne Programmierkenntnisse), `docs/BAUSTEINE.md` (alle Bausteine mit Kopiervorlagen), `docs/ENTWICKLER.md` (Architektur, neue Bausteine, Kontraste, Entscheidungen, Grenzen).
- Abschlussprüfung gegen die Definition of Done; Betrieb aus einem Unterordner eines Standard-Webservers geprüft.

### Betrieb ohne Server (2026-10-13)
- Der Kurs, der Editor, die Prüfseite und die Selbsttests laufen jetzt per **Doppelklick** (`file://`) – nur HTML, CSS und JavaScript.
- Entfernt: Startskripte (`starten.command`, `.bat`, `.sh`) und die Server in `tools/` (Python, PowerShell).
- Code von ES-Modulen auf klassische Skripte umgestellt (`js/em.js`: `EM.define`/`EM.require`; Lade-Reihenfolge in `js/scripts.js`), weil Browser Module auf `file://` sperren.
- Neu: `content/inhalte.js` – vom Editor erzeugte Kopie der `.md`-Dateien für den Betrieb ohne Server. Der Editor erneuert sie beim Speichern und meldet, wenn sie veraltet ist. Auf dem Webspace werden weiter die `.md`-Dateien gelesen.
- Neu: „Projektordner einlesen" in Editor (Download-Modus, alle Browser) und Prüfseite.
- PDF-Schriften als Skript (`assets/fonts/pdf/lato-pdf.js`), Logo im PDF aus der Offline-Datei.
- Selbsttests für die Offline-Datei; 145 Tests grün per Doppelklick und über einen Webserver.

### GitHub Pages (2026-10-13)
- `.nojekyll` ergänzt: Ohne die Datei würde GitHub Pages die `.md`-Inhalte in HTML umwandeln.
- Sicherungskopien (`content/_backup/`) werden nicht mehr ins Repository übernommen.
- Anleitung zum Veröffentlichen mit GitHub Desktop und GitHub Pages in `docs/PFLEGE.md`.

### Kapitel Arbeitssicherheit ausführlich (2026-10-13)
- Kapitel 5 neu und ausführlich (16 Seiten, ca. 35 min, Version 2): Sicherheitszeichen, Schutzausrüstung, Hochvolt (600 V, nur Team HV), TSAL nach FS Rules 2026 (EV4.10, A6.9/A6.10), Low Voltage (nur nach Einweisung durch das Electrics-Team), Werkstattregeln, Ständerbohrmaschine, Bandschleifer, Flex mit Brandschutz, Carbonstaub, Harze, Ordnung, Notfall.
- Vor jedem interaktiven Element steht eine Erklärung in einfachen Worten („So funktioniert die Übung").
- Bilder aus der Teampräsentation (Arbeitssicherheit) in `assets/bilder/sicherheit/`, darunter eine anklickbare Übersicht der Sicherheitszeichen.
- Quiz: 7 Sicherheitsfragen (immer gestellt) und 7 zufällige aus 18 weiteren.
- Glossar: ESO, GHS, Low Voltage, Ready-to-drive, Tractive System, TSAL, Winkelschleifer; Hochvolt mit 600 V.
- Willkommenstext: Sektoren in beliebiger Reihenfolge, Hinweis auf direkten Start mit der Arbeitssicherheit.
- Behoben: Breite Tabellen verbreiterten auf dem Handy die ganze Seite statt nur seitlich zu scrollen.
- Das Kapitel bleibt `freigegeben: nein`, bis die Sicherheitsverantwortlichen es geprüft haben.

### Designsystem (2026-10-13)
- Gesamter Kurs, Editor, Prüfseite und PDF-Zertifikat an das Designsystem des Teams angepasst; Fehlendes im selben Stil ergänzt.
- Schrift: Überschriften Lato Bold, Unterüberschriften und Hervorhebungen Lato Medium (neu), Links im Fließtext kursiv. Lato Black entfernt.
- Buttons gelb, „gedrückt" lila mit gelber Schrift; Zweitaktionen dunkel mit gelbem Rand. Abgerundete Ecken überall.
- Symbol-Kacheln (lila, gelber Rand): Hamburgermenü/Kreuz, Haken, Plus/Minus, Pfeile; Editor-Palette ebenso.
- Schalter „Helles Design" im Stil des Designsystems; Statusbar über Kapitelseiten und Quizfragen (neu).
- Kästchen und Optionsfelder, Antworten, Sektoranzeige, Hotspots, Zeitstrahl, Kästen, Dialoge im selben Stil.
- Neu: `designsystem.html` (Übersicht aller Bedienelemente) und `docs/DESIGNSYSTEM.md`.

### Code aufgeräumt (2026-10-13)
- Ordnerstruktur nach Aufgaben: `js/pages/` (Einstieg je HTML-Seite), `js/core/`, `js/course/`; CSS in `css/base/`, `components/`, `blocks/`, `views/`, `pages/`, `editor/` – eine Datei pro Thema, je Seite eine Einstiegsdatei mit `@import`.
- Code-Stil nach den MDN-Richtlinien: Prettier-Formatierung (JS, CSS), ESLint- und Stylelint-Regeln im Projekt, alle Prüfungen ohne Befund; HTML, CSS und SVG W3C-valide.
- Benannte Funktionen als Funktionsdeklarationen, immer geschweifte Klammern, Kommentare als `//` bzw. JSDoc; jede Funktion auf oberster Ebene dokumentiert.
- VS-Code-Einstellungen (`.vscode/`, `.editorconfig`, `jsconfig.json`) und Übersicht „Wo finde ich was?" in der README.
- Aussehen und Verhalten unverändert (Bildschirmfotos vorher/nachher verglichen, 145 Selbsttests grün).
- Kapitel Arbeitssicherheit: Dauer auf 50 Minuten korrigiert (Schätzung des Editors).

### Robuster auf GitHub Pages (2026-10-13)
- Fehlt online eine `.md`-Datei (z. B. weil `.nojekyll` beim Hochladen über die Webseite verloren ging), liest der Kurs die Kopie in `content/inhalte.js` statt abzubrechen. Hinweis dazu in der Browser-Konsole.
- `docs/PFLEGE.md`: Hinweis, dass der Upload über die GitHub-Webseite Dateien mit Punkt am Anfang weglässt.
