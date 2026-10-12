"""server.py – kleiner Webserver für Kurs, Editor und Prüfseite (wird von den Startskripten gestartet)

Wie `python3 -m http.server`, aber mit zwei Ergänzungen:
  1. Cache-Control: no-cache – der Browser fragt bei jedem Laden nach, ob sich eine Datei
     geändert hat. Ohne das zeigt er nach einer Änderung am Code manchmal die alte Fassung.
  2. Feste Dateitypen für .js, .md, .woff2 und .svg – manche Systeme liefern sonst falsche
     Typen, und Browser verweigern dann das Laden von JavaScript-Modulen.

Der Server ist nur von diesem Rechner aus erreichbar (127.0.0.1), nicht im Netzwerk.

Aufruf: python3 tools/server.py [Port]   (Standard-Port 8765)
"""

import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.md': 'text/markdown; charset=utf-8',
        '.woff2': 'font/woff2',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler) as server:
        print(f'Server läuft auf http://localhost:{PORT}/ (Beenden mit Ctrl+C)')
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
