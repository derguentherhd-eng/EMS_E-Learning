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
