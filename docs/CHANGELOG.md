# Änderungsprotokoll

Alle nennenswerten Änderungen am Kurs und am Code. Neueste oben.
Format: Datum · Was · Warum (falls nicht offensichtlich).


## Unveröffentlicht

### Text links, Grafik rechts; neues Teamfoto (2026-11-26)

- Folgt auf einen Text genau ein Bild, steht der letzte Textabschnitt (Überschrift + Absätze) ab 64rem Fensterbreite links und das Bild rechts. Darunter wie bisher untereinander. Umsetzung: `renderElements()` / `renderMediaSplit()` in `js/core/render.js`, Stil `.media-split` in `css/components/prose.css`.
- Neues Teamfoto auf „Willkommen im Team“ (Gruppenfoto vor der Werkstatt, unbeschnitten, 2000 px breit).

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

### Editor speichert direkt auf GitHub (2026-10-13)
- Neuer GitHub-Modus im Editor: Repository und Zugangsschlüssel eingeben, dann liest der Editor direkt aus GitHub und speichert jede Änderung als einen Commit – in jedem Browser und online. Kein Herunterladen, kein GitHub Desktop nötig.
- Konfliktprüfung, wenn auf GitHub inzwischen dieselbe Datei geändert wurde; Archivieren und Umbenennen funktionieren als Teil des Commits.
- Anleitung zum Zugangsschlüssel in `docs/PFLEGE.md`, Abschnitt 2.

### Sicherheitsunterweisung überarbeitet (2026-10-13)
- Inhalte nach Rückmeldung des Teams korrigiert: Atemschutz-Vollmaske bei Carbonstaub; TSAL dunkel = in der Regel sicher; nie vor, hinter oder neben dem Auto unter Spannung; Low Voltage 24 V; Ansprechpersonen (ESOs, Electrics Team Lead, Team Manufacturing, Projektleitung); Schraubstock festschrauben; Flex: Augen, feuerfeste Kleidung; Carbon nur draußen (Ausnahme Fräse); Harz kann beim Anmischen heiß werden; Drehstromstecker; Notfall mit Erste-Hilfe-Koffer, Rettungswagen einweisen, Stromunfall mit nicht leitendem Gegenstand. Werkstattplan entfernt. Kapitelversion 3.
- Quiz: Fragen angepasst, drei neue Fragen (Schraubstock, Harz anmischen, Augen beim Flexen).
- Sicherheitszeichen in vier Reihen, unter jeder Reihe ihre Erklärungen.
- „Weiter" erst nach richtig gelösten Übungen; Sicherheitsquiz erst nach allen Seiten.
- Neu: PDF-Nachweis Sicherheitsunterweisung mit Name, Datum und Zahl der Anläufe – zur Abgabe bei der Projektleitung.
- Willkommenstext neutral für reine Sicherheitsunterweisung und ganzes Onboarding.
- Klarstellung: Die Online-Unterweisung ist Teil der Sicherheitsunterweisung; maschinenbezogene Einweisungen erfolgen zusätzlich vor Ort. Ansprechpersonen (Teamleitung, Projektleitung) eingetragen; Hinweis, dass es im Verein keine festen Ersthelfer gibt. Kapitelversion 4.
- Feuerlöscher (Werkstatt, Push Pull Bar) eingetragen; Zertifikat wird wie der Nachweis von der Projektleitung von Hand unterschrieben (Name leer, Rolle Projektleitung). Keine offenen Platzhalter mehr.

### Drei neue Onboarding-Kapitel (2026-11-25)
- Neu, ausschließlich mit Inhalten aus der Präsentation „Einstein Onboarding AL27": **Wer ist Einstein Motorsport?** (Mitglieder, Formula Student, Meilensteine AL06–AL27, Rennwagen, AL26, AL27), **Die Saison und unser Team** (Saisonphasen, Saisonziele, Subteams, Projektleitung, Treffen, Campus-Karte) und **Slack, Kalender und deine ersten Schritte** (Konten, Slack-Kanäle, Google Kalender, Dateien und Werkzeuge, Starter-Checkliste).
- Der Slack-Einladungslink steht bewusst nicht im Kurs – er wird zusammen mit dem Onboarding-Link verschickt.
- Die früheren Platzhalter-Kapitel 01–04 und 06 liegen im Archiv (`content/_archiv/`).
- Seite „Unsere Meilensteine“ ist jetzt eine reine Infoseite: Zeitstrahl AL06–AL27 statt Bild mit Markierungen und Reihenfolge-Übung.

