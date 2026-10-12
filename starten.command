#!/bin/bash
# starten.command – Kurs und Editor auf dem Mac starten (Doppelklick im Finder)
#
# Was passiert:
#   1. Ein kleiner Webserver startet in diesem Ordner (Python 3, auf dem Mac meist vorhanden).
#   2. Der Browser öffnet den Kurs unter http://localhost:8765/
#   3. Dieses Terminalfenster offen lassen, solange du arbeitest. Schließen = Server aus.
#
# Warum überhaupt ein Server? Browser verbieten Webseiten, die per Doppelklick (file://)
# geöffnet werden, das Nachladen von Dateien. Der Kurs lädt aber seine Inhalte aus content/.
#
# Beim ersten Mal blockiert macOS das Skript evtl. („nicht verifizierter Entwickler"):
#   Rechtsklick auf die Datei → „Öffnen" → „Öffnen" bestätigen.
#
# Wenn du hier etwas ändern willst …
#   – Anderer Port: PORT unten ändern (dann auch in starten.bat und starten.sh).

PORT=8765
cd "$(dirname "$0")" || exit 1
URL="http://localhost:$PORT/"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 wurde nicht gefunden."
  echo "Installiere es z. B. über https://www.python.org/downloads/ und starte dieses Skript erneut."
  read -r -p "Enter zum Schließen …"
  exit 1
fi

# Läuft auf dem Port schon etwas (z. B. ein zweiter Doppelklick)? Dann nur den Browser öffnen.
if curl -s -o /dev/null "$URL"; then
  echo "Der Server läuft bereits. Öffne $URL"
  open "$URL"
  exit 0
fi

echo "Starte den Kurs-Server auf $URL"
echo "Kurs:       $URL"
echo "Editor:     ${URL}editor.html"
echo "Prüfseite:  ${URL}pruefen.html"
echo
echo "Dieses Fenster offen lassen. Beenden mit Ctrl+C oder Fenster schließen."
(sleep 1 && open "$URL") &
exec python3 tools/server.py "$PORT"
