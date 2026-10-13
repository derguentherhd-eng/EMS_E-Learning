/*
 * safety-record-view.js – Abschnitt „Dein Nachweis" für Sicherheitskapitel
 *
 * Erscheint auf der Ergebnisseite des Quiz und auf Seite 1 des Kapitels, sobald das Quiz eines
 * Sicherheitskapitels (aktuelle Version) bestanden ist: Name eingeben → PDF herunterladen
 * (js/course/safety-record.js) → bei der Projektleitung abgeben.
 *
 * Wenn du hier etwas ändern willst …
 *   – Texte: renderSafetyRecord() unten.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { isSafetyChapter } = EM.require("js/content/documents.js");
  const { downloadSafetyRecord } = EM.require("js/course/safety-record.js");

  /**
   * Liefert den Abschnitt „Dein Nachweis" – oder null, wenn (noch) kein Nachweis möglich ist.
   * @param {{course: Object, chapter: Object, store: import("../core/store.js").Store}} options
   * @returns {HTMLElement|null}
   */
  function renderSafetyRecord({ course, chapter, store }) {
    if (!isSafetyChapter(chapter)) {
      return null;
    }
    const state = store.get();
    const result = state.results[chapter.id];
    if (
      !result ||
      result.version !== chapter.meta.version ||
      !result.passedAfter
    ) {
      return null;
    }

    const inputId = `safety-name-${chapter.id}`;
    const status = el("p", { class: "certificate__status", role: "status" });
    const error = el(
      "p",
      { class: "field__error", id: `${inputId}-error`, hidden: true },
      "Bitte gib deinen Namen ein – er steht auf dem Nachweis.",
    );
    const input = el("input", {
      type: "text",
      id: inputId,
      autocomplete: "name",
      required: true,
      value: state.name,
      "aria-describedby": `${inputId}-hint ${inputId}-error`,
      class: "field__input",
    });

    const form = el(
      "form",
      { class: "safety-record stack", novalidate: true },
      el("h2", {}, "Dein Nachweis"),
      el(
        "p",
        {},
        `Bestanden im ${result.passedAfter}. Anlauf. Lade deinen Nachweis herunter und gib ihn bei der Projektleitung ab.`,
      ),
      el(
        "div",
        { class: "field" },
        el("label", { for: inputId }, "Dein Name"),
        el(
          "p",
          { class: "field__hint", id: `${inputId}-hint` },
          "So, wie er auf dem Nachweis stehen soll. Der Name bleibt nur in diesem Browser.",
        ),
        input,
        error,
      ),
      el(
        "div",
        { class: "block__actions" },
        el(
          "button",
          { type: "submit", class: "button button--primary button--large" },
          "Nachweis als PDF herunterladen",
        ),
      ),
      status,
    );

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (name === "") {
        error.hidden = false;
        input.setAttribute("aria-invalid", "true");
        input.focus();
        return;
      }
      error.hidden = true;
      input.removeAttribute("aria-invalid");
      store.update((draft) => {
        draft.name = name;
      });
      status.textContent = "Nachweis wird erstellt …";
      try {
        const fileName = await downloadSafetyRecord(
          {
            name,
            date: result.passedDate ?? result.date,
            attempts: result.passedAfter,
            percent: result.best,
            chapterTitle: chapter.meta.titel,
            chapterVersion: chapter.meta.version,
            team: course.meta.team ?? "",
          },
          course.meta.logo ?? "",
        );
        status.textContent = `Fertig: ${fileName} wurde heruntergeladen. Gib ihn bei der Projektleitung ab.`;
      } catch {
        status.textContent =
          "Das PDF konnte nicht erzeugt werden. Bitte die Seite neu laden und es noch einmal versuchen.";
      }
    });
    return form;
  }

  EM.define("js/views/safety-record-view.js", { renderSafetyRecord });
})();
