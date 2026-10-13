# Entwickler-Dokumentation

Für alle, die am Code arbeiten. Inhalte pflegen? Dann `PFLEGE.md`. Schreibweisen der Bausteine:
`BAUSTEINE.md`.

**Grundsätze:** Nur HTML, CSS und JavaScript – läuft per Doppelklick auf `index.html` (`file://`)
und auf jedem statischen Webspace. Kein Server, kein Framework, kein Build, kein `npm`. Einzige
Bibliothek: jsPDF (lokal in `vendor/jspdf/`). Keine externen Requests zur Laufzeit.
Inhalte stehen ausschließlich in `content/*.md`. Inhalte werden nie als HTML interpretiert.
Gestaltung nach dem Designsystem des Teams: `docs/DESIGNSYSTEM.md`, zum Ansehen `designsystem.html`.

---

## 1. Architektur und Datenfluss

```
content/*.md ──fetch (Webspace) / content/inhalte.js (file://) / Ordner──▶ loader.js / editor-main.js
                                              │ Text
                                              ▼
                       frontmatter.js + documents.js (Seiten, Elemente, Bausteine)
                                              │            └─▶ registry.js → <baustein>.parse()
                                              ▼
                                       Datenmodell
                 ┌────────────────────────────┼─────────────────────────────┐
                 ▼                            ▼                             ▼
     Kurs: views/* + render.js        validate.js                Editor: Formulare aus
     + <baustein>.render()            → pruefen.html              editor.fields, commit()
                                      → Editor (live)                       │
                                                                            ▼
                                                     serialize.js + <baustein>.serialize()
                                                                            │
                                                                            ▼
                                                     content/*.md (Direkt) bzw. Download
                                                     + content/inhalte.js (mirror.js)
```

Ein Modell, drei Verbraucher: Kurs, Prüfseite und Editor benutzen dieselben Module. Der Kurs
(`index.html`) lädt nie Code aus `js/editor/`.

### Datenmodell eines Kapitels (`documents.js`)

| Teil | Inhalt |
|---|---|
| `meta` | Kopfbereich; unbekannte Schlüssel bleiben erhalten |
| `preamble` | Elemente vor dem ersten `## ` (Warnung, wird nie verworfen) |
| `pages[]` | `{ title, elements[] }` – eine Seite pro `## ` |
| `quiz` | der `:::quiz`-Baustein (egal wo er steht; beim Schreiben ans Ende) |

Elementarten: `text` (Markdown-**Rohtext**, kein AST), `image` (Absatz nur aus `![…](…)`),
`block` (lesbarer Baustein mit `data`), `raw` (nicht lesbarer Abschnitt mit Originaltext und
Fehlermeldungen – wird Zeichen für Zeichen zurückgeschrieben).

### Skripte laden ohne Server

Chrome blockiert ES-Module (`import`/`export`) auf `file://`. Deshalb sind alle Dateien
**klassische Skripte** in einer Hülle `(function () { 'use strict'; … })();`:

```js
const { el } = EM.require('js/dom.js');            // statt import
EM.define('js/blocks/key-sentence.js', { default: definition });  // statt export
```

`js/em.js` stellt `EM.define`/`EM.require` bereit (meldet doppeltes oder zu frühes Laden mit
Klartext). `js/scripts.js` lädt die Dateien **in fester Reihenfolge** (Pakete `kern`, `kurs`,
`editor`); jede Datei muss nach allen stehen, die sie per `EM.require` benutzt. Die HTML-Seiten
binden nur `theme-init.js`, `em.js` und `scripts.js` ein (`data-pakete`, `data-start`).

