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
