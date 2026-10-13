/*
 * not-found.js – Ansicht „Seite nicht gefunden"
 *
 * Erscheint bei unbekannten Adressen und bei Kapiteln, die es nicht (mehr) gibt.
 *
 * Wenn du hier etwas ändern willst …
 *   – Nur Texte; die Ansicht ist absichtlich schlicht.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");

  /**
   * @param {string} [reason]  Erklärung, warum die Seite fehlt
   * @returns {import("./view-types.js").ViewResult}
   */
  function renderNotFound(reason = "Diese Adresse gibt es im Kurs nicht.") {
    return {
      title: "Seite nicht gefunden",
      node: el(
        "div",
        { class: "stack" },
        el("h1", {}, "Seite nicht gefunden"),
        el("p", { class: "lead" }, reason),
        el(
          "p",
          {},
          el(
            "a",
            { class: "button button--primary", href: "#/" },
            "Zur Startseite",
          ),
        ),
      ),
    };
  }

  EM.define("js/views/not-found.js", { renderNotFound });
})();