### Disziplinen, Slack-Anleitung, breiteres Layout (2026-11-25)
- Kapitel 1: „Was ist Formula Student?“ auf fünf Seiten aufgeteilt (Überblick, statische Disziplinen, zwei Seiten dynamische Disziplinen, Punkte mit Übung). Jede Disziplin hat eine eigene Vektorgrafik (`assets/bilder/onboarding/disziplinen/*.svg`).
- Kapitel 1: Leistung präzisiert – vier Motoren mit 4 × 32 kW, laut Reglement auf 80 kW Antriebsleistung gedrosselt.
- Kapitel 1: AL26-Ergebnisse im Verhältnis – Platz 35 von 523 (FS World Ranking EV, nach FSAE Italy, 6. September 2026), Platz 3 von 40 (Elektro-Gesamtwertung FS France 2026, offizielle Ergebnisliste v1.2), 3,507 s für 75 m.
- Kapitel 3: zwei neue Seiten „Slack einrichten“ – sieben Schritte nach der offiziellen Slack-Hilfe, mit Bildschirmfotos der Slack-Anmelde- und Download-Seite und vereinfachten Darstellungen (`assets/bilder/onboarding/slack/`), plus Reihenfolge-Übung.
- Layout: Inhaltsspalte so breit wie die Kopfleiste (72rem); auf großen Monitoren wächst alles mit (112,5 % ab 1600 px, 125 % ab 2240 px).
- Bilder werden nie beschnitten: volle Breite höchstens bis zur Spalte, Höhe höchstens 80 % des Fensters, Seitenverhältnis bleibt erhalten (auch bei Bildern mit Markierungen).

### Skidpad-Richtung, Bildreihen, Sprachschalter (2026-11-25)
- Skidpad-Grafik und -Text: zwei Runden rechts im Uhrzeigersinn, dann zwei Runden links gegen den Uhrzeigersinn (FS Rules 2026, D 4.2.1).
- Disziplin-Texte mit dem Regelwerk FS Rules 2026 abgeglichen und kurz präzisiert (Acceleration D 5, Autocross D 6, Endurance/Efficiency D 7, Business Plan S 2, Cost & Manufacturing S 3, Engineering Design S 4, 80 kW aus EV 2.2.1).
- Bildreihen: Bilder direkt hintereinander stehen nebeneinander (`renderElements()` in js/core/render.js, `.figure-row`).
- Fotos: hochauflösendes Streckenfoto für „Dynamisch“, Teamfoto ohne leeren Asphalt zugeschnitten.
- Neuer Sprachschalter „English“ in der Kopfleiste (js/ui/language.js): Übersetzung über die eingebaute Übersetzung des Browsers (Translator-API), sonst Anleitung für die Browser-Übersetzung.

### Design-Review PC-first (2026-11-25)
- Design-Team-Review (Swiss/Rams/Raster 8, PC-first): Inhaltsbreite ab 1600 px auf 84rem, neue Tokens für Primär-Hover und Startampel, einheitliche Fokusringe (Skip-Link, Ordner-Baustein), Abstände aufs 8er-Raster.
- Gesperrtes „Weiter“: Enter setzt den Fokus direkt auf die offene Übung.
- Sprachschalter: Fortschritt beim Laden des Sprachmodells wird für Screenreader angesagt; Hinweis am Schalter, wenn die gespeicherte Sprache nicht automatisch geladen werden kann.
- Schrift kompakter für Laptop und PC: Fließtext fest 16 px, Überschriften kleiner (Skala ca. 1,18), kein Mitwachsen der Schrift auf großen Monitoren mehr; dafür Inhaltsbreite ab 2240 px 96rem. Grafiken wieder höchstens 800 px breit.
- Reihenfolge-Übungen: Schritte lassen sich jetzt zusätzlich mit der Maus ziehen (per Touch über die Platznummer); Pfeilknöpfe bleiben für Tastatur.

### Code-Audit und Umbau für Wartbarkeit (2026-11-25)
- Prüfstand: ESLint (MDN-Regeln), Stylelint, Prettier und W3C-Validator ohne Fehler; 146 Selbsttests grün.
- Editor: Strg/Cmd+Z/Y in Eingabefeldern wieder normales Text-Rückgängig; `editor.js` aufgeteilt in `editor-save.js`, `editor-validation.js`, `editor-shortcuts.js`; Warnung beim Verlassen über Dirty-Flag.
- Editor-Mitte: `page-canvas.js` aufgeteilt in `canvas-elements.js`, `canvas-fields.js`, `canvas-dnd.js`; JSDoc in allen Editor-Dateien ergänzt.
- Selbsttests: `js/pages/tests.js` ist nur noch Runner, Tests liegen nach Bereichen in `js/tests/`.
- Reihenfolge: Ziehen als wiederverwendbare Hilfsfunktion `enablePointerReorder()` (block-utils.js); Fokus bleibt nach dem Ziehen erhalten.
- Sprachschalter: Beobachter wird beim Ausschalten getrennt, entfernte Knoten werden freigegeben, Cache begrenzt, keine Doppel-Übersetzungen, Fehler werden protokolliert.
- Benannte Konstanten statt fester Zahlen (Startampel, PDF-Nachweis, Editor-Timer, Live-Region), Begründungen an allen leeren `catch`-Blöcken, Sektor-Links mit `aria-label`.

### Weniger KI-Anmutung in Design und Texten (2026-11-25)
- Texte: weniger Gedankenstriche und Fettdruck, keine Floskeln, abwechslungsreiche Übungseinleitungen statt „So funktioniert die Übung:“, Abschlussseiten unterschiedlich benannt. Fakten, Quiz und Sicherheitsregeln unverändert.
- Design: Bausteine ohne Rahmen und mit kleiner Rundung, Hinweis- und Lernziel-Kästen mit scharfer Akzentkante, Bilder mit kleiner Rundung.
- Grafiken: keine doppelten Überschriften im Bild, Konstruktionszeichnung in Graphit statt Fremd-Blau, keine macOS-Fensterpunkte in den Slack-Skizzen.
