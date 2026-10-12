/*
 * theme-init.js – setzt das gespeicherte Farbschema, BEVOR die Seite gezeichnet wird
 *
 * Warum eine eigene, klassische Skriptdatei (kein ES-Modul)?
 *   ES-Module werden immer erst nach dem Aufbau der Seite ausgeführt. Hätte jemand „Hell"
 *   gewählt, sähe man beim Laden kurz das dunkle Theme aufblitzen. Dieses winzige Skript wird
 *   im <head> synchron geladen und verhindert das. Inline-Skripte sind im Projekt verboten,
 *   deshalb eine eigene Datei. Es ist die einzige Ausnahme von „nur ES-Module".
 *
 * Zusammenspiel: Liest denselben Speicher wie js/store.js (Schlüssel em-onboarding:v1, Feld
 * theme). Das Umschalten im Betrieb übernimmt js/ui/theme.js.
 *
 * Wenn du hier etwas ändern willst …
 *   – Speicher-Schlüssel geändert? Dann auch STORAGE_KEY in js/store.js anpassen.
 */
(function () {
  'use strict';
  try {
    const raw = window.localStorage.getItem('em-onboarding:v1');
    const theme = raw ? JSON.parse(raw).theme : null;
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (error) {
    // Kein Zugriff auf den Speicher (z. B. privater Modus): Systemeinstellung gilt.
  }
})();
