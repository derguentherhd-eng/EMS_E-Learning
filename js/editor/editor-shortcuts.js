/*
 * editor-shortcuts.js – Tastenkürzel und Warnung beim Verlassen im Editor
 *
 * Zweck: Strg/Cmd+Z (Rückgängig), Strg/Cmd+Umschalt+Z oder Strg/Cmd+Y (Wiederholen) und
 * Strg/Cmd+S (Speichern) sowie die Browser-Warnung bei ungespeicherten Änderungen.
 *
 * Wichtig: In Eingabefeldern (input, textarea, select, contenteditable) gehören Strg/Cmd+Z und
 * +Y dem Browser – dort wird das Tippen rückgängig gemacht, nicht der Editor-Schritt. Nur
 * Strg/Cmd+S speichert überall.
 *
 * Zusammenspiel: Wird einmal von js/pages/editor.js über installShortcuts() eingerichtet.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neues Kürzel: in der keydown-Funktion ergänzen und prüfen, ob es in Eingabefeldern
 *     erlaubt sein soll (isEditableTarget).
 */

(function () {
  "use strict";

  /**
   * Ist das Ziel ein Feld, in dem der Browser eigenes Rückgängig/Wiederholen hat?
   * @param {EventTarget|null} target
   * @returns {boolean}
   */
  function isEditableTarget(target) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    return (
      target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
    );
  }

  /**
   * @typedef {Object} ShortcutHandlers
   * @property {() => boolean} isReady  true, sobald ein Kurs geladen ist
   * @property {() => void} undo
   * @property {() => void} redo
   * @property {() => void} save
   * @property {() => boolean} isDirty  gibt es ungespeicherte Änderungen?
   */

  /**
   * Richtet Tastenkürzel und die Warnung beim Verlassen der Seite ein.
   * @param {ShortcutHandlers} handlers
   */
  function installShortcuts(handlers) {
    document.addEventListener("keydown", (event) => {
      if (!handlers.isReady() || !(event.ctrlKey || event.metaKey)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        handlers.save();
        return;
      }
      if (key !== "z" && key !== "y") {
        return;
      }
      if (isEditableTarget(event.target)) {
        return; // Browser-eigenes Rückgängig im Feld
      }
      event.preventDefault();
      if (key === "z" && !event.shiftKey) {
        handlers.undo();
      } else {
        handlers.redo();
      }
    });

    window.addEventListener("beforeunload", (event) => {
      if (handlers.isDirty()) {
        event.preventDefault();
        event.returnValue = "";
      }
    });
  }

  EM.define("js/editor/editor-shortcuts.js", { installShortcuts });
})();
