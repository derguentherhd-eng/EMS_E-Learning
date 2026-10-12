@echo off
rem starten.bat - Kurs und Editor unter Windows starten (Doppelklick)
rem
rem Was passiert:
rem   1. Ein kleiner Webserver startet in diesem Ordner.
rem      Bevorzugt Python 3 ("py" oder "python"). Ohne Python springt ein eingebauter
rem      PowerShell-Server ein (tools\server.ps1) - es muss nichts installiert werden.
rem   2. Der Browser oeffnet den Kurs unter http://localhost:8765/
rem   3. Dieses Fenster offen lassen, solange du arbeitest. Schliessen = Server aus.
rem
rem Warum ein Server? Per Doppelklick geoeffnete Seiten (file://) duerfen keine Dateien
rem nachladen - der Kurs laedt seine Inhalte aber aus content\.
rem
rem Wenn du hier etwas aendern willst ...
rem   - Anderer Port: PORT unten aendern (auch in starten.command und starten.sh).

chcp 65001 >nul
cd /d "%~dp0"
set PORT=8765
set URL=http://localhost:%PORT%/

echo Kurs:       %URL%
echo Editor:     %URL%editor.html
echo Pruefseite: %URL%pruefen.html
echo.
echo Dieses Fenster offen lassen. Beenden: Fenster schliessen oder Strg+C.
echo.

rem Browser nach zwei Sekunden oeffnen, damit der Server schon laeuft.
start "" /min cmd /c "timeout /t 2 /nobreak >nul & start "" %URL%"

py -3 -c "import sys" >nul 2>nul
if %errorlevel%==0 (
  py -3 tools\server.py %PORT%
  goto :ende
)

python -c "import sys" >nul 2>nul
if %errorlevel%==0 (
  python tools\server.py %PORT%
  goto :ende
)

echo Python wurde nicht gefunden - starte den eingebauten PowerShell-Server.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\server.ps1" -Port %PORT%

:ende
echo.
echo Der Server wurde beendet. Falls eine Fehlermeldung oben steht: Laeuft der Kurs
echo vielleicht schon in einem anderen Fenster? Dann einfach %URL% im Browser oeffnen.
pause
