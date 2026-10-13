# Bausteine – Nachschlagewerk mit Kopiervorlagen

Alle Inhalte stehen in Markdown-Dateien („Kursdown"). Dieses Dokument zeigt jede Schreibweise mit
einer **Kopiervorlage**. Im Editor heißen die Bausteine etwas anders – der Name steht jeweils dabei.

## Übersicht

| Baustein | Im Editor | Wofür | Zählt als Interaktion* |
|---|---|---|---|
| `info` | Info-Kasten | Ergänzende Information | nein |
| `tipp` | Tipp-Kasten | Praktischer Rat | nein |
| `achtung` | Achtung-Kasten | Sicherheitsrelevanter Hinweis | nein |
| `aufklappen` | Aufklappbereich | Vertiefung für Neugierige | nein |
| `karten` | Lernkarten | Begriffe/Fragen zum Umdrehen | ja |
| `zuordnen` | Zuordnen | Begriffe Kategorien zuordnen | ja |
| `reihenfolge` | Reihenfolge | Schritte sortieren | ja |
| `szenario` | Szenario | Entscheidungssituation mit Feedback | ja |
| `hotspot` | Bild mit Punkten | Bild mit Erklärpunkten | ja |
| `ordner` | Ordner-Explorer | Nachgebauter Drive mit Suchaufgaben | ja |
| `teams` | Team-Steckbriefe | Aufklappbare Teamkarten mit Filter | ja |
| `zeitstrahl` | Zeitstrahl | Ablauf über die Zeit | nein |
| `checkliste` | Checkliste | Persönliche Abhakliste | ja |
| `quiz` | Quiz | Fragenpool am Kapitelende | – |

\* Didaktische Regel: Jedes Kapitel braucht mindestens **zwei Interaktionen, die Denken verlangen**.
Die Prüfseite zählt nur die mit „ja" markierten Bausteine.

**Allgemeine Regeln für alle Bausteine**

- Ein Baustein beginnt mit einer Zeile `:::name` (optional mit Titel und Attributen) und endet mit
  einer Zeile, die **nur** `:::` enthält.
- Kopfzeile: `:::name Titel mit Leerzeichen attribut="wert" attribut2=wert`. Wörter der Form
  `schluessel=wert` sind Attribute, alles andere ist der Titel.
- Bausteine werden nicht ineinander verschachtelt. Vor und nach einem Baustein eine Leerzeile.
- In Zeilen, die mit `|` getrennt werden, schreibst du einen echten senkrechten Strich als `\|`.
  Ausnahme: Glossarbegriffe `[[Begriff|Anzeigetext]]` funktionieren ohne Maskierung.
- Fehler (z. B. vergessenes `:::`) zeigt die Prüfseite mit Zeilennummer an. Der Editor zeigt den
  Abschnitt dann als „Nicht lesbarer Abschnitt" und verwirft nichts.

---

## Grundlagen: Text, Seiten, Bilder

```
---
titel: Titel des Kapitels
kurztitel: Kurz (für die Sektoranzeige)
dauer: 8
version: 1
lernziele:
  - Du kannst …
---

## Titel der ersten Seite

Ein Absatz mit **fett**, *kursiv*, `Code` und einem [Link](https://example.org).
Ein Fachbegriff aus dem Glossar: [[Scrutineering]] oder mit eigenem Text: [[Scrutineering|die Abnahme]].

### Zwischenüberschrift

- Aufzählung
- noch ein Punkt
  - eingerückt = Unterpunkt

1. Nummeriert
2. Liste

> Ein Zitat.

| Spalte A | Spalte B |
|---|---|
| Zelle | Zelle |

![Was auf dem Bild zu sehen ist](assets/bilder/name.webp "Bildunterschrift")

{{TODO: Hier fehlt noch etwas – im Kurs erscheint „Inhalt folgt".}}

## Titel der zweiten Seite
```

- `## ` beginnt eine **neue Seite** (ein Bildschirm). `### ` ist eine Zwischenüberschrift.
- Externe Links öffnen sich in einem neuen Tab. Erlaubt sind `https://`, `http://`, `mailto:` und
  Pfade innerhalb des Kurses.
- HTML wird nicht ausgeführt, sondern als Text angezeigt.
- Kopfbereich eines Kapitels: `titel`, `kurztitel`, `dauer` (Minuten), `version` sind Pflicht;
  `bestehensgrenze` (Prozent) und `freigegeben` (ja/nein, nur Sicherheitskapitel) sind optional.

---

## info, tipp, achtung – Hinweiskästen

**Zweck:** `info` für Ergänzungen, `tipp` für praktischen Rat, `achtung` für Sicherheit.
**Didaktik:** Sparsam einsetzen. `achtung` ist bewusst laut (gelb-schwarze Schraffur) – nur für
echte Gefahren, sonst stumpft die Warnung ab.
**Im Editor:** Info-Kasten, Tipp-Kasten, Achtung-Kasten.

```
:::achtung Keine Handschuhe an rotierenden Maschinen
Ein Handschuh kann von der drehenden Spindel erfasst werden.
:::
```

**Attribute:** keine. Der Titel nach dem Namen ist optional. Der Inhalt darf normales Markdown sein.
**Typische Fehler:** Schlusszeile `:::` vergessen.

## aufklappen – Vertiefung

**Zweck:** Zusatzwissen, das erst auf Klick erscheint.
**Didaktik:** Nur für Nicht-Prüfungsrelevantes. Was im Quiz gefragt wird, gehört nicht hinein.
**Im Editor:** Aufklappbereich.

```
:::aufklappen Woher kommt Formula Student?
Die Idee stammt aus den USA …
:::
```

**Attribute:** keine. Der Titel ist Pflicht (sonst steht „Mehr erfahren" da).

## karten – Lernkarten

**Zweck:** Vorderseite (Frage/Begriff) und Rückseite (Antwort) zum Umdrehen.
**Didaktik:** Gut für Begriffspaare und häufige Fragen. Die Vorderseite soll zum Nachdenken
anregen, nicht schon die Antwort enthalten.
**Im Editor:** Lernkarten.

```
:::karten Welche Klasse ist das?
Elektro || Antrieb mit Elektromotor und [[Akku]].
Driverless || Das Auto fährt ohne Mensch am Steuer.
:::
```

**Attribute:** keine. **Typische Fehler:** `||` fehlt (eine Zeile pro Karte!), nur ein `|`.

## zuordnen – Begriffe Kategorien zuordnen

**Zweck:** Zu jedem Begriff die richtige Kategorie wählen, dann prüfen.
**Didaktik:** Gut, um Unterscheidungen zu üben (statisch/dynamisch, welches Team …). Die Erklärung
nach `|` sagt, **warum** – bitte immer ausfüllen.
**Im Editor:** Zuordnen.

```
:::zuordnen Statisch oder dynamisch?
Skidpad => Dynamisch | Das Auto fährt eine liegende Acht.
Cost and Manufacturing => Statisch | Bewertet wird der Kostenbericht.
:::
```

**Attribute:** keine. Die Kategorien ergeben sich aus den Zeilen (gleiche Schreibweise = gleiche
Kategorie). **Typische Fehler:** `=>` fehlt; nur eine Kategorie; Tippfehler erzeugen eine zusätzliche Kategorie.

## reihenfolge – Schritte sortieren

**Zweck:** Schritte in die richtige Reihenfolge bringen. Im Kurs werden sie gemischt angezeigt.
**Didaktik:** Für Abläufe, bei denen die Reihenfolge zählt (Sicherheitsregeln, Ablage).
**Im Editor:** Reihenfolge.

```
:::reihenfolge Wie legst du eine Datei ab?
Prüfen, ob es die Datei schon gibt
Datei nach der Benennungsregel benennen
Hochladen
> Erst prüfen, dann benennen und ablegen.
:::
```

Schritte in der **richtigen** Reihenfolge schreiben. Die Zeile mit `>` ist die Erklärung.
**Typische Fehler:** zwei gleiche Schritte; Erklärung vergessen.

## szenario – Entscheidungssituation

**Zweck:** Eine Situation, mehrere Optionen, Feedback zu jeder Option.
**Didaktik:** Bleibt besonders gut hängen – ideal für Sicherheit und Teamalltag.
**Im Editor:** Szenario.

```
:::szenario Öl auf dem Boden
Du kommst in die Werkstatt und siehst eine Öllache.
- [ ] Drumherum gehen > Die nächste Person rutscht vielleicht aus.
- [x] Absichern und aufnehmen > Genau: erst sichern, dann beseitigen.
:::
```

Erst die Situation (normaler Text), dann die Optionen. `[x]` = gute Entscheidung, nach ` > ` das
Feedback. **Typische Fehler:** Text nach den Optionen; keine Option mit `[x]`; Feedback fehlt.

## hotspot – Bild mit Punkten

**Zweck:** Ein Bild mit nummerierten Punkten, die eine Erklärung zeigen. Alle Punkte stehen
zusätzlich als Liste unter dem Bild.
**Didaktik:** Für Orte und Bauteile (Werkstattplan, Fahrzeug).
**Im Editor:** Bild mit Punkten – Punkte per Klick ins Bild setzen, ziehen oder mit Pfeiltasten verschieben.

```
:::hotspot Die Baugruppen bild="assets/bilder/fahrzeug.webp" alt="Seitenansicht des Rennwagens"
16% 57% | Frontflügel | Erzeugt Abtrieb.
68% 60% | Akku | Hochvolt – nur mit Freigabe.
:::
```

**Attribute:** `bild` (Pfad, Pflicht), `alt` (Alternativtext, Pflicht). Jede Zeile: Abstand von
links in %, Abstand von oben in %, Titel, Erklärung. **Typische Fehler:** `%` vergessen; Werte über 100;
nach Bildtausch die Punkte nicht angepasst.

## ordner – Ordner-Explorer

**Zweck:** Nachgebaute Drive-Ordnerstruktur zum Durchklicken, mit Suchaufgaben.
**Didaktik:** Neue lernen die echte Struktur kennen, bevor sie sie brauchen.
**Im Editor:** Ordner-Explorer (Einträge mit „Ebene": 0 = oberste Ebene).

```
:::ordner Unser Team-Drive
- 📁 01 Organisation | Protokolle, Termine
  - 📁 Protokolle | Nach Datum benannt
  - 📄 Terminkalender
- 📁 02 Technik
? Wo findest du das letzte Protokoll? => 01 Organisation/Protokolle
:::
```

Zwei Leerzeichen Einrückung = eine Ebene tiefer. 📁 = Ordner, 📄 = Datei. Nach `|` steht die
Beschreibung. Zeilen mit `?` sind Suchaufgaben: Frage `=>` Pfad (Ordnernamen mit `/`).
**Typische Fehler:** Einrückung mit Tab oder um mehr als eine Ebene; Pfad der Suchaufgabe passt nicht
genau zu den Ordnernamen.

## teams – Team-Steckbriefe

**Zweck:** Aufklappbare Karten je Subteam, filterbar nach Bereich.
**Im Editor:** Team-Steckbriefe.

```
:::teams Unsere Subteams
# Fahrwerk
bereich: Technik
kurz: Radaufhängung, Lenkung, Bremsen.
aufgaben: Kinematik auslegen, Bauteile konstruieren.
passt-zu-dir-wenn: du verstehen willst, warum ein Auto in der Kurve so liegt.
ansprechrolle: Leitung Fahrwerk
bild: assets/bilder/fahrwerk.webp
bild-alt: Zwei Teammitglieder montieren einen Querlenker.
:::
```

Felder: `bereich` (für den Filter), `kurz` (empfohlen), `aufgaben`, `passt-zu-dir-wenn`,
`ansprechrolle`, `bild`, `bild-alt` (Pflicht, wenn `bild` gesetzt ist). Ansprechrollen statt Namen –
Namen ändern sich jede Saison. **Typische Fehler:** Zeile `# Teamname` vergessen; Bild ohne `bild-alt`.

## zeitstrahl – Ablauf über die Zeit

**Zweck:** Stationen in zeitlicher Reihenfolge (Saison, Event-Ablauf).
**Im Editor:** Zeitstrahl.

```
:::zeitstrahl Eine Saison
Herbst | Konzept | Ziele festlegen, [[Lastenheft|Lastenhefte]] schreiben.
Winter | Konstruktion | CAD und Berechnung.
:::
```

Jede Zeile: Zeitpunkt | Titel | Text (Text optional). **Typische Fehler:** kein `|`.

## checkliste – persönliche Abhakliste

**Zweck:** Aufgaben, die jede Person für sich abhakt. Die Haken bleiben im Browser gespeichert.
**Im Editor:** Checkliste.

```
:::checkliste Deine ersten Schritte
- [ ] Zum nächsten Teamtreffen kommen
- [ ] Zugang zum Team-Drive beantragen
:::
```

Immer `- [ ]` (nicht vorab abhaken). Wird ein Eintrag umformuliert, ist nur dieser Haken wieder leer.

## quiz – Fragenpool am Kapitelende

**Zweck:** Kapitelquiz. Pro Kapitel genau ein `:::quiz`, am Ende der Datei.
**Didaktik:** Sofortiges Feedback mit Erklärung. Mindestens 8 Fragen im Pool (Sicherheitskapitel 12),
damit ein zweiter Versuch andere Fragen bringt.
**Im Editor:** Quiz (eigener Editor, links unter dem Kapitel).

```
:::quiz anzahl=5
? Welche Disziplin ist statisch?
- [x] Business Plan Presentation
- [ ] Skidpad
> Bei statischen Disziplinen fährt das Auto nicht.
~ Statisch: überzeugen, ohne zu fahren

?! Darfst du ohne Freigabe am Hochvoltsystem arbeiten?
- [ ] Ja, wenn jemand dabei ist
- [x] Nein, nie
> Hochvolt nur mit Qualifikation und Freigabe.
:::
```

| Zeile | Bedeutung |
|---|---|
| `? Text` | normale Frage |
| `?! Text` | Sicherheitsfrage: wird **immer** gestellt und muss richtig sein |
| `- [x] …` / `- [ ] …` | richtige / falsche Antwort (mehrere `[x]` = Mehrfachauswahl) |
| `> …` | Erklärung (**Pflicht**) |
| `~ Seitentitel` | Seite zum Nachlesen (optional, genau wie hinter `## `) |

**Attribut:** `anzahl=N` – so viele normale Fragen werden zufällig gezogen; Sicherheitsfragen kommen
dazu. Leerzeile zwischen den Fragen. **Typische Fehler:** keine richtige Antwort; Erklärung fehlt;
`anzahl` größer als die Zahl normaler Fragen; Verweis `~` auf einen nicht existierenden Seitentitel.

Nach Änderungen am Quiz die `version` des Kapitels erhöhen (siehe `PFLEGE.md`, Abschnitt 10).
