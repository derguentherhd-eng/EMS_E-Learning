/*
 * glossary.js – Glossar-Popover für [[Begriffe]] im Text
 *
 * Ein Fachbegriff erscheint als Knopf im Fließtext. Ein Klick (oder Enter/Leertaste) öffnet
 * ein kleines Fenster mit der Erklärung aus content/glossar.md – ohne die Seite zu verlassen.
 * Escape oder ein Klick daneben schließt es.
 *
 * Technik: die native Popover-API des Browsers (Attribute popover/popovertarget). Sie kümmert
 * sich um Schließen per Escape, Klick daneben und Screenreader-Zustand („erweitert").
 * Ältere Browser ohne Popover-API bekommen ein einfaches Auf-/Zuklappen mit aria-expanded.
 *
 * Zusammenspiel: render.js ruft createGlossaryTerm() für jeden bekannten Begriff auf.
 *
 * Wenn du hier etwas ändern willst …
 *   – Aussehen: css/components/glossary-popover.css.
 */

(function () {
  "use strict";

  const { el, uniqueId } = EM.require("js/core/dom.js");
  const { glossaryHash } = EM.require("js/core/router.js");

  const supportsPopover =
    typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;

  /**
   * Erzeugt Knopf + Erklärfenster für einen Glossarbegriff.
   * @param {{term: string, text: string}} entry
   * @param {string} label  angezeigter Text im Fließtext
   * @returns {DocumentFragment}
   */
  function createGlossaryTerm(entry, label) {
    const id = uniqueId("glossar");
    const button = el(
      "button",
      { type: "button", class: "glossary-term" },
      label,
    );
    const panel = el(
      "span",
      { class: "glossary-popover", id },
      el("span", { class: "glossary-popover__term" }, entry.term),
      el("span", { class: "glossary-popover__text" }, entry.text),
      el(
        "a",
        { class: "glossary-popover__link", href: glossaryHash(entry.term) },
        "Im Glossar ansehen",
      ),
    );

    if (supportsPopover) {
      panel.setAttribute("popover", "");
      button.setAttribute("popovertarget", id);
      // Position direkt unter dem Begriff; das Fenster liegt in der obersten Ebene (top layer)
      // und wird deshalb per Koordinaten platziert.
      // beforetoggle: grob platzieren, bevor das Fenster sichtbar wird (kein Aufblitzen oben
      // links); toggle: fein justieren, sobald seine Größe bekannt ist.
      panel.addEventListener("beforetoggle", (event) => {
        if (event.newState === "open") {
          positionPanel(button, panel);
        }
      });
      panel.addEventListener("toggle", (event) => {
        if (event.newState !== "open") {
          return;
        }
        positionPanel(button, panel);
        // Das Fenster ist fest positioniert. Scrollt die Seite, würde es vom Begriff wegwandern –
        // deshalb schließt es beim ersten Scrollen.
        window.addEventListener(
          "scroll",
          () => panel.matches(":popover-open") && panel.hidePopover(),
          { once: true, passive: true },
        );
      });
      // Beim Folgen des Glossar-Links das Fenster schließen.
      panel
        .querySelector("a")
        ?.addEventListener("click", () => panel.hidePopover());
    } else {
      panel.hidden = true;
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", id);
      button.addEventListener("click", () => {
        const open = panel.hidden;
        panel.hidden = !open;
        button.setAttribute("aria-expanded", String(open));
      });
    }

    const fragment = document.createDocumentFragment();
    fragment.append(button, panel);
    return fragment;
  }

  /**
   * Platziert das Fenster unter (oder, wenn unten kein Platz ist, über) dem Begriff und hält es
   * im sichtbaren Bereich. Die Werte werden als CSS-Variablen gesetzt; die eigentliche
   * Gestaltung steht in css/components/glossary-popover.css.
   */
  function positionPanel(button, panel) {
    const margin = 8;
    const rect = button.getBoundingClientRect();
    const width = Math.min(panel.offsetWidth, window.innerWidth - 2 * margin);
    const left = Math.min(
      Math.max(margin, rect.left),
      window.innerWidth - width - margin,
    );
    const below = rect.bottom + margin;
    const fitsBelow = below + panel.offsetHeight < window.innerHeight - margin;
    const top = fitsBelow
      ? below
      : Math.max(margin, rect.top - panel.offsetHeight - margin);
    panel.style.setProperty("--popover-left", `${left}px`);
    panel.style.setProperty("--popover-top", `${top}px`);
  }

  EM.define("js/ui/glossary.js", { createGlossaryTerm });
})();
