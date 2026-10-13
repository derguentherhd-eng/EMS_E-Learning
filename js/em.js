/*
 * em.js – das kleine Modulsystem des Projekts (muss als erstes Skript geladen werden)
 *
 * Warum kein „import/export"? Der Kurs soll per Doppelklick auf index.html laufen. Browser
 * blockieren JavaScript-Module (type="module") aber, wenn eine Seite direkt von der Festplatte
 * (file://) geöffnet wird. Klassische Skripte dürfen dagegen geladen werden. Deshalb meldet sich
 * jede Datei hier mit EM.define() an und holt sich, was sie braucht, mit EM.require().
 *
 * So sieht jede Datei aus:
 *
 *   (function () {
 *     'use strict';
 *     const { el } = EM.require('js/dom.js');      // statt: import { el } from './dom.js';
 *     function machWas() { … }
 *     EM.define('js/beispiel.js', { machWas });    // statt: export function machWas …
 *   })();
 *
 * Die Reihenfolge, in der die Dateien geladen werden, steht in js/scripts.js. Eine Datei kann nur
 * benutzen, was VOR ihr geladen wurde – sonst meldet EM.require() verständlich, was fehlt.
 *
 * Einziges globales Objekt des Projekts ist window.EM (dazu window.jspdf aus der PDF-Bibliothek).
 *
 * Wenn du hier etwas ändern willst …
 *   – Normalerweise nie. Neue Dateien trägst du in js/scripts.js ein.
 */
(function () {
  'use strict';

  const modules = Object.create(null);

  window.EM = {
    /**
     * Meldet eine Datei mit ihren öffentlichen Funktionen an.
     * @param {string} name     Pfad ab Projektordner, z. B. 'js/dom.js'
     * @param {Object} exports  öffentliche Funktionen und Werte
     */
    define(name, exports) {
      if (name in modules) throw new Error(`${name} wurde doppelt geladen (js/scripts.js prüfen).`);
      modules[name] = Object.freeze({ ...exports });
    },

    /**
     * Holt die öffentlichen Funktionen einer anderen Datei.
     * @param {string} name  Pfad ab Projektordner, z. B. 'js/dom.js'
     * @returns {Object}
     */
    require(name) {
      if (!(name in modules)) {
        throw new Error(`${name} ist noch nicht geladen. In js/scripts.js muss die Datei vor der Datei stehen, die sie benutzt.`);
      }
      return modules[name];
    },

    /** Kursinhalte für den Betrieb ohne Server (wird von content/inhalte.js gefüllt). */
    inhalte: null,
  };
})();
