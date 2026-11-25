/*
 * page-canvas.js – mittlere Spalte des Editors und die Formulare der rechten Spalte
 *
 * Mittlere Spalte, je nach Auswahl in der Kursstruktur:
 *   Kurseinstellungen · Glossar (glossary-editor.js) · Kapitelübersicht (Kopfbereich,
 *   Seitenliste, Kapitel-Aktionen) · Seite (Baukasten mit Elementen) · Quiz (quiz-editor.js)
 *
 * Baukasten einer Seite: Jedes Element ist eine Karte mit ↑ ↓ (verschieben), Duplizieren,
 * Entfernen und Auf-/Zuklappen. Zwischen den Karten fügt „+ Element einfügen" über die
 * Palette Neues ein. Die Palette enthält Textabschnitt, Bild und ALLE Bausteine aus
 * registry.js – ein neuer Baustein erscheint dort automatisch.
 *
 * Quelltext: Jede Seite lässt sich als Kursdown-Text bearbeiten. Beim Zurückschalten wird der
 * Text neu eingelesen. Was nicht lesbar ist, bleibt als „Nicht lesbarer Abschnitt" erhalten –
 * der Editor verwirft nie Inhalte.
 *
 * Rechte Spalte (renderProperties): Formular des ausgewählten Elements, gebaut aus dem
 * Schema des Bausteins (field-renderers.js).
 *
 * Aufgeteilt in: canvas-elements.js (Karten, Palette), canvas-fields.js (Felder,
 * rechte Spalte), canvas-dnd.js (Verschieben/Ziehen). Diese Datei bleibt der
 * öffentliche Einstieg (renderMiddle, renderProperties) und baut die Ansichten.
 *
 * Wenn du hier etwas ändern willst …
 *   – Felder der Kurseinstellungen/des Kapitelkopfs: canvas-fields.js.
 *   – Karten und Palette: canvas-elements.js. Verschieben: canvas-dnd.js.
 *   – Dauerschätzung: WORDS_PER_MINUTE & Co. unten.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { getBlock } = EM.require("js/blocks/registry.js");
  const { parseBody, isSafetyChapter } = EM.require("js/content/documents.js");
  const { serializeElement } = EM.require("js/content/serialize.js");
  const { countWords } = EM.require("js/content/markdown.js");
  const { renderFields, renderMarkdownField } = EM.require(
    "js/editor/field-renderers.js",
  );
  const { renderQuizEditor, quizChanged, versionNotice } = EM.require(
    "js/editor/quiz-editor.js",
  );
  const { renderGlossaryEditor } = EM.require("js/editor/glossary-editor.js");
  const { addDrag, movePage, movePageTo, duplicatePage } = EM.require(
    "js/editor/canvas-dnd.js",
  );
  const { insertButton, renderCard } = EM.require(
    "js/editor/canvas-elements.js",
  );
  const { CHAPTER_FIELDS, COURSE_FIELDS, middleContext, renderProperties } =
    EM.require("js/editor/canvas-fields.js");

  /** Lesetempo für die Schätzung (Wörter pro Minute). */
  const WORDS_PER_MINUTE = 180;
  /** Zeit je Interaktion (Minuten). */
  const MINUTES_PER_INTERACTION = 0.75;
  /** Zeit je Quizfrage (Minuten). */
  const MINUTES_PER_QUIZ_QUESTION = 0.4;
  /** Ab dieser relativen Abweichung von der angegebenen Dauer wird gewarnt. */
  const DURATION_TOLERANCE = 0.4;
  /** Ab dieser Wortzahl gilt eine Seite als zu lang für den Bildschirm. */
  const LONG_PAGE_WORDS = 250;
  /** Zeilenzahl der Quelltext-Ansicht. */
  const SOURCE_ROWS = 24;

  // ───────────────────────────── Mittlere Spalte ─────────────────────────────

  /**
   * Mittlere Spalte je nach Auswahl: Kurseinstellungen, Glossar, Quiz, Seite
   * oder Kapitelübersicht.
   * @param {Object} editor Editor-Objekt.
   * @returns {HTMLElement}
   */
  function renderMiddle(editor) {
    const { state } = editor;
    const selection = state.selection;
    if (selection.kind === "course") {
      return renderCourseSettings(editor);
    }
    if (selection.kind === "glossary") {
      return renderGlossaryEditor(editor);
    }
    const entry = editor.entryByFile(selection.file);
    if (!entry) {
      return el("p", {}, "Nichts ausgewählt.");
    }
    if (!entry.model) {
      return renderBroken(entry);
    }
    if (selection.kind === "quiz") {
      return renderQuizEditor(editor, entry);
    }
    if (selection.kind === "page") {
      return renderPage(editor, entry, selection.page);
    }
    return renderChapterOverview(editor, entry);
  }

  /**
   * Mittlere Spalte für „Kurseinstellungen": Formular für die Felder aus
   * content/kurs.md.
   * @param {Object} editor Editor-Objekt.
   * @returns {HTMLElement}
   */
  function renderCourseSettings(editor) {
    const course = editor.state.doc.course;
    const context = middleContext(editor, "kurs");
    return el(
      "section",
      { class: "canvas stack" },
      el(
        "h2",
        { class: "editor-column__title", tabindex: -1 },
        "Kurseinstellungen",
      ),
      el("p", { class: "canvas__info" }, "Datei: content/kurs.md"),
      el(
        "div",
        { class: "form-grid" },
        renderFields(COURSE_FIELDS, course.meta, context),
      ),
      renderMarkdownField({
        id: "kurs-willkommen",
        label: el(
          "label",
          { for: "kurs-willkommen" },
          "Willkommenstext auf der Startseite",
        ),
        hint: null,
        hintId: null,
        value: course.welcome,
        set: (value) =>
          context.change(
            () => {
              course.welcome = value;
            },
            { key: "kurs-willkommen" },
          ),
        context,
      }),
    );
  }

  /**
   * Mittlere Spalte für ein Kapitel, das nicht gelesen werden konnte:
   * Fehler und Originaltext.
   * @param {Object} entry Kapiteleintrag ohne Modell.
   * @returns {HTMLElement}
   */
  function renderBroken(entry) {
    return el(
      "section",
      { class: "canvas stack" },
      el(
        "h2",
        { class: "editor-column__title", tabindex: -1 },
        `${entry.file} – nicht lesbar`,
      ),
      el(
        "p",
        { class: "notice notice--error" },
        "Der Kopfbereich dieser Datei ist kaputt (z. B. fehlt die abschließende Zeile ---). Damit nichts verloren geht, öffnet der Editor sie nicht. Bitte in einem Texteditor reparieren – die Prüfseite zeigt die genaue Zeile.",
      ),
      el("pre", { class: "canvas__source" }, entry.brokenText ?? ""),
    );
  }

  /**
   * Geschätzte Lesedauer in Minuten (Wörter + Interaktionen).
   * @param {Object[]} elements Elemente einer Seite.
   * @returns {{words: number, minutes: number}}
   */
  function estimateMinutes(elements) {
    let words = 0;
    let interactions = 0;
    for (const element of elements) {
      if (element.type === "text") {
        words += countWords(element.markdown);
      }
      if (element.type === "block") {
        words += countWords(
          JSON.stringify(element.data).replace(/["{}[\],:]/g, " "),
        );
        if (getBlock(element.name)?.interactive) {
          interactions += 1;
        }
      }
    }
    return {
      words,
      minutes:
        words / WORDS_PER_MINUTE + interactions * MINUTES_PER_INTERACTION,
    };
  }

  /**
   * Mittlere Spalte für ein Kapitel: Kopfdaten, Seitenliste und
   * Kapitel-Aktionen.
   * @param {Object} editor Editor-Objekt.
   * @param {Object} entry Kapiteleintrag.
   * @returns {HTMLElement}
   */
  function renderChapterOverview(editor, entry) {
    const model = entry.model;
    const { operations, state } = editor;
    const file = entry.file;
    const context = middleContext(editor, `kapitel-${model.id}`, file);
    const isActive = state.doc.course.meta.kapitel.includes(file);
    const total =
      model.pages.reduce(
        (sum, page) => sum + estimateMinutes(page.elements).minutes,
        0,
      ) +
      (model.quiz
        ? model.quiz.data.questions.length * MINUTES_PER_QUIZ_QUESTION
        : 0);
    const location =
      entry.location === "archiv"
        ? "archiviert"
        : isActive
          ? "aktiv im Kurs"
          : "inaktiv (nicht im Kurs)";

    const actions = el(
      "div",
      { class: "canvas__actions" },
      el(
        "button",
        {
          type: "button",
          class: "button button--small",
          onclick: () => operations.openInCourse(file),
        },
        "Im Kurs testen",
      ),
      el(
        "button",
        {
          type: "button",
          class: "button button--small",
          onclick: () => operations.renameFile(file),
        },
        "Dateiname an Titel anpassen",
      ),
      el(
        "button",
        {
          type: "button",
          class: "button button--small",
          onclick: () => operations.duplicateChapter(file),
        },
        "Duplizieren",
      ),
      entry.location === "kapitel"
        ? isActive
          ? el(
              "button",
              {
                type: "button",
                class: "button button--small",
                onclick: () => operations.deactivate(file),
              },
              "Deaktivieren",
            )
          : el(
              "button",
              {
                type: "button",
                class: "button button--small",
                onclick: () => operations.activate(file),
              },
              "Aktivieren",
            )
        : null,
      entry.location === "kapitel"
        ? el(
            "button",
            {
              type: "button",
              class: "button button--small",
              onclick: () => operations.archive(file),
            },
            "Archivieren",
          )
        : el(
            "button",
            {
              type: "button",
              class: "button button--small",
              onclick: () => operations.restore(file),
            },
            "Wiederherstellen",
          ),
    );

    // Sicherheitskapitel: Feld „freigegeben" an-/abschalten und setzen.
    const safety = isSafetyChapter(model);
    const safetyToggle = el("input", {
      type: "checkbox",
      id: `${model.id}-safety`,
      checked: safety,
    });
    safetyToggle.addEventListener("change", () =>
      editor.commit(
        () => {
          if (safetyToggle.checked) {
            model.meta.freigegeben = "nein";
          } else {
            delete model.meta.freigegeben;
          }
        },
        { releaseField: true, chapter: file },
      ),
    );
    const releaseSelect = el(
      "select",
      { id: `${model.id}-release`, class: "field__input" },
      ["nein", "ja"].map((value) =>
        el(
          "option",
          { value, selected: String(model.meta.freigegeben) === value },
          value,
        ),
      ),
    );
    releaseSelect.addEventListener("change", () =>
      editor.commit(
        () => {
          model.meta.freigegeben = releaseSelect.value;
        },
        { releaseField: true, chapter: file, source: "middle" },
      ),
    );

    const pages = el(
      "ol",
      { class: "page-list" },
      model.pages.map((page, index) => {
        const item = el(
          "li",
          { class: "page-list__item", draggable: "true" },
          el(
            "button",
            {
              type: "button",
              class: "page-list__open",
              onclick: () => editor.select({ kind: "page", file, page: index }),
            },
            `${index + 1}. ${page.title || "(ohne Titel)"}`,
          ),
          el(
            "span",
            { class: "page-list__meta" },
            `${page.elements.length} Element(e) · ca. ${Math.max(1, Math.round(estimateMinutes(page.elements).minutes))} min`,
          ),
          el(
            "span",
            { class: "page-list__actions" },
            el(
              "button",
              {
                type: "button",
                class: "button button--small",
                disabled: index === 0,
                "aria-label": `Seite „${page.title}" nach oben`,
                onclick: () => movePage(editor, file, index, -1),
              },
              "↑",
            ),
            el(
              "button",
              {
                type: "button",
                class: "button button--small",
                disabled: index === model.pages.length - 1,
                "aria-label": `Seite „${page.title}" nach unten`,
                onclick: () => movePage(editor, file, index, 1),
              },
              "↓",
            ),
            el(
              "button",
              {
                type: "button",
                class: "button button--small",
                "aria-label": `Seite „${page.title}" duplizieren`,
                onclick: () => duplicatePage(editor, file, index),
              },
              "Duplizieren",
            ),
            el(
              "button",
              {
                type: "button",
                class: "button button--small",
                "aria-label": `Seite „${page.title}" entfernen`,
                onclick: () => operations.removePage(file, index),
              },
              "Entfernen",
            ),
          ),
        );
        addDrag(item, "text/x-page", index, (from) =>
          movePageTo(editor, file, from, index),
        );
        return item;
      }),
    );

    return el(
      "section",
      { class: "canvas stack" },
      el(
        "h2",
        { class: "editor-column__title", tabindex: -1 },
        model.meta.titel || file,
      ),
      el(
        "p",
        { class: "canvas__info" },
        `Datei: ${editor.chapterPath(entry)} · ${location}`,
      ),
      el(
        "p",
        {
          class: `canvas__info${Math.abs(total - Number(model.meta.dauer)) > Number(model.meta.dauer) * DURATION_TOLERANCE ? " canvas__info--warn" : ""}`,
        },
        `Geschätzte Dauer: ca. ${Math.max(1, Math.round(total))} min · angegeben: ${model.meta.dauer ?? "–"} min`,
      ),
      actions,
      quizChanged(editor, entry) ? versionNotice(editor, entry) : null,
      el("h3", { class: "canvas__heading" }, "Kopfbereich"),
      el(
        "div",
        { class: "form-grid" },
        renderFields(CHAPTER_FIELDS, model.meta, context),
      ),
      el(
        "div",
        { class: "field field--inline" },
        safetyToggle,
        el(
          "label",
          { for: `${model.id}-safety` },
          "Enthält Sicherheitsinhalte (Freigabe durch die Werkstattleitung nötig)",
        ),
      ),
      safety
        ? el(
            "div",
            { class: "field" },
            el("label", { for: `${model.id}-release` }, "Freigegeben"),
            el(
              "p",
              { class: "field__hint" },
              'Nur auf „ja" setzen, wenn die Werkstattleitung die aktuelle Fassung geprüft hat. Jede spätere Änderung setzt den Wert automatisch auf „nein".',
            ),
            releaseSelect,
          )
        : null,
      el("h3", { class: "canvas__heading" }, `Seiten (${model.pages.length})`),
      pages,
      el(
        "button",
        {
          type: "button",
          class: "button button--small",
          onclick: () => operations.addPage(file, model.pages.length - 1),
        },
        "+ Seite hinzufügen",
      ),
      el("h3", { class: "canvas__heading" }, "Quiz"),
      model.quiz
        ? el(
            "button",
            {
              type: "button",
              class: "button button--small",
              onclick: () => editor.select({ kind: "quiz", file }),
            },
            `Quiz bearbeiten (${model.quiz.data.questions.length} Fragen)`,
          )
        : el(
            "button",
            {
              type: "button",
              class: "button button--small",
              onclick: () => operations.createQuiz(file),
            },
            "+ Quiz anlegen",
          ),
    );
  }

  // ───────────────────────────── Seite (Baukasten) ─────────────────────────────

  /**
   * Mittlere Spalte für eine Seite: Titel und die Elemente als Karten
   * (der Baukasten) bzw. die Quelltext-Ansicht.
   * @param {Object} editor Editor-Objekt.
   * @param {Object} entry Kapiteleintrag.
   * @param {number} pageIndex Index der Seite.
   * @returns {HTMLElement}
   */
  function renderPage(editor, entry, pageIndex) {
    const { state } = editor;
    const model = entry.model;
    const page = model.pages[pageIndex];
    const file = entry.file;
    const estimate = estimateMinutes(page.elements);

    const titleInput = el("input", {
      type: "text",
      id: `page-title-${model.id}-${pageIndex}`,
      value: page.title,
      class: "field__input",
    });
    titleInput.addEventListener("input", () =>
      editor.commit(
        () => {
          page.title = titleInput.value;
        },
        { source: "middle", coalesce: titleInput.id, chapter: file },
      ),
    );

    const sourceToggle = el(
      "button",
      {
        type: "button",
        class: "button button--small",
        "aria-pressed": String(state.ui.sourceView),
      },
      state.ui.sourceView ? "Zurück zum Baukasten" : "Quelltext anzeigen",
    );

    let body;
    if (state.ui.sourceView) {
      const textarea = el(
        "textarea",
        {
          id: "page-source",
          class: "field__input field__textarea canvas__source-input",
          rows: SOURCE_ROWS,
          spellcheck: "false",
        },
        pageSource(page),
      );
      const problems = el("div", { role: "status" });
      sourceToggle.addEventListener("click", () => {
        const result = applySource(editor, entry, pageIndex, textarea.value);
        if (!result.ok) {
          problems.replaceChildren(
            el("p", { class: "notice notice--error" }, result.message),
          );
          return;
        }
        state.ui.sourceView = false;
        editor.rerenderMiddle();
      });
      body = el(
        "div",
        { class: "field" },
        el("label", { for: "page-source" }, "Kursdown-Quelltext dieser Seite"),
        el(
          "p",
          { class: "field__hint" },
          'Beim Zurückschalten wird der Text neu eingelesen. Nicht lesbare Abschnitte bleiben erhalten und erscheinen im Baukasten als „Nicht lesbarer Abschnitt".',
        ),
        textarea,
        problems,
      );
    } else {
      sourceToggle.addEventListener("click", () => {
        state.ui.sourceView = true;
        editor.rerenderMiddle();
        document.getElementById("page-source")?.focus();
      });
      const items = [];
      page.elements.forEach((element, index) => {
        items.push(insertButton(editor, entry, pageIndex, index));
        items.push(renderCard(editor, entry, pageIndex, index));
      });
      items.push(insertButton(editor, entry, pageIndex, page.elements.length));
      body = el(
        "ol",
        { class: "cards", "aria-label": "Elemente dieser Seite" },
        items,
      );
    }

    return el(
      "section",
      { class: "canvas stack" },
      el(
        "h2",
        { class: "editor-column__title", tabindex: -1 },
        `Seite ${pageIndex + 1} von ${model.pages.length} · ${model.meta.kurztitel || model.meta.titel}`,
      ),
      el(
        "div",
        { class: "field" },
        el("label", { for: titleInput.id }, "Seitentitel (## im Text)"),
        titleInput,
      ),
      el(
        "p",
        {
          class: `canvas__info${estimate.words > LONG_PAGE_WORDS ? " canvas__info--warn" : ""}`,
        },
        `ca. ${Math.max(1, Math.round(estimate.minutes))} min · ${estimate.words} Wörter${estimate.words > LONG_PAGE_WORDS ? " – eher lang für eine Bildschirmseite" : ""}`,
      ),
      el(
        "div",
        { class: "canvas__actions" },
        sourceToggle,
        el(
          "button",
          {
            type: "button",
            class: "button button--small",
            onclick: () => duplicatePage(editor, file, pageIndex),
          },
          "Seite duplizieren",
        ),
        el(
          "button",
          {
            type: "button",
            class: "button button--small",
            onclick: () => editor.operations.removePage(file, pageIndex),
          },
          "Seite entfernen",
        ),
        el(
          "button",
          {
            type: "button",
            class: "button button--small",
            onclick: () => editor.operations.addPage(file, pageIndex),
          },
          "+ Neue Seite danach",
        ),
        el(
          "button",
          {
            type: "button",
            class: "button button--small",
            onclick: () => editor.operations.openInCourse(file, pageIndex + 1),
          },
          "Im Kurs testen",
        ),
      ),
      body,
    );
  }

  /**
   * Kursdown-Text einer Seite (für die Quelltext-Ansicht).
   * @param {Object} page Seite mit title und elements.
   * @returns {string}
   */
  function pageSource(page) {
    return [`## ${page.title}`, ...page.elements.map(serializeElement)].join(
      "\n\n",
    );
  }

  /**
   * Liest bearbeiteten Quelltext ein und ersetzt die Seite (bzw. mehrere
   * Seiten, falls weitere „## "-Überschriften hinzugekommen sind).
   * @param {Object} editor Editor-Objekt.
   * @param {Object} entry Kapiteleintrag.
   * @param {number} pageIndex Index der Seite.
   * @param {string} text Bearbeiteter Kursdown-Text.
   * @returns {{ok: boolean, message?: string}}
   */
  function applySource(editor, entry, pageIndex, text) {
    const items = parseBody(text, 1, entry.model.path);
    if (items[0]?.type !== "page") {
      return {
        ok: false,
        message:
          'Der Quelltext muss mit einer Zeile „## Seitentitel" beginnen.',
      };
    }
    const pages = [];
    for (const item of items) {
      if (item.type === "page") {
        pages.push({ title: item.title, elements: [], line: 0 });
      } else {
        pages[pages.length - 1].elements.push(item);
      }
    }
    editor.commit(
      (doc) => {
        doc.chapters
          .find((candidate) => candidate.file === entry.file)
          .model.pages.splice(pageIndex, 1, ...pages);
      },
      { chapter: entry.file },
    );
    const unreadable = pages
      .flatMap((page) => page.elements)
      .filter((element) => element.type === "raw").length;
    editor.setStatus(
      unreadable > 0
        ? `Übernommen. ${unreadable} Abschnitt(e) sind nicht lesbar und als solche markiert.`
        : pages.length > 1
          ? `Übernommen – daraus sind ${pages.length} Seiten geworden.`
          : "Quelltext übernommen.",
    );
    return { ok: true };
  }

  EM.define("js/editor/page-canvas.js", { renderMiddle, renderProperties });
})();
