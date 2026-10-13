/*
 * theme.js – Umschalten zwischen dunklem und hellem Design
 *
 * Funktionsweise:
 *   – Die Farben selbst stehen in css/tokens.css. Dieses Modul setzt nur das Attribut
 *     data-theme="dark" oder "light" auf <html>. Ohne Attribut gilt die Systemeinstellung.
 *   – Die Wahl wird im Fortschritt gespeichert (Feld theme: 'system' | 'dark' | 'light').
 *   – Beim Laden setzt js/core/theme-init.js das Attribut schon vor dem ersten Zeichnen.
 *
 * Zusammenspiel: main.js verbindet den Knopf in der Kopfleiste; die Einstellungsseite
 * (js/views/settings.js) bietet zusätzlich „Wie System".
 *
 * Wenn du hier etwas ändern willst …
 *   – Beschriftung des Knopfes: in updateToggle().
 */

(function () {
  "use strict";

  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  /**
   * Setzt das Farbschema auf der Seite.
   * @param {'system'|'dark'|'light'} choice
   * @param {Document} [doc]  anderes Dokument, z. B. die Vorschau im Editor
   */
  function applyTheme(choice, doc = document) {
    if (choice === "dark" || choice === "light") {
      doc.documentElement.dataset.theme = choice;
    } else {
      delete doc.documentElement.dataset.theme;
    }
  }

  /**
   * Welches Schema ist gerade tatsächlich sichtbar?
   * @returns {'dark'|'light'}
   */
  function effectiveTheme() {
    const forced = document.documentElement.dataset.theme;
    if (forced === "dark" || forced === "light") {
      return forced;
    }
    // Ohne ausdrückliche Wahl ist Dunkel Standard – außer das System ist ausdrücklich hell.
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  /**
   * Verbindet den Umschalt-Knopf mit dem Speicher. Der Knopf ist ein Schalter
   * (aria-pressed = „helles Design ist an").
   *
   * @param {HTMLButtonElement} button
   * @param {import('../core/store.js').Store} store
   */
  function setupThemeToggle(button, store) {
    function updateToggle() {
      button.setAttribute("aria-pressed", String(effectiveTheme() === "light"));
    }
    button.addEventListener("click", () => {
      const next = effectiveTheme() === "light" ? "dark" : "light";
      applyTheme(next);
      store.update((state) => {
        state.theme = next;
      });
      updateToggle();
    });
    // Ändert jemand die Systemeinstellung, während „Wie System" aktiv ist.
    darkQuery.addEventListener("change", updateToggle);
    store.subscribe((state) => {
      applyTheme(state.theme);
      updateToggle();
    });
    updateToggle();
  }

  EM.define("js/ui/theme.js", { applyTheme, effectiveTheme, setupThemeToggle });
})();