**Inhalte ohne Server:** `fetch` ist auf `file://` ebenfalls gesperrt. `content/inhalte.js`
(`EM.inhalte = { erzeugt, kapitelOrdner, dateien }`) enthält eine Kopie aller `.md`-Dateien und
des Logo-SVGs; `scripts.js` lädt sie nur auf `file://`. `createDefaultReader()` in `loader.js`
wählt: `fetch` auf http(s), sonst die Kopie. Die Datei wird **nur vom Editor** erzeugt
(`js/content/mirror.js`), die `.md`-Dateien bleiben die einzige Quelle. Die PDF-Schriften liegen
aus demselben Grund als Skript vor (`assets/fonts/pdf/lato-pdf.js`, Base64), das Logo kommt im PDF
als Daten-URL aus der Kopie (ein Bild von der Platte würde das Canvas „verunreinigen").

## 2. Module

| Datei | Aufgabe |
|---|---|
| `js/em.js` | `EM.define`/`EM.require` – Modulsystem ohne ES-Module |
| `js/scripts.js` | Lade-Reihenfolge aller Skripte (Pakete), lädt auf `file://` `content/inhalte.js` |
| `js/main.js` | Einstieg Kurs: Speicher, Theme, Menü, Kurs laden, Sektoranzeige, Router |
| `js/router.js` | Hash-Routen (`parseRoute`), `navigate`, Hash-Bauer |
| `js/store.js` | Fortschritt in localStorage (Fallback Arbeitsspeicher) + reine Auswertungsfunktionen |
| `js/dom.js` | `el()`/`append()` – sicherer DOM-Bau, nur Textknoten |
| `js/render.js` | Markdown-AST und Elemente → DOM; `createBlockContext` |
| `js/theme-init.js` | Klassisches Skript: setzt `data-theme` vor dem ersten Zeichnen |
| `js/content/frontmatter.js` | Kopfbereich lesen/schreiben |
| `js/content/markdown.js` | Markdown → AST (Blöcke, Inline), `walkMarkdown`, `countWords` |
| `js/content/documents.js` | Kapitel, Kurs, Glossar zerlegen; Bausteinkopf; Sicherheitskapitel-Erkennung |
| `js/content/serialize.js` | Modell → kanonisches Kursdown |
| `js/content/loader.js` | Alle Inhaltsdateien laden (`createDefaultReader`, `createFetchReader`, `createFileListReader`), Bestehensgrenze |
| `js/content/mirror.js` | `content/inhalte.js` erzeugen (`buildMirrorScript`) und lesen |
| `js/content/validate.js` | Alle Prüfregeln, Bildsammlung, Zusammenfassung |
| `js/blocks/registry.js` | Liste aller Bausteine (Palette in dieser Reihenfolge) |
| `js/blocks/block-utils.js` | Helfer: Kopfzeile, Trenner, Einträge, Hash, Abschnittshülle |
| `js/blocks/*.js` | je ein Baustein (siehe Zuordnung unten) |
| `js/blocks/_vorlage-baustein.js` | kommentierte Vorlage (nicht eingebunden) |
| `js/quiz/quiz.js` | Ziehung, Bewertung, Fragenablauf, Ergebnis-Streifen |
| `js/certificate.js` | jsPDF und `assets/fonts/pdf/lato-pdf.js` per `<script>` laden, PDF zeichnen, Prüfcode, Dateiname |
| `js/ui/*.js` | Sektoranzeige, Glossar-Popover, Startampel, Theme, Symbole, Statusbar (`statusbar.js`) |
| `js/designsystem.js` | Logik von `designsystem.html` (Übersicht aller Bedienelemente) |
| `js/views/*.js` | eine Ansicht pro Route (`view-types.js` beschreibt die Schnittstelle) |
| `js/check-page.js` | Logik von `pruefen.html` (Quelle: Webspace, `inhalte.js` oder eingelesener Ordner; Bilder per `Image()`) |
| `js/tests.js` | Selbsttests für `tests.html` |
| `js/editor/*` | Editor (siehe Abschnitt 6) |

**Zuordnung Baustein → Modul:** info/tipp/achtung → `callouts.js` · aufklappen → `details.js` ·
karten → `flashcards.js` · zuordnen → `matching.js` · reihenfolge → `ordering.js` ·
szenario → `scenario.js` · hotspot → `hotspot.js` · ordner → `file-tree.js` · teams → `teams.js` ·
zeitstrahl → `timeline.js` · checkliste → `checklist.js` · quiz → `quiz-block.js`.

**CSS:** `reset.css` (deklariert die Ebenen `reset, tokens, base, layout, components, utilities`),
`tokens.css`, `base.css`, `layout.css`, `components.css` (inkl. `utilities`-Ebene), `blocks.css`,
`print.css` (nur Druck), `editor.css` (nur Editor), `designsystem.css` (nur `designsystem.html`). Eingebunden per `<link>`, kein `@import`.

**Generierte Dateien:** `content/inhalte.js` (vom Editor), `assets/fonts/pdf/lato-pdf.js` (einmalig
aus den TTF-Dateien erzeugt; bei Schriftwechsel neu erzeugen: Dateiname → Base64 in
`window.EM.pdfSchriften`).

## 3. Routen

| Hash | Ansicht |
|---|---|
| `#/` | Startseite |
| `#/kapitel/<id>` bzw. `#/kapitel/<id>/<n>` | Seite n (ab 1); `<id>` = Dateiname ohne `.md` |
| `#/kapitel/<id>/quiz` | Kapitelquiz |
| `#/glossar`, `#/glossar/<begriff>` | Glossar (optional zu einem Begriff gesprungen) |
| `#/qualifying` | Qualifying |
| `#/zertifikat` | Zertifikat |
| `#/einstellungen` | Einstellungen |
| sonst | „Seite nicht gefunden" |

Hashes ohne `#/` (z. B. `#main`) gehören nicht zum Routing. Nach jedem Wechsel: `document.title`
setzen, Fokus auf die `<h1>` (bzw. `ViewResult.focus`).

## 4. Speicherformat (`localStorage['em-onboarding:v1']`)

```json
{
  "schema": 1,
  "last": "#/kapitel/03-unsere-subteams/4",
  "visited": { "03-unsere-subteams": [1, 2, 3, 4] },
  "results": { "01-formula-student": { "version": 1, "best": 100, "passed": true, "date": "2026-10-13" } },
  "checklists": { "06-dein-start": { "1frcozw": true } },
  "theme": "system",
  "qualifying": { "passed": true, "best": 88, "courseVersion": "1.0", "date": "2026-10-13" },
  "name": ""
}
```

- Schlüssel sind Kapitel-IDs (Dateiname ohne `.md`). Daten zu deaktivierten Kapiteln werden
  ignoriert, nie gelöscht.
- `results`: Ein besseres Ergebnis ersetzt ein schlechteres („bestanden" schlägt „nicht bestanden",
  dann zählt der Prozentwert). Ein Ergebnis einer anderen Kapitelversion wird immer ersetzt.
- Checklisten-Haken hängen am Text-Hash des Eintrags (FNV-1a).
- Jeder Zugriff in `try/catch`. Ohne Speicher läuft alles im Arbeitsspeicher, die Fußzeile zeigt
  einen Hinweis. Beschädigte Daten repariert `normalizeState()`.

## 5. Neuen Baustein anlegen – Schritt für Schritt

Beispiel: ein Baustein `merksatz` (ein hervorgehobener Satz mit Quelle).

1. **Vorlage kopieren:** `js/blocks/_vorlage-baustein.js` → `js/blocks/key-sentence.js`. Die Vorlage
   ist bereits ein vollständiger `merksatz`-Baustein mit Erklärungen an jeder Stelle.
2. **Ausfüllen:**
   - `name`: Name im Inhalt (`merksatz`), `interactive`: zählt er als Interaktion?
   - `parse(raw)`: `raw.title`, `raw.attrs`, `raw.lines` (`{text, line}`) → `{ data, errors }`.
     Fehler mit `severity: 'fehler'` sind Syntaxfehler → Abschnitt bleibt als „nicht lesbar" erhalten.
     Helfer: `blockError(raw, zeile, meldung, lösung, schwere)`.
   - `validate(data, raw)` (optional): inhaltliche Prüfung, z. B. leere Felder.
   - `render(data, context)`: DOM nur mit `el()` bauen. `context.renderInline`, `renderMarkdown`,
     `uid`, `store`, `chapterId`, `random`. Für Überschrift + `<section>`: `blockSection()`.
   - `serialize(data)`: mit `formatHeader(name, titel, [[attr, wert]])` und `formatBlock(kopf, zeilen)`.
     **Muss zu `parse` passen:** `parse(serialize(data))` ergibt wieder `data`.
   - `editor`: `label`, `description` (ein Satz), `icon` (Pfad), `createDefault()`, `fields`.
     Feldtypen: `text`, `markdown`, `number`, `select` (`options`), `boolean`, `image`,
     `list` (`itemFields`, `itemLabel`, `min`). Verschachtelte Werte per Punkt (`fields.kurz`),
     Listen aus Texten mit genau einem Feld `value`. Spezialeditoren: `customEditor: 'quiz' | 'hotspot'`.
   - `images(data)` (optional): Bildpfade, damit die Prüfseite ihre Existenz prüft.
3. **Eintragen:** den Pfad bei `EM.define` ganz unten anpassen; in `js/scripts.js` im Paket `kern`
   `'js/blocks/key-sentence.js'` **vor** `'js/blocks/registry.js'` ergänzen; in
   `js/blocks/registry.js` `const { default: keySentence } = EM.require('js/blocks/key-sentence.js');`
   und `keySentence` in `BLOCKS` ergänzen. → Der Baustein wird im Kurs dargestellt, geprüft und erscheint
   **automatisch** in der Editor-Palette mit Formular.
4. **CSS:** Abschnitt in `css/blocks.css`, Klassen nach BEM (`.key-sentence__text`).
5. **Symbol:** `assets/icons/merksatz.svg` als Kachel im Designsystem-Stil: 32×32, lila Fläche
   `#534495` mit `rx="6"` und gelbem Rand, darin das Symbol in Gelb `#ffed00` mit runden Enden
   (Vorlage: eine der vorhandenen Dateien kopieren).
6. **Tests:** in `js/tests.js` unter `BLOCK_SAMPLES` ein gültiges und ggf. ungültiges Beispiel.
   `tests.html` erzeugt daraus Parser-, Round-Trip- und Schema-Tests.
7. **Doku:** Abschnitt in `docs/BAUSTEINE.md` (Zweck, Didaktik, Editorname, Kopiervorlage, Fehler)
   und Eintrag in der Übersichtstabelle.

## 6. Editor

**Dateien:** `editor-main.js` (Zustand, `commit()`, Laden, Speichern, Kapitel-Operationen,
Tastenkürzel), `workspace.js` (Dateizugriff), `course-tree.js` (links), `page-canvas.js` (Mitte und
Eigenschaften), `field-renderers.js` (Formulare aus Schemas), `quiz-editor.js`, `hotspot-editor.js`,
`glossary-editor.js`, `image-import.js`, `preview.js`, `history.js`, `dialogs.js`, `names.js`.

**Zustand:** `state.doc = { course, glossary, chapters[] }`. Jedes Kapitel ist
`{ file, location: 'kapitel'|'archiv', origin, model }`; `origin` ist der Ort beim Laden
(`null` = neu). Daraus ergibt `collectChanges()` beim Speichern, was geschrieben, umbenannt oder
verschoben wird. Archivieren, Umbenennen und Wiederherstellen sind dadurch normale, rückgängig
machbare Modelländerungen; die Dateien werden erst beim Speichern bewegt.

**`commit(mutate, options)`:** Schnappschuss (`structuredClone`) in den Verlauf → Änderung →
Freigabe-Regel → betroffene Bereiche neu zeichnen. `source` nennt den Bereich, in dem gerade getippt
wird (bleibt stehen, damit der Fokus nicht verloren geht). `coalesce` bündelt Tippen zu einem Schritt.

**Änderungserkennung:** Eine Datei gilt als geändert, wenn ihr serialisiertes Modell von der
**kanonischen Fassung beim Laden** abweicht – nicht schon, wenn sie von Hand anders formatiert wurde.
Unveränderte Dateien werden also nie umformatiert.

**Direktmodus:** `showDirectoryPicker()`, Ordner-Handle in IndexedDB (`em-onboarding-editor`),
beim nächsten Start `queryPermission`/`requestPermission`. Chrome/Edge, auch auf `file://`.
**Download-Modus:** lesen per `<input type="file" webkitdirectory>` („Projektordner einlesen",
`createFolderWorkspace`) oder – nur auf http(s) – per `fetch`; speichern per Download mit
Zielordner. Erkennung per Feature-Detection (`supportsDirectAccess()`), nie per Browsername.

**Offline-Datei:** Beim Laden liest der Editor `content/inhalte.js` mit. `collectChanges()` hängt
eine Änderung „Offline-Datei" an, wenn die aus den (neuen) `.md`-Texten erzeugte Kopie vom
gelesenen Stand abweicht – also auch nach Änderungen von Hand. Im Direktmodus schreibt
`writeMirrorFromDisk()` sie nach allen anderen Dateien aus dem tatsächlichen Plattenstand.

**Sicherungskopien:** Beim ersten Speichern einer bestehenden Datei pro Sitzung wird die Fassung
auf der Platte nach `content/_backup/<name>-<JJJJ-MM-TT-HHMM>.md` geschrieben.
**Konfliktprüfung:** vor dem Schreiben `lastModified` mit dem Ladezeitpunkt vergleichen; bei
Abweichung fragt der Editor (überschreiben → andere Fassung landet in `_backup/`).
**Verschieben:** Kopie anlegen, prüfen, erst dann Original entfernen.

**Vorschau:** `<iframe srcdoc>` mit den Kurs-CSS-Dateien; gerendert wird mit den echten Ansichten
aus `js/views/` und einem Speicher im Arbeitsspeicher. Links im iframe navigieren den Editor.

## 7. Kanonische Form des Serializers

Der Editor vereinheitlicht die Formatierung **geänderter** Dateien:

- Kopfbereich: bekannte Felder in fester Reihenfolge (`CHAPTER_KEYS`, `COURSE_KEYS` in
  `documents.js`), unbekannte danach in Originalreihenfolge. Leere Listen als `schluessel:`.
- Genau eine Leerzeile zwischen allen Elementen und vor jeder `## `-Seite; Datei endet mit einem
  Zeilenumbruch. Mehrere Leerzeilen in Textabschnitten werden zu einer.
- Bausteinkopf: Attribute in Schema-Reihenfolge; Werte ohne Sonderzeichen ohne Anführungszeichen
  (`anzahl=5`), sonst mit (`bild="assets/…"`).
- Quiz immer am Kapitelende. Antworten als `- [x]`/`- [ ]`, Erklärung einzeilig.
- `|` in |-getrennten Zeilen wird als `\|` geschrieben – außer innerhalb von `[[…|…]]`.
- Nicht lesbare Abschnitte (`raw`) unverändert.

Garantie (getestet für jeden Baustein und jede Datei in `content/`):
`parse(serialize(parse(text)))` ist inhaltsgleich zu `parse(text)`; zweimal geschrieben ergibt
denselben Text.

## 8. Geprüfte Kontrastwerte

Berechnet mit der WCAG-2.x-Formel. Anforderungen: Text ≥ 4,5:1, Grafik/Bedienelemente ≥ 3:1.

| Bereich | Vordergrund | Hintergrund | Kontrast |
|---|---|---|---|
| Dunkel | Text #f2f2f2 | bg #1e1e1e / surface #2a2a2a / #333333 | 14,89 / 12,82 / 11,29 ✓ |
| Dunkel | muted #b8b8b8 | bg / surface / #333333 | 8,40 / 7,24 / 6,37 ✓ |
| Dunkel | Link Gelb #ffed00 | bg / surface | 13,79 / 11,87 ✓ |
| Dunkel | Ränder #8a8a8a | bg / surface | 4,83 / 4,16 ✓ (UI) |
| Dunkel | success #6fdc8c / error #ff8a80 | surface | 8,40 / 6,29 ✓ |
| Dunkel | success / error | eigener Hintergrund (#1f3a27 / #4a2220) | 7,26 / 5,97 ✓ |
| Dunkel | Text | success-bg / error-bg / todo-bg | 11,08 / 12,17 / 11,09 ✓ |
| Hell | Text #1e1e1e | bg #f6f6f3 / #ffffff / #ecece7 | 15,40 / 16,67 / 14,07 ✓ |
| Hell | muted #575757 | bg / surface / #ecece7 | 6,67 / 7,23 / 6,10 ✓ |
| Hell | Link Lila #534495 | bg / surface | 7,38 / 7,99 ✓ |
| Hell | Ränder #767676 | bg / surface | 4,20 / 4,54 ✓ (UI) |
| Hell | Fokus #1e1e1e | bg | 15,40 ✓ (UI) |
| Hell | success #1d6b34 / error #b3261e | surface | 6,55 / 6,54 ✓ |
| Hell | success / error | eigener Hintergrund (#e3f3e7 / #fbe5e3) | 5,69 / 5,42 ✓ |
| Hell | Text | success-bg / error-bg / todo-bg | 14,48 / 13,83 / 15,18 ✓ |
| Hell | Rand primärer Button #000 | bg | 19,40 ✓ (UI) |
| Beide | Schwarz auf Gelb | | 17,37 ✓ |
| Beide | #1E1E1E auf Gelb (Buttons, Chips) | | 13,79 ✓ |
| Beide | Weiß auf Lila | | 7,99 ✓ |
| Beide | Gelb auf Lila („gedrückt", Symbol-Kacheln) | | 6,61 ✓ |
| Dunkel | Lila-Kachel auf #1E1E1E | | 2,09 – Kachel über gelben Rand erkennbar (13,79 ✓ UI) |
| Hell | Lila-Kachel / Kästchenrand auf Hell | bg / surface | 7,38 / 7,99 ✓ (UI) |
| Beide | Kopfleiste Weiß / #b8b8b8 auf Schwarz | | 21,00 / 10,59 ✓ |
| Beide | Fokus Gelb auf Schwarz | | 17,37 ✓ (UI) |
| Sektor | offen: Rand #5a5a5a auf Schwarz | | 3,04 ✓ (UI); Weiß auf #1E1E1E 16,67 ✓ |
| Sektor | bestanden Gelb auf Schwarz | | 17,37 ✓; Schrift #1E1E1E 13,79 ✓ |
| Sektor | Bestzeit Lila auf Schwarz | | 2,63 – ausgeglichen durch gelben Rand (17,37), gelbe Schrift (6,61), Sternsymbol und Text |
| Editor | Palettensymbol: Kachel mit gelbem Rand | Dunkel / Hell | 13,79 / Lila-Fläche 7,38 ✓ (UI) |

Nicht verwendet (und verboten): Gelb als Text auf Hell (1,21:1), Lila als Text auf Dunkelgrau
(2,09:1). Rot (#ff2a1f) erscheint nur in der Startampel als Dekoration (`aria-hidden`).

## 9. Formatierungsregeln

- 2 Leerzeichen Einrückung, Semikolons, einfache Anführungszeichen, ca. 100 Zeichen pro Zeile
  (lange Meldungstexte dürfen länger sein).
- `const` vor `let`, nie `var`; strikte Gleichheit; keine Globals außer `window.EM` (Modulsystem, Offline-Inhalte, PDF-Schriften) und `window.jspdf`.
- Bezeichner Englisch, Kommentare/Doku/Bausteinnamen Deutsch.
- Jede Datei hat einen Kopfkommentar mit „Wenn du hier etwas ändern willst …". Exportierte und
  nicht-triviale Funktionen haben JSDoc. Kommentare erklären das Warum.
- CSS: BEM-Klassen, logische Eigenschaften, alle Werte aus Token, `!important` nur in `utilities`.
- Keine Inline-Event-Handler, keine Inline-Styles in HTML. Dynamische Positionen (Hotspot, Popover,
  Vorschau-Skalierung) werden per JavaScript als CSS-Variablen gesetzt.

## 10. Tests und Prüfungen

- `tests.html`: Selbsttests ohne Framework (Frontmatter, Markdown inkl. Escaping, Renderer, Router,
  jeder Baustein mit Round-Trip und Schema, alle Inhaltsdateien, Quiz-Bewertung, Fortschritt,
  Zertifikat, Dateinamen, Verlauf).
- `pruefen.html`: Inhaltsprüfung.
- HTML/CSS/SVG wurden mit dem Nu Html Checker (lokal, `vnu`) geprüft.
- **Manuell zu prüfen** (nicht automatisiert): Bedienung mit einem echten Screenreader (NVDA,
  VoiceOver), Editor-Download-Modus in Firefox und Safari, Direktmodus mit einem echten Ordner in
  Chrome/Edge, `prefers-reduced-motion` (Startampel ohne Animation, Lernkarten ohne Drehung),
  Druck des Ersatz-Zertifikats.

## 11. Entscheidungen

| Entscheidung | Begründung |
|---|---|
| Projekt im Unterordner `onboarding/`, Git-Repo darin | wie in der Spezifikation (B3), Ordner ist in sich vollständig |
| Schrift ausschließlich **Lato** (lokal, subsettet), PDF bettet Lato-TTF ein | Vorgabe des Teams; Umlaute im PDF korrekt |
| Gestaltung nach dem **Designsystem des Teams**; Fehlendes im selben Stil ergänzt (`docs/DESIGNSYSTEM.md`) | einheitliches Erscheinungsbild; Erweiterungen sind dokumentiert und in `designsystem.html` sichtbar |
| Lato Medium (500) aus dem offiziellen Lato-2.015-Paket ergänzt, Lato Black entfernt | Designsystem nutzt Medium für Unterüberschrift und Hervorhebung, Bold für Überschriften |
| Schalter-Knopf „An" links | genau wie im Designsystem; umkehrbar über zwei CSS-Variablen |
| Richtig/Falsch zusätzlich grün/rot | Lernkontext; Bedeutung trägt immer auch Symbol und Text |
| Kopfleiste und Sektoranzeige in beiden Themes **schwarz** | Logo ist einfarbig gelb (auf Weiß unsichtbar); wirkt wie ein Zeitenmonitor |
| `js/theme-init.js` synchron im `<head>` | alle anderen Skripte laufen verzögert → sonst kurzes Aufblitzen im falschen Theme; Inline-Skripte verboten |
| Klassische Skripte mit `EM.define`/`EM.require` statt ES-Modulen | Vorgabe „Doppelklick auf index.html": Chrome sperrt Module und `fetch` auf `file://` |
| `content/inhalte.js` als erzeugte Kopie | einzige Möglichkeit, ohne Server Text nachzuladen; `.md` bleibt Quelle, Editor hält die Kopie aktuell, auf dem Webspace unbenutzt |
| Kein Server, keine Startskripte (früher `tools/server.py`, `starten.*`) | Vorgabe: nur HTML, CSS, JavaScript |
| `.nojekyll` im Projektordner | GitHub Pages würde sonst `.md`-Dateien mit Kopfbereich in HTML umwandeln und Dateien/Ordner mit `_` (z. B. `_vorlage-kapitel.md`) weglassen |
| `##` → `<h1>` der Ansicht, `###` → `<h2>` | genau eine `<h1>` pro Bildschirm |
| Ergänzungen zu B3: `js/render.js`, `js/views/`, `js/dom.js`, `js/content/documents.js`, `js/check-page.js`, `js/tests.js`, `js/editor/names.js`, `js/editor/dialogs.js`, `assets/icons/`, `js/em.js`, `js/scripts.js`, `js/content/mirror.js`, `content/inhalte.js`, `favicon.ico` | kleinste saubere Aufteilung; Inhalte und Code bleiben getrennt |
| Prüfseite: „Projektordner einlesen" bzw. `kapitelOrdner` aus `inhalte.js` | statische Server und `file://` listen keine Ordner; Hinweis, wenn nicht möglich |
| Freigabe-Hinweis als Systemhinweis für jedes Kapitel mit `freigegeben: nein` | kein Kursinhalt im Code; verschwindet bei `ja` ohne weitere Pflege |
| Sicherheitskapitel = Kapitel mit Feld `freigegeben` | keine Kapitelnamen im Code |
| Prozent = richtige / gestellte Fragen, abgerundet; Mehrfachauswahl nur exakt richtig | einfach und erklärbar; 79,9 % wird nie als 80 % angezeigt |
| Neuer Versuch bevorzugt andere Fragen | „beim nächsten Versuch andere Fragen" |
| Qualifying: erst eine Frage je Kapitel, dann zufällig; nie mehr als der Pool hergibt | gemischtes Abfragen über alle Sektoren |
| Qualifying frei = alle aktiven Kapitel in **aktueller Version** bestanden; Zertifikat = Qualifying mit aktueller `kursversion` | Versionserhöhung wirkt, ohne bestandene Zertifikate grundlos zu sperren |
| Fortschritt am Dateinamen | einfach; Umbenennen setzt den Fortschritt dieses Kapitels zurück (Editor warnt) |
| Checklisten-Haken am Text-Hash | Umsortieren behält Haken |
| Blöcke `zuordnen` (`| Erklärung`), `reihenfolge` (`> Erklärung`), `teams` (`bereich`, `bild-alt`) erweitert | Feedback „warum", Filter, Barrierefreiheit |
| `ordner` als flache Liste mit Tiefe im Modell | im Editor ohne verschachtelte Formulare bearbeitbar |
| Leere Bildpfade bleiben Bild-Elemente, die Prüfung meldet sie | unfertige Elemente aus dem Editor gehen beim Speichern nicht verloren |
| Editor-Vorschau im `iframe` mit `srcdoc` | Media Queries greifen; keine zusätzliche HTML-Datei |
| Kapiteloperationen (archivieren, umbenennen) als Modelländerung, Dateien bewegen erst beim Speichern | Rückgängig funktioniert; nichts wird ohne Kopie entfernt |
| Startampel rot | eine Startampel ist rot; einzige Farbe außerhalb des CD, rein dekorativ |
| jsPDF 4.2.1, Kompression an | aktuelle stabile Version (17.03.2026); ca. 70 KB statt 2 MB |

## 12. Bekannte Grenzen

- **Prüfcode** auf dem Zertifikat: FNV-1a über Name, Datum und Kursversion, Crockford-Base32.
  **Nicht fälschungssicher** – jeder kann ihn mit diesem Code nachrechnen. Für echte Nachweise
  bräuchte es einen Server mit Signatur.
- **Fortschritt im localStorage:** gilt nur für diesen Browser auf diesem Gerät. Browserdaten löschen,
  privates Fenster oder Gerätewechsel = Neustart. Kein Konto, kein Abgleich.
- **Zertifikat** ist keine Sicherheitsunterweisung (steht auf jedem PDF).
- **Editor-Direktmodus** nur in Chromium-Browsern (Chrome, Edge). Firefox und Safari:
  Download-Modus; dort kann der Editor keine Dateien verschieben (Archivieren/Umbenennen erledigt
  man nach Anleitung im Dateimanager).
- **Veraltete Offline-Datei:** Nach Änderungen von Hand an `.md`-Dateien zeigt der Doppelklick-Kurs
  den alten Stand, bis der Editor einmal geöffnet (Ordner gewählt) und gespeichert wurde. Die
  Prüfseite meldet dann den alten Stand, außer man liest den Ordner ein.
- **Ordnerliste auf der Prüfseite** auf dem Webspace nicht verfügbar (dort kein Ordnerlisting).
- **Mehrbenutzerbetrieb** im Editor gibt es nicht; die Konfliktprüfung erkennt nur, dass eine Datei
  zwischenzeitlich geändert wurde.
- **Popover-Positionierung** per JavaScript (CSS Anchor Positioning ist noch nicht überall verfügbar);
  das Popover schließt beim Scrollen.
