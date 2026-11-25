/*
 * editor-validation.js – Live-Prüfung und Hinweisliste des Editors
 *
 * Zweck: Prüft den Kurs im Editor mit validate.js (plus didaktische Hinweise), zeichnet die
 * Hinweisliste rechts unten und springt per Klick zur betroffenen Stelle.
 *
 * Zusammenspiel: Wird von js/pages/editor.js über createValidation() angelegt. Den Zustand
 * (state), die Auswahl und die Hilfsfunktionen reicht der Editor als Kontext herein; das Ergebnis
 * landet in state.validation (liest auch editor-save.js, um vor dem Speichern zu warnen).
 *
 * Wenn du hier etwas ändern willst …
 *   – Wartezeit der Live-Prüfung: VALIDATION_DELAY_MS.
 *   – Aussehen der Liste: css/pages/editor.css (Klassen .hints__…).
 *   – Was geprüft wird: js/content/validate.js, nicht hier.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { validateCourse } = EM.require("js/content/validate.js");

  /**
   * Wartezeit (ms) nach der letzten Änderung, bevor die Prüfung läuft. Die Prüfung geht über
   * den ganzen Kurs; bei jedem Tastendruck wäre das spürbar träge.
   */
  const VALIDATION_DELAY_MS = 400;

  /**
   * @typedef {Object} ValidationContext
   * @property {Object} state  Editor-Zustand (doc, selection, ui, validation)
   * @property {HTMLElement} hintsRegion  Bereich der Hinweisliste
   * @property {(file: string) => Object|undefined} entryByFile
   * @property {(extraEntry?: Object|null) => Object} courseModel
   * @property {(entry: Object) => string} chapterPath
   * @property {(selection: Object) => void} select
   * @property {{course: string, glossary: string}} paths  Dateipfade von Kurs und Glossar
   */

  /**
   * Legt die Prüfung für einen Editor an.
   * @param {ValidationContext} context
   * @returns {{scheduleValidation: () => void, runValidation: () => void}}
   */
  function createValidation(context) {
    const {
      state,
      hintsRegion,
      entryByFile,
      courseModel,
      chapterPath,
      select,
      paths,
    } = context;

    let validationTimer = 0;
    /** Startet die Live-Prüfung kurz nach der letzten Änderung. */
    function scheduleValidation() {
      clearTimeout(validationTimer);
      validationTimer = setTimeout(runValidation, VALIDATION_DELAY_MS);
    }

    /** Live-Prüfung mit validate.js plus didaktische Hinweise. */
    function runValidation() {
      if (!state.doc) {
        return;
      }
      const selectedEntry = state.selection.file
        ? entryByFile(state.selection.file)
        : null;
      state.validation = validateCourse(
        courseModel(selectedEntry?.model ? selectedEntry : null),
        { didactic: true },
      );
      const currentPath = selectedEntry
        ? chapterPath(selectedEntry)
        : state.selection.kind === "glossary"
          ? paths.glossary
          : paths.course;
      const shown = state.ui.hintsAll
        ? state.validation
        : state.validation.filter((item) => item.file === currentPath);
      const errors = state.validation.filter(
        (item) => item.severity === "fehler",
      ).length;

      const toggle = el(
        "button",
        {
          type: "button",
          class: "button button--small",
          "aria-pressed": String(state.ui.hintsAll),
        },
        "Alle Dateien",
      );
      toggle.addEventListener("click", () => {
        state.ui.hintsAll = !state.ui.hintsAll;
        runValidation();
      });
      hintsRegion.replaceChildren(
        el(
          "div",
          { class: "hints__head" },
          el("h2", { class: "hints__title" }, `Hinweise (${shown.length})`),
          toggle,
        ),
        el(
          "p",
          { class: "hints__summary" },
          errors === 0
            ? "Keine Fehler im ganzen Kurs."
            : `${errors} Fehler im ganzen Kurs.`,
        ),
        shown.length === 0
          ? el(
              "p",
              { class: "hints__empty" },
              "Keine Hinweise für diese Datei.",
            )
          : el(
              "ul",
              { class: "hints__list" },
              shown.slice(0, 80).map(renderHint),
            ),
      );
    }

    /** Ein Eintrag in der Hinweisliste rechts (mit Sprung zur betroffenen Stelle). */
    function renderHint(item) {
      const label = {
        fehler: "Fehler",
        warnung: "Warnung",
        hinweis: item.kind === "todo" ? "Platzhalter" : "Hinweis",
      }[item.severity];
      const jump = item.ref ? () => jumpTo(item.ref) : null;
      const content = [
        el(
          "span",
          { class: `hints__badge hints__badge--${item.severity}` },
          label,
        ),
        " ",
        item.message,
      ];
      return el(
        "li",
        { class: "hints__item" },
        jump
          ? el(
              "button",
              { type: "button", class: "hints__jump", onclick: jump },
              content,
            )
          : el("p", {}, content),
        item.fix ? el("p", { class: "hints__fix" }, item.fix) : null,
      );
    }

    /** Springt zu dem Element, auf das eine Meldung zeigt. */
    function jumpTo(ref) {
      const entry = state.doc.chapters.find(
        (candidate) => candidate.model?.id === ref.chapterId,
      );
      if (!entry) {
        return;
      }
      if (ref.page === "quiz") {
        select({ kind: "quiz", file: entry.file });
      } else if (typeof ref.page === "number" && ref.page >= 0) {
        select({
          kind: "page",
          file: entry.file,
          page: ref.page,
          element: ref.element ?? undefined,
        });
      } else {
        select({ kind: "chapter", file: entry.file });
      }
    }

    return { scheduleValidation, runValidation };
  }

  EM.define("js/editor/editor-validation.js", { createValidation });
})();
