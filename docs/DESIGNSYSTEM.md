# Designsystem

Das Aussehen des Kurses folgt dem Designsystem des Teams („Designsystem für E learning.pdf").
Was dort nicht enthalten war, wurde **im selben Stil ergänzt** (unten mit *Erweiterung* markiert).

**Zum Anschauen:** `designsystem.html` per Doppelklick öffnen. Die Seite zeigt alle Farben,
Schriften und Bedienelemente mit den echten Stildateien – auch im hellen Design (Schalter oben).

**Wo es im Code steht:** Alle Werte als Variablen in `css/base/tokens.css`. Bedienelemente in
`css/components/` (z. B. `buttons.css`, `icon-button.css`, `switch.css`, `statusbar.css`),
Bausteine in `css/blocks/`, Editor in `css/editor/`.

---

## 1. Farben

| Rolle | Wert | Schrift darauf |
|---|---|---|
| Primär | Gelb `#FFED00` | nur dunkel: `#1E1E1E` (13,79 : 1) oder Schwarz (17,37 : 1) |
| Sekundär | Lila `#534495` | Gelb (6,61 : 1) oder Weiß (7,99 : 1) |
| Hintergrund | `#1E1E1E` | Weiß/Hellgrau oder Gelb (13,79 : 1) |
| Schwarzton | `#000000` | Weiß; Kopfleiste und Sektoranzeige |

**Nicht erlaubt** (Designsystem): Weiß oder Gelb auf Gelb · Schwarz auf Lila · Lila oder Schwarz
als Schrift auf `#1E1E1E`.

*Erweiterung – helles Design:* heller Grund `#F6F6F3`, Flächen Weiß, Schrift `#1E1E1E`. Gelb ist
dort nie Schriftfarbe (1,21 : 1), nur Fläche mit dunkler Schrift. Links und Akzentlinien sind Lila
(7,38 : 1). Kopfleiste und Sektoranzeige bleiben schwarz, weil das Logo gelb ist.

*Erweiterung – Rückmeldungen:* Richtig/Falsch zusätzlich mit Grün bzw. Rot (Rand und
Hintergrund). Die Bedeutung trägt immer auch die Haken- bzw. Kreuz-Kachel und der Text
„Richtig"/„Nicht ganz" – nie die Farbe allein.

## 2. Schrift

Alle Texte in **Lato** (lokal eingebunden, keine Verbindung zu Google).

| Element | Schnitt | Im Code |
|---|---|---|
| Überschrift | Lato Bold | `h1` |
| Unterüberschrift | Lato Medium | `h2`, `h3` |
| Text | Lato Regular | Fließtext |
| Hervorhebung im Fließtext | Lato Medium | `**fett**` im Kursdown |
| Link im Fließtext | Lato Italic, unterstrichen | Links in Absätzen und Listen |

Größenverhältnis wie im Designsystem: Überschrift ≈ 1,6 × Unterüberschrift ≈ 2,5 × Text.
Lato Black wird nicht mehr verwendet. Das PDF-Zertifikat nutzt dieselben Schnitte.

## 3. Buttons

| Zustand | Aussehen |
|---|---|
| nicht gedrückt | Gelb, dunkle Schrift, abgerundete Ecken (`--radius-m`) |
| gedrückt (während des Klicks, `aria-pressed="true"`) | Lila, gelbe Schrift, gelber Rand |
| *Erweiterung:* Zweitaktion (`.button`) | dunkle Fläche mit gelbem Rand (hell: weiß mit lila Rand) |
| *Erweiterung:* gesperrt | halbe Deckkraft |
| *Erweiterung:* leise (`.button--quiet`) | wie ein Link: kursiv, unterstrichen |

Pro Ansicht gibt es höchstens eine gelbe Hauptaktion (z. B. „Weiter", „Antwort prüfen").

## 4. Symbol-Kacheln

Lila Fläche, gelber Rand, gelbes Symbol mit runden Enden (im Original mit feiner weißer Kontur).

| Symbol | Verwendung |
|---|---|
| Hamburgermenü | Menü-Knopf auf dem Handy; geöffnet wird daraus das Kreuz |
| Kreuz | „Schließen", falsche Antwort |
| Haken („Abgehakt") | angehaktes Kästchen, richtige Antwort |
| Plus / Minus („Auf und Zuklappen") | Baustein „aufklappen", Subteam-Steckbriefe |
| *Erweiterung:* Pfeile | Reihenfolge-Baustein (gesperrt: dunkle Kachel mit grauem Rand) |
| *Erweiterung:* Nummern | Platznummern im Reihenfolge-Baustein |
| *Erweiterung:* Palettensymbole | Editor-Palette (`assets/icons/*.svg`) |

Als Code: `.icon-button` (Knopf) bzw. `.icon-tile`; die Symbole kommen aus `js/ui/icons.js`,
die Plus/Minus-Kacheln und der Haken aus `assets/icons/ui/`.

## 5. Schalter

| Zustand | Aussehen |
|---|---|
| An | lila Spur, gelber Knopf **links** mit weißem Ring, gelber Rand |
| Aus | dunkle Spur, lila Knopf **rechts** mit weißem Ring, gelber Rand |

Verwendet für „Helles Design" in der Kopfleiste. Die Knopf-Seite folgt genau dem Designsystem
(umgekehrt zu vielen Handys). Umdrehen: in `css/components/switch.css` die Werte von
`--switch-on-pos` und `--switch-off-pos` tauschen.

## 6. Statusbar

Lila Spur, gelbe Füllung mit lila Rand, runder gelber Knopf mit lila Rand am Ende der Füllung.
Zeigt den Fortschritt über jeder Kapitelseite („Seite 2 von 7") und jeder Quizfrage. Die Zahl
steht immer zusätzlich als Text daneben (`js/ui/statusbar.js`).

## 7. Erweiterungen im selben Stil

| Element | Gestaltung |
|---|---|
| Kästchen / Optionsfelder | leer: dunkle Fläche mit gelbem Rand (wie Schalter „Aus"); gewählt: lila mit gelbem Haken bzw. gelbem Punkt mit weißem Ring (wie Schalter „An"). Hell: leer weiß mit lila Rand. |
| Eingabefelder, Auswahllisten | abgerundet, grauer Rand, Fokus gelb |
| Antworten (Quiz, Szenario) | abgerundete Flächen; gewählt = „gedrückt": Lila, weiße Schrift, gelber Rand |
| Sektoranzeige | abgerundete Kacheln auf Schwarz: offen dunkel mit grauem Rand, bestanden Gelb, Bestzeit Lila mit gelbem Rand und gelber Schrift; aktueller Sektor mit gelber Linie darunter |
| Status-Chips (Startseite) | kleine abgerundete Flächen in denselben Farben |
| Hotspot-Punkte | rund, Gelb mit lila Rand; geöffnet Lila mit gelber Zahl |
| Zeitstrahl | lila Linie, Punkte wie der Knopf der Statusbar |
| Kästen (info, tipp) | abgerundete Fläche mit lila Linie links |
| Achtung-Kasten, Sicherheitsfrage | gelb-schwarze Schraffur, gelber Rand (hell: schwarz) |
| Lernkarten | abgerundet; umgedreht mit gelbem (hell: lila) Rand |
| Dialoge, Glossar-Fenster | abgerundet, gelber (hell: lila) Rand |
| Ergebnis-Streifen | Kachel pro Frage: richtig Gelb mit Haken, falsch dunkel mit Kreuz |
| PDF-Zertifikat | Bold/Medium, Sektoren als abgerundete Kacheln |

## 8. Formen und Abstände

| Variable | Wert | Wofür |
|---|---|---|
| `--radius-s` | 4 px | Chips, Nummern, kleine Teile |
| `--radius-m` | 8 px | Buttons, Eingabefelder, Symbol-Kacheln |
| `--radius-l` | 12 px | Bausteine, Kästen, Dialoge, Karten |
| `--radius-pill` | rund | Schalter, Statusbar |
| `--border-ds` | 2 px | gelbe Ränder an Kacheln, Schaltern, aktiven Elementen |

Keine Schatten, keine Verläufe als Dekoration (einzige Ausnahme: die Schraffur aus zwei
Volltonfarben). Bewegung nur als Reaktion auf eine Aktion; bei „Bewegung reduzieren" aus.

## 9. Neue Elemente gestalten

1. Gibt es das Element im Designsystem? Dann genau so übernehmen.
2. Wenn nicht: an das nächstverwandte Element anlehnen – Aktion → Button, Zustand an/aus →
   Schalter, Symbol → Kachel, Fortschritt → Statusbar, Fläche → `--radius-l`.
3. Nur die Farben aus Abschnitt 1, nur erlaubte Schrift-Hintergrund-Paare.
4. Beispiel in `designsystem.html` ergänzen und hier unter „Erweiterungen" eintragen.
