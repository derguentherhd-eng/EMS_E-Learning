# Pflege-Guide: Inhalte bearbeiten ohne Programmierkenntnisse

Dieser Guide ist für alle, die den Onboarding-Kurs von Einstein Motorsport pflegen – auch ohne
Programmierkenntnisse. Der **Editor** ist der empfohlene Weg. Bei jedem Thema steht zusätzlich,
wie es **von Hand** in den Textdateien geht. Beide Wege sind gleichwertig: Was der Editor speichert,
kannst du im Texteditor lesen, und was du von Hand schreibst, öffnet der Editor wieder.

**Inhalt**

1. [In 2 Minuten startklar](#1-in-2-minuten-startklar)
2. [Der Editor in 5 Minuten](#2-der-editor-in-5-minuten)
3. [Ich will einen Text ändern](#3-ich-will-einen-text-ändern)
4. [Ich will ein Element einfügen, verschieben oder entfernen](#4-ich-will-ein-element-einfügen-verschieben-oder-entfernen)
5. [Ich will eine Quizfrage hinzufügen](#5-ich-will-eine-quizfrage-hinzufügen)
6. [Ich will ein Bild austauschen](#6-ich-will-ein-bild-austauschen)
7. [Ich will ein Kapitel anlegen, umsortieren, deaktivieren, archivieren oder wiederherstellen](#7-kapitel-anlegen-umsortieren-deaktivieren-archivieren-wiederherstellen)
8. [Hilfe, ich habe etwas kaputt gemacht](#8-hilfe-ich-habe-etwas-kaputt-gemacht)
9. [Prüfseite benutzen und Meldungen verstehen](#9-prüfseite-benutzen-und-meldungen-verstehen)
10. [Wann erhöhe ich `version` und `kursversion`?](#10-wann-erhöhe-ich-version-und-kursversion)
11. [Sicherheitskapitel: Freigabeprozess](#11-sicherheitskapitel-freigabeprozess)
12. [Veröffentlichen](#12-veröffentlichen)
13. [Saisonwechsel-Checkliste](#13-saisonwechsel-checkliste)
14. [Häufige Fehler und ihre Lösung](#14-häufige-fehler-und-ihre-lösung)
15. [Zuständigkeiten](#15-zuständigkeiten)

---

## 1. In 2 Minuten startklar

1. Öffne den Ordner `onboarding/`.
2. **Doppelklicke `index.html`** – der Kurs öffnet sich im Browser. Fertig.

Es braucht kein Programm, keinen Server und keine Installation. Die anderen Seiten öffnest du
genauso per Doppelklick:

| Was | Datei |
|---|---|
| Kurs | `index.html` |
| Editor | `editor.html` (am besten in Chrome oder Edge) |
| Prüfseite | `pruefen.html` |
| Selbsttests | `tests.html` |

**Die Datei `content/inhalte.js`.** Browser erlauben einer Seite, die direkt von der Festplatte
geöffnet wird, nicht, andere Textdateien nachzuladen. Deshalb liegt in `content/inhalte.js` eine
**Kopie** aller Inhaltsdateien. Diese Kopie erzeugt der **Editor** automatisch – bei jedem
Speichern und beim Öffnen des Projektordners, falls sie veraltet ist. Du bearbeitest sie **nie**
von Hand. Die eigentlichen Inhalte bleiben die `.md`-Dateien.

> Hast du eine `.md`-Datei **von Hand** geändert, zeigt der Doppelklick-Kurs die Änderung erst,
> nachdem du einmal `editor.html` geöffnet, den Projektordner gewählt und gespeichert hast
> (Abschnitt 2). Auf dem Webspace (Abschnitt 12) gilt das nicht: Dort liest der Kurs die
> `.md`-Dateien direkt.

**Warum der Editor am besten in Chrome oder Edge läuft:** Nur diese Browser erlauben einer
Webseite, mit deiner Erlaubnis direkt in einen Ordner zu speichern. In Firefox und Safari
funktioniert der Editor auch, du lädst die geänderten Dateien dann aber herunter und legst sie
selbst in den richtigen Ordner (Download-Modus).

## 2. Der Editor in 5 Minuten

**Ordner freigeben.** Doppelklicke `editor.html` und klicke **„Projektordner öffnen"**.
Wähle den Ordner `onboarding` (den Ordner, in dem `index.html` liegt – nicht `content`). Der Browser
fragt, ob der Editor dort speichern darf: erlauben. Beim nächsten Mal merkt sich der Editor den Ordner
und fragt nur kurz nach. Ist `content/inhalte.js` veraltet (weil jemand von Hand geändert hat),
meldet der Editor das unten in der Statuszeile – einmal **Speichern** erneuert sie.

**Die drei Spalten:**

| Spalte | Was du dort machst |
|---|---|
| **Links – Kursstruktur** | Kurseinstellungen, Glossar, Kapitel mit ihren Seiten und dem Quiz. Kapitel mit ↑/↓ umsortieren (oder ziehen). Darunter „Inaktiv" und „Archiv". |
| **Mitte – Arbeitsfläche** | Je nach Auswahl: Formular für Kurs oder Kapitel, oder die **Elemente einer Seite** als Karten. Zwischen den Karten „+ Element einfügen". |
| **Rechts – Eigenschaften / Vorschau** | „Eigenschaften": das Formular des gewählten Elements. „Vorschau": so sieht es im Kurs aus – umschaltbar Handy/Desktop und Dunkel/Hell. Darunter die **Hinweise** der Prüfung. |

**Speichern:** Knopf „Speichern" oben rechts oder `Strg+S` (Mac: `Cmd+S`). Oben steht, wie viele
Dateien ungespeichert sind. Beim ersten Speichern einer Datei legt der Editor automatisch eine
Sicherungskopie in `content/_backup/` an.

**Rückgängig/Wiederholen:** Knöpfe oben oder `Strg/Cmd+Z` bzw. `Strg/Cmd+Umschalt+Z`.
Bis zu 50 Schritte, solange der Editor offen ist.

**Vorschau:** Zeigt die aktuelle Seite mit dem echten Kurs. Bausteine sind dort bedienbar,
speichern aber nichts. „Im Kurs testen" öffnet den echten Kurs in einem neuen Tab – er zeigt
den **gespeicherten** Stand, also vorher speichern.

**Download-Modus** (Firefox, Safari oder Knopf „Projektordner einlesen (Download-Modus)"): Du
wählst den Ordner `onboarding` aus, der Editor liest ihn nur. Beim Speichern erscheint eine Liste
der geänderten Dateien mit „Herunterladen" und dem Zielordner – dazu gehört fast immer auch
`content/inhalte.js` („Offline-Datei"). Lade jede Datei herunter, ersetze damit die Datei im
angegebenen Ordner und klicke „Erledigt". Kapitel verschieben (archivieren, umbenennen) musst du
in diesem Modus selbst im Dateimanager erledigen – der Editor sagt dir genau, welche Datei wohin
gehört.

## 3. Ich will einen Text ändern

**Im Editor:** Links das Kapitel aufklappen → Seite wählen → in der Mitte die Karte
„Textabschnitt" anklicken → rechts unter „Eigenschaften" den Text ändern → speichern.

Die Werkzeugleiste über dem Textfeld fügt Formatierungen ein, z. B. **Fett** (`**Text**`),
*Kursiv* (`*Text*`), Link, Liste, Zwischenüberschrift (`### `), Glossarbegriff (`[[Begriff]]`)
und Platzhalter (`{{TODO: …}}`). Der Text bleibt dabei lesbares Markdown.

**Von Hand:** Kapiteldatei in `content/kapitel/` mit einem Texteditor öffnen (z. B. VS Code,
Notepad++, TextEdit im Modus „Reiner Text") und den Text ändern. Speichern als **UTF-8**.

Wichtig in Textabschnitten:
- Eine Zeile, die mit `## ` beginnt, startet eine **neue Seite**. Für Zwischenüberschriften `### ` verwenden.
- Eine Zeile, die mit `:::` beginnt, startet einen Baustein.
- Alle Schreibweisen findest du in `docs/BAUSTEINE.md`.

## 4. Ich will ein Element einfügen, verschieben oder entfernen

**Im Editor:**
- **Einfügen:** In der Mitte auf „+ Element einfügen" an der gewünschten Stelle klicken. Die Palette
  zeigt Textabschnitt, Bild und alle Bausteine mit einem Satz Erklärung. Oben kannst du suchen.
- **Verschieben:** ↑ und ↓ an der Karte (oder Karte ziehen).
- **Duplizieren:** ⧉ · **Entfernen:** ✕ (mit Strg/Cmd+Z zurückholen) · **Auf-/Zuklappen:** ▾
- **Seiten:** Kapitel wählen → in der Seitenliste hinzufügen, umbenennen, verschieben, duplizieren, entfernen.

**Von Hand:** Den Abschnitt (z. B. von `:::karten` bis zur Zeile `:::`) ausschneiden und an der
neuen Stelle einfügen. Bausteine stehen immer für sich, mit einer Leerzeile davor und danach.

## 5. Ich will eine Quizfrage hinzufügen

**Im Editor:** Links unter dem Kapitel „Quiz" wählen → „+ Frage hinzufügen" → Fragetext, Antworten
(richtige anhaken), **Erklärung** (Pflicht) und die Seite zum Nachlesen ausfüllen. Oben steht
„Pool: 9 Fragen · gezeigt werden 5". Mit „Sicherheitskritisch" wird eine Frage **immer** gestellt
und muss richtig beantwortet werden.

**Von Hand:** Im Abschnitt `:::quiz` eine Leerzeile und dann:

```
? Was passiert beim Scrutineering?
- [ ] Das Team präsentiert seinen Businessplan
- [x] Das Auto wird technisch abgenommen
> Scrutineering ist die technische Abnahme. Ohne sie darf das Auto nicht auf die Strecke.
~ Erst die Abnahme, dann die Strecke
```

`?!` statt `?` macht die Frage sicherheitskritisch. `~` nennt den Seitentitel zum Nachlesen –
genau so geschrieben wie hinter `## `.

Danach: **Version des Kapitels erhöhen** (siehe Abschnitt 10). Der Editor schlägt das selbst vor.

## 6. Ich will ein Bild austauschen

**Format und Größe:** WebP oder JPG für Fotos, SVG für Grafiken und Logos. Höchstens etwa 1600 Pixel
breit und möglichst unter 200 KB. Der Editor warnt ab 500 KB. Bilder verkleinern geht z. B. mit
jedem Bildbearbeitungsprogramm („Exportieren als WebP").

**Im Editor:** Element „Bild" (oder das Bildfeld eines Bausteins) wählen → „Bild wählen …" → Datei
aussuchen. Der Editor kopiert sie nach `assets/bilder/` und vereinfacht den Namen (Kleinbuchstaben,
keine Umlaute oder Leerzeichen). Dann **Alternativtext** eintragen – er ist Pflicht.

**Von Hand:** Bild in `assets/bilder/` legen (Name nur aus Kleinbuchstaben, Ziffern und Bindestrichen)
und im Text schreiben: `![Was auf dem Bild zu sehen ist](assets/bilder/name.webp "Bildunterschrift")`.

**Alternativtext:** Beschreibe in einem Satz, was zu sehen ist – so, als würdest du es jemandem am
Telefon erklären. Menschen mit Screenreader hören diesen Text.

**Datenschutz:**
- Keine erkennbaren Personen ohne deren Einverständnis.
- Keine Screenshots, auf denen interne Drive-Inhalte, Budgets, Namen oder Kontaktdaten zu sehen sind.

**Platzhalterbilder** (`fahrzeug-platzhalter.svg`, `werkstatt-platzhalter.svg`): durch echte Bilder
ersetzen. Bei Bildern mit Punkten („Bild mit Punkten") danach die Punkte neu setzen – im Editor
einfach ins Bild klicken.

## 7. Kapitel anlegen, umsortieren, deaktivieren, archivieren, wiederherstellen

| Aufgabe | Im Editor | Von Hand |
|---|---|---|
| **Anlegen** | Links „+ Kapitel anlegen" → Titel eingeben. Dateiname entsteht automatisch (z. B. `07-boxengasse-regeln.md`), Inhalt aus der Vorlage. | `content/_vorlage-kapitel.md` kopieren, nach `content/kapitel/` legen, umbenennen (`07-titel.md`), in `content/kurs.md` unter `kapitel:` eintragen. |
| **Umsortieren** | ↑/↓ neben dem Kapitel (oder ziehen). | Zeilen unter `kapitel:` in `kurs.md` umstellen. |
| **Deaktivieren** | Kapitel wählen → „Deaktivieren". Es steht dann unter „Inaktiv". | Zeile aus `kapitel:` löschen. Die Datei bleibt liegen. |
| **Archivieren** | „Archivieren" – beim Speichern wandert die Datei nach `content/_archiv/`. | Zeile aus `kapitel:` löschen und Datei nach `content/_archiv/` verschieben. |
| **Wiederherstellen** | Links „Archiv" aufklappen → „Wiederherstellen", dann „Aktivieren". | Datei zurück nach `content/kapitel/` und wieder in `kapitel:` eintragen. |
| **Umbenennen** | Titel im Kapitelformular ändern, dann „Dateiname an Titel anpassen". `kurs.md` wird automatisch angepasst. | Datei umbenennen und den Eintrag in `kurs.md` gleich mitändern. |

**Endgültig löschen** gibt es im Editor absichtlich nicht. Wenn ein Kapitel wirklich weg soll:
archivieren.

Der Lernfortschritt hängt am Dateinamen. Nach dem **Umbenennen** gilt ein Kapitel für alle als
noch nicht bestanden. Fortschritt zu deaktivierten Kapiteln bleibt im Browser erhalten und ist nach
dem Wiederaktivieren wieder da.

## 8. Hilfe, ich habe etwas kaputt gemacht

1. **Editor noch offen?** `Strg/Cmd+Z`, so oft wie nötig.
2. **Schon gespeichert?** Die Fassung vor deinem ersten Speichern liegt in `content/_backup/`, z. B.
   `01-formula-student-2026-10-13-0905.md`. Datei öffnen, Inhalt kopieren und in die Originaldatei
   einsetzen (oder die Sicherung umbenennen und zurückkopieren).
3. **Git** (falls ihr den Ordner mit Git verwaltet): Git speichert jede bestätigte Fassung („Commit").
   Mit einem Git-Programm (z. B. GitHub Desktop) kannst du eine Datei auf einen älteren Stand
   zurücksetzen. Faustregel: Nach jeder größeren Änderung einen Commit mit kurzer Beschreibung machen.
4. **Prüfseite öffnen** (Abschnitt 9) – sie sagt, welche Zeile in welcher Datei nicht stimmt.

Der Editor verwirft nie Inhalte, die er nicht versteht: Ein kaputter Abschnitt erscheint als
„Nicht lesbarer Abschnitt" und bleibt erhalten. Wähle ihn aus, korrigiere rechts den Quelltext
und klicke „Erneut einlesen".

## 9. Prüfseite benutzen und Meldungen verstehen

Öffne `pruefen.html` (Doppelklick) – **vor jeder Veröffentlichung**. Oben steht eine
Zusammenfassung, darunter die Meldungen nach Datei, jeweils mit Zeilennummer und Lösungsvorschlag.
„Kapitel in der Vorschau öffnen" springt direkt in den Kurs.

| Art | Bedeutung | Muss ich handeln? |
|---|---|---|
| **Fehler** | Etwas funktioniert nicht, z. B. Quizfrage ohne richtige Antwort, Bild fehlt, unbekannter Baustein. | Ja, vor der Veröffentlichung. |
| **Warnung** | Funktioniert, ist aber vermutlich nicht gewollt, z. B. Sicherheitskapitel nicht freigegeben, Kapiteldatei nicht eingetragen. | Prüfen. |
| **Hinweis** | Verbesserungsvorschlag, z. B. „nur eine Interaktion im Kapitel". | Optional. |
| **Platzhalter** | Ein `{{TODO: …}}` – hier fehlt noch echter Inhalt. Im Kurs erscheint „Inhalt folgt". | Vor der Veröffentlichung füllen. |

Häufige Meldungen:
- *„Der Glossarbegriff … ist nicht im Glossar definiert"* → in `content/glossar.md` eine Zeile
  `Begriff: Erklärung.` ergänzen oder die Schreibweise korrigieren.
- *„Der Verweis ~ … zeigt auf eine Seite, die es nicht gibt"* → Seitentitel genau wie hinter `## `.
- *„Der Baustein … wird nicht geschlossen"* → am Ende eine Zeile `:::` ergänzen.
- *„Die Datei … liegt in content/kapitel/, steht aber nicht in kurs.md"* → gewollt (deaktiviert)
  oder eintragen.

**Welcher Stand wird geprüft?** Unter den Knöpfen steht es. Per Doppelklick geöffnet, prüft die Seite
zunächst `content/inhalte.js`, also den Stand der letzten Speicherung im Editor. Hast du `.md`-Dateien
von Hand geändert, klicke **„Projektordner einlesen"** und wähle den Ordner `onboarding` – dann prüft
sie genau die Dateien, die jetzt auf der Festplatte liegen (der Browser fragt evtl., ob du die Dateien
„hochladen" willst: Sie bleiben trotzdem auf deinem Rechner, es wird nichts verschickt).

## 10. Wann erhöhe ich `version` und `kursversion`?

| Feld | Wo | Erhöhen, wenn … | Folge |
|---|---|---|---|
| `version` | Kopfbereich eines Kapitels | … sich **das Quiz** oder prüfungsrelevante Inhalte geändert haben. | Wer das Kapitel schon bestanden hat, sieht „Aktualisiert – Quiz neu machen". |
| `kursversion` | `content/kurs.md` | … sich der Kurs grundlegend ändert (z. B. neues Pflichtkapitel, neue Saison). | Das Zertifikat setzt ein Qualifying mit der neuen Kursversion voraus. |

Tippfehler korrigieren oder ein Foto tauschen: **nichts erhöhen**. Der Editor schlägt die
Erhöhung von `version` vor, sobald du das Quiz änderst.

## 11. Sicherheitskapitel: Freigabeprozess

Das Kapitel „Arbeitssicherheit" ersetzt **keine** Sicherheitsunterweisung. Es bereitet nur darauf
vor. Trotzdem müssen seine Inhalte stimmen. Deshalb gilt:

1. Inhalte ändern (Editor oder von Hand).
2. Die Werkstattleitung bzw. die Sicherheitsverantwortlichen des Teams prüfen die **aktuelle**
   Fassung (z. B. über „Kapitel in der Vorschau öffnen" auf der Prüfseite).
3. Erst nach deren Okay im Kopfbereich `freigegeben: ja` setzen (im Editor: Kapitel wählen →
   „Freigegeben: ja").
4. Solange `freigegeben: nein` steht, zeigt der Kurs oben im Kapitel einen deutlichen Hinweis und
   die Prüfseite eine Warnung.

**Jede spätere Änderung** an einem freigegebenen Sicherheitskapitel setzt der Editor automatisch auf
`freigegeben: nein` zurück. Wer von Hand ändert, muss das selbst tun.

Ein Kapitel gilt als Sicherheitskapitel, wenn es im Kopfbereich die Zeile `freigegeben:` hat
(im Editor: Häkchen „Enthält Sicherheitsinhalte").

## 12. Veröffentlichen

Der Kurs braucht nur einen **statischen Webspace** – keine Datenbank, kein PHP. Er funktioniert
auch in einem Unterordner (z. B. `https://example.org/onboarding/`). Empfohlen: **GitHub Pages**.

### GitHub Pages (empfohlen)

Der Ordner `onboarding/` ist bereits ein Git-Repository. Mit **GitHub Desktop**:

1. **Einmalig einrichten:** GitHub Desktop → „File → Add Local Repository…" → den Ordner
   `onboarding` wählen → „Publish repository". Name z. B. `rookie-onboarding`. Den Haken
   „Keep this code private" **entfernen** (GitHub Pages ist im kostenlosen Konto nur für
   öffentliche Repositories verfügbar – siehe „Öffentlich oder geschützt?" unten).
2. **Pages einschalten:** auf github.com im Repository → „Settings" → „Pages" → unter „Build and
   deployment" bei „Source" **„Deploy from a branch"**, Branch **`main`**, Ordner **`/ (root)`** →
   „Save".
3. Nach ca. einer Minute ist der Kurs erreichbar unter
   `https://<github-name>.github.io/<repository-name>/` (die Adresse steht oben auf der Pages-Seite).

**Änderungen veröffentlichen:** Wie gewohnt im Editor auf dem eigenen Rechner bearbeiten und
speichern. Dann in GitHub Desktop eine kurze Beschreibung eintragen → „Commit to main" → „Push
origin". Nach ca. einer Minute ist die neue Fassung online (im Browser ggf. neu laden).

**Wichtig:** Die leere Datei `.nojekyll` im Projektordner **nie löschen**. Ohne sie wandelt GitHub
die `.md`-Dateien in HTML-Seiten um. Der Kurs weicht dann zwar auf die Kopie `content/inhalte.js`
aus, zeigt aber nach Änderungen von Hand evtl. einen alten Stand.

> **Achtung beim Hochladen über die GitHub-Webseite** („Add file → Upload files"): Dabei werden
> Dateien, deren Name mit einem Punkt beginnt, **nicht** mit hochgeladen – also auch `.nojekyll`
> nicht. Abhilfe: auf github.com im Repository „Add file → Create new file", als Namen `.nojekyll`
> eintragen, Inhalt leer lassen, „Commit changes". Besser gleich GitHub Desktop benutzen (siehe
> oben) – das überträgt alle Dateien.

Gut zu wissen:
- Sicherungskopien aus `content/_backup/` werden nicht hochgeladen (steht in `.gitignore`).
- `editor.html`, `pruefen.html` und `tests.html` sind online mit erreichbar. Das ist unbedenklich:
  Der Editor kann online nichts verändern, er arbeitet immer nur mit einem Ordner auf dem eigenen
  Rechner.
- `content/inhalte.js` wird online nicht benutzt, dort liest der Kurs die `.md`-Dateien direkt.

### Anderer Webspace (z. B. per FTP-Programm wie FileZilla)

Den Inhalt von `onboarding/` hochladen – **außer** `content/_backup/` und `.git/`.
`editor.html`, `js/editor/`, `pruefen.html`, `tests.html` und `content/inhalte.js` schaden nicht,
können aber weggelassen werden.

**Öffentlich oder geschützt?** Enthalten die Inhalte interne Dinge – echte Drive-Struktur,
Sponsorennamen, Namen von Personen, Werkstattplan –, dann **nicht öffentlich** hochladen, sondern
mit Passwortschutz (die meisten Webspaces bieten „Verzeichnisschutz") oder nur im Hochschulnetz.
GitHub Pages hat keinen Passwortschutz: Alles im Repository ist für alle sichtbar – auch frühere
Fassungen in der Versionsgeschichte.

Nach dem Hochladen: Kurs im Browser öffnen, einmal durchklicken, Zertifikat testen.

## 13. Saisonwechsel-Checkliste

Einmal pro Jahr, am besten direkt nach der Übergabe an die neue Teamleitung:

- [ ] **Subteams und Ansprechrollen** in Kapitel 3 und 6 aktualisieren.
- [ ] **Drive-Struktur** in Kapitel 4 mit dem echten Team-Drive abgleichen (Ordner-Explorer und Suchaufgaben).
- [ ] **Regelwerksänderungen** einarbeiten: Disziplinen, Punkte, Fahrzeugklassen, Event-Liste (Kapitel 1).
- [ ] **Aktuelles Auto und Saisonablauf** in Kapitel 2 aktualisieren (Name, Bilder, Zeiträume).
- [ ] **Sicherheitsinhalte** prüfen und **neu freigeben** lassen (Abschnitt 11).
- [ ] **Unterschrift auf dem Zertifikat** anpassen: `zertifikat-unterschrift-name` und `-rolle` in `kurs.md`.
- [ ] **`kursversion`** erhöhen, wenn sich viel geändert hat.
- [ ] **Prüfseite**: 0 Fehler, Platzhalter geprüft. **Selbsttests**: alle grün.
- [ ] Zuständigkeiten (Abschnitt 15) aktualisieren.

## 14. Häufige Fehler und ihre Lösung

| Problem | Ursache | Lösung |
|---|---|---|
| Kurs zeigt „Der Kurs konnte nicht geladen werden" | `content/inhalte.js` fehlt (per Doppelklick geöffnet) | `editor.html` öffnen, Projektordner wählen, speichern (Abschnitt 2). |
| Änderungen erscheinen nicht im Kurs | Nicht gespeichert, Seite nicht neu geladen oder `.md` von Hand geändert | Im Editor speichern, Kurs neu laden. Nach Änderungen von Hand: Editor öffnen, Projektordner wählen, speichern – das erneuert `content/inhalte.js`. |
| Kapitel fehlt im Kurs | Nicht in `kurs.md` eingetragen oder Tippfehler im Dateinamen | Prüfseite öffnen, Eintrag korrigieren (Groß-/Kleinschreibung, `.md`). |
| Umlaute kaputt (z. B. „Ã¼") | Datei nicht als UTF-8 gespeichert | Im Texteditor „Speichern unter → Kodierung UTF-8". |
| Baustein erscheint als „kann nicht angezeigt werden" | Syntaxfehler | Prüfseite zeigt die Zeile; Vorlage in `docs/BAUSTEINE.md`. |
| Editor: „Projektordner öffnen" fehlt | Firefox oder Safari | `editor.html` in Chrome oder Edge öffnen – oder „Projektordner einlesen (Download-Modus)" nutzen. |
| Editor fragt „Datei wurde außerhalb geändert" | Jemand hat die Datei inzwischen anders bearbeitet | „Diese Datei auslassen", Editor neu laden, Änderung wiederholen. Oder überschreiben – die andere Fassung landet in `_backup/`. |
| Bild wird nicht angezeigt | Pfad oder Groß-/Kleinschreibung falsch | Pfad ab Projektordner: `assets/bilder/name.webp`. |

## 15. Zuständigkeiten

Bitte ausfüllen und bei jedem Saisonwechsel aktualisieren.

| Bereich | Zuständig (Rolle) | Vertretung |
|---|---|---|
| Kapitel 1 – Formula Student | | |
| Kapitel 2 – Einstein Motorsport | | |
| Kapitel 3 – Subteams | | |
| Kapitel 4 – Drive und Tools | | |
| Kapitel 5 – Arbeitssicherheit (Inhalt) | | |
| Kapitel 5 – Freigabe | Werkstattleitung / Sicherheitsverantwortliche | |
| Kapitel 6 – Dein Start | | |
| Glossar | | |
| Veröffentlichung und Webspace | | |
| Technik (Code) | | |
