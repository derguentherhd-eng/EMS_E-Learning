/*
 * statusbar.js – Fortschrittsbalken im Stil des Designsystems („Statusbar")
 *
 * Lila Spur, gelbe Füllung, gelber Knopf mit lila Rand. Wird über Kapitelseiten („Seite 2 von 7")
 * und Quizfragen („Frage 3 von 10") angezeigt.
 *
 * Der Balken ist rein grafisch (aria-hidden): Die Zahl steht immer zusätzlich als Text daneben.
 * So hören Screenreader die Information nicht doppelt.
 *
 * Wenn du hier etwas ändern willst …
 *   – Aussehen: css/components/statusbar.css.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");

  /**
   * Erzeugt einen Fortschrittsbalken.
   * @param {number} current  erreichter Schritt (z. B. aktuelle Seite, ab 1)
   * @param {number} total    Anzahl der Schritte
   * @returns {HTMLElement}
   */
  function statusBar(current, total) {
    const bar = el("div", { class: "statusbar", "aria-hidden": "true" });
    const value = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0;
    bar.style.setProperty("--value", String(value));
    return bar;
  }

  EM.define("js/ui/statusbar.js", { statusBar });
})();
