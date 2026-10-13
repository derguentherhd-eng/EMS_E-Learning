/*
 * dom.js – kleiner, sicherer Helfer zum Bauen von HTML-Elementen
 *
 * Warum?
 *   Inhalte aus den Markdown-Dateien dürfen NIE als HTML interpretiert werden (Sicherheit:
 *   sonst könnte jemand Skripte einschleusen). Deshalb baut das Projekt alle Elemente mit
 *   document.createElement und setzt Text ausschließlich über Textknoten. innerHTML wird
 *   nirgends mit Inhalten benutzt. Diese Datei macht das bequem und lesbar.
 *
 * Zusammenspiel: Wird von fast allen Modulen in js/ verwendet (Kurs, Bausteine, Editor).
 *
 * Wenn du hier etwas ändern willst …
 *   – Bitte keine Möglichkeit einbauen, HTML-Text direkt einzufügen. Das ist Absicht.
 */

(function () {
  "use strict";

  /**
   * @typedef {string|number|Node|null|undefined|false} Child
   *   Kindelemente: Text (wird immer als Text eingefügt, nie als HTML), Knoten, oder
   *   null/undefined/false (wird ignoriert – praktisch für Bedingungen).
   */

  /**
   * Erzeugt ein Element.
   *
   * @param {string} tag  z. B. 'button'
   * @param {Object<string, any>} [attrs]
   *        – 'class': Klassen als Text
   *        – 'on<Ereignis>' mit Funktion: Event-Listener, z. B. onclick, oninput
   *        – true: Attribut ohne Wert (z. B. hidden: true), false/null/undefined: weglassen
   *        – alles andere: Attribut mit Text-Wert
   * @param {...(Child|Child[])} children
   * @returns {HTMLElement}
   * @example
   *   el('button', { class: 'button', type: 'button', onclick: () => alert('Hi') }, 'Klick');
   */
  function el(tag, attrs = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs ?? {})) {
      if (value === false || value === null || value === undefined) {
        continue;
      }
      if (key.startsWith("on") && typeof value === "function") {
        element.addEventListener(key.slice(2), value);
      } else if (value === true) {
        element.setAttribute(key, "");
      } else {
        element.setAttribute(key, String(value));
      }
    }
    append(element, ...children);
    return element;
  }

  /**
   * Hängt Kinder an ein Element an. Texte werden als Textknoten eingefügt.
   * @param {Node} parent
   * @param {...(Child|Child[])} children
   * @returns {Node} parent
   */
  function append(parent, ...children) {
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined || child === false) {
        continue;
      }
      parent.append(
        child instanceof Node ? child : document.createTextNode(String(child)),
      );
    }
    return parent;
  }

  /** Zähler für uniqueId(). */
  let idCounter = 0;

  /**
   * Liefert eine fortlaufende, seitenweit eindeutige ID (für aria-controls, label for …).
   * @param {string} [prefix]
   * @returns {string}
   */
  function uniqueId(prefix = "id") {
    idCounter += 1;
    return `${prefix}-${idCounter}`;
  }

  EM.define("js/core/dom.js", { el, append, uniqueId });
})();
