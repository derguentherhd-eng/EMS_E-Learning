#!/bin/sh
# starten.sh – Kurs und Editor unter Linux starten
#
# Ausführen: im Dateimanager „Als Programm ausführen" oder im Terminal: sh starten.sh
# Startet einen kleinen Webserver (Python 3) und öffnet http://localhost:8765/ im Browser.
# Das Terminal offen lassen, solange du arbeitest.
#
# Warum ein Server? Per Doppelklick geöffnete Seiten (file://) dürfen keine Dateien
# nachladen – der Kurs lädt seine Inhalte aber aus content/.
#
# Wenn du hier etwas ändern willst …
#   – Anderer Port: PORT ändern (dann auch in starten.command und starten.bat).

PORT=8765
cd "$(dirname "$0")" || exit 1
URL="http://localhost:$PORT/"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 wurde nicht gefunden. Installiere es über die Paketverwaltung (z. B. sudo apt install python3)."
  exit 1
fi

if command -v curl >/dev/null 2>&1 && curl -s -o /dev/null "$URL"; then
  echo "Der Server läuft bereits. Öffne $URL"
  xdg-open "$URL" >/dev/null 2>&1
  exit 0
fi

echo "Kurs:       $URL"
echo "Editor:     ${URL}editor.html"
echo "Prüfseite:  ${URL}pruefen.html"
echo "Beenden mit Ctrl+C."
(sleep 1 && xdg-open "$URL" >/dev/null 2>&1) &
exec python3 -m http.server "$PORT" --bind 127.0.0.1
