/*
 * translation-editor.js – Handübersetzungen der Sicherheitsunterweisung im Editor
 *
 * Zeigt eine Übersetzung (content/uebersetzungen/…) Teil für Teil neben dem deutschen Original:
 * links das Original (nur lesen), rechts die Übersetzung (bearbeitbar). Teile sind der Kopfbereich
 * (Titel, Kurztitel, Lernziele), jede Seite und das Quiz – jeweils als Kursdown-Quelltext.
 * Oben steht, ob die Übersetzung zum Original passt (js/content/translations.js).
 *
 * Datenmodell: state.doc.translations = [{ chapterFile, language, file, model }]
 *   model ist ein ChapterModel wie bei Kapiteln; gespeichert wird mit serializeChapter()
 *   (editor-save.js), geladen in editor.js (loadProject).
 * Auswahl: { kind: 'translation', file: <deutsches Kapitel>, language: 'en' }, der gezeigte Teil
 *   steht in state.ui.translationPart ('kopf', 'quiz' oder Seitenindex).
 *
 * Wenn du hier etwas ändern willst …
 *   – Welche Kapitel Übersetzungen haben: needsHumanTranslation() in translations.js.
 *   – Prüfregeln: compareStructure() / translationStatus() in translations.js.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { parseBody } = EM.require("js/content/documents.js");
  const { serializeChapter, serializeElement } = EM.require(
    "js/content/serialize.js",
  );
  const {
    TRANSLATION_LANGUAGES,
    sourceStamp,
    translationPath,
    translationStatus,
  } = EM.require("js/content/translations.js");

  /** Zeilen der beiden Textfelder. */
  const SOURCE_ROWS = 26;

  /** Beschriftung des Zustands (aus translationStatus). */
  const STATE_TEXT = {
    aktuell: "Passt zum deutschen Original und wird im Kurs angezeigt.",
    pruefen:
      "Wird im Kurs angezeigt, aber der deutsche Text wurde seit der Übersetzung geändert.",
    veraltet: "Veraltet – Teilnehmende sehen das Kapitel deshalb auf Deutsch.",
    fehlerhaft:
      "Passt nicht zum Aufbau des Originals – Teilnehmende sehen das Kapitel deshalb auf Deutsch.",
  };

  /**
   * @param {Object} state  Editor-Zustand
   * @param {string} chapterFile
   * @param {string} language
   * @returns {Object|undefined}
   */
  function findTranslation(state, chapterFile, language) {
    return state.doc.translations.find(
      (entry) =>
        entry.chapterFile === chapterFile && entry.language === language,
    );
  }

  /** @param {Object} page */
  function pageSource(page) {
    return [`## ${page.title}`, ...page.elements.map(serializeElement)].join(
      "\n\n",
    );
  }

  /** Kopfbereich als einfacher Text: Titel, Kurztitel, Lernziele (eins pro Zeile). */
  function headSource(model) {
    return [
      `titel: ${model.meta.titel ?? ""}`,
      `kurztitel: ${model.meta.kurztitel ?? ""}`,
      "lernziele:",
      ...(model.meta.lernziele ?? []).map((goal) => `- ${goal}`),
    ].join("\n");
  }

  /**
   * Quelltext eines Teils.
   * @param {Object} model
   * @param {string|number} part
   * @returns {string}
   */
  function partSource(model, part) {
    if (part === "kopf") {
      return headSource(model);
    }
    if (part === "quiz") {
      return model.quiz ? serializeElement(model.quiz) : "";
    }
    return model.pages[part] ? pageSource(model.pages[part]) : "";
  }

  /**
   * Liest einen bearbeiteten Teil zurück ins Modell.
   * @returns {{ok: true, apply: (model: Object) => void}|{ok: false, message: string}}
   */
  function parsePart(model, part, text) {
    if (part === "kopf") {
      const meta = {};
      const goals = [];
      for (const line of text.split("\n")) {
        const goal = /^\s*-\s+(.*)$/.exec(line);
        const field = /^(titel|kurztitel):\s*(.*)$/.exec(line.trim());
        if (goal) {
          goals.push(goal[1].trim());
        } else if (field) {
          meta[field[1]] = field[2].trim();
        }
      }
      if (!meta.titel) {
        return { ok: false, message: "Die Zeile „titel: …“ fehlt." };
      }
      return {
        ok: true,
        apply: (target) => {
          target.meta.titel = meta.titel;
          target.meta.kurztitel = meta.kurztitel ?? "";
          target.meta.lernziele = goals;
        },
      };
    }
    const items = parseBody(text, 1, model.path);
    if (part === "quiz") {
      const quiz = items.find(
        (item) => item.type === "block" && item.name === "quiz",
      );
      if (!quiz || items.length !== 1) {
        return {
          ok: false,
          message:
            "Der Text muss genau einen Baustein „:::quiz … :::“ enthalten.",
        };
      }
      return {
        ok: true,
        apply: (target) => {
          target.quiz = quiz;
        },
      };
    }
    if (
      items[0]?.type !== "page" ||
      items.filter((i) => i.type === "page").length !== 1
    ) {
      return {
        ok: false,
        message:
          "Der Text muss mit genau einer Zeile „## Seitentitel“ beginnen (eine Seite, keine weitere „## “-Überschrift).",
      };
    }
    return {
      ok: true,
      apply: (target) => {
        target.pages[part] = {
          title: items[0].title,
          elements: items.slice(1),
          line: 0,
        };
      },
    };
  }

  /**
   * Mittlere Spalte für eine Übersetzung.
   * @param {Object} editor  Editor-Objekt (state, commit, entryByFile, setStatus …)
   * @returns {HTMLElement}
   */
  function renderTranslationEditor(editor) {
    const { state } = editor;
    const selection = state.selection;
    const german = editor.entryByFile(selection.file)?.model;
    const language = TRANSLATION_LANGUAGES.find(
      (candidate) => candidate.code === selection.language,
    );
    if (!german || !language) {
      return el("p", {}, "Nichts ausgewählt.");
    }
    const path = translationPath(german.file, language.code);
    const heading = el(
      "h2",
      { class: "editor-column__title", tabindex: -1 },
      `Übersetzung ${language.name} · ${german.meta.kurztitel || german.meta.titel}`,
    );
    const entry = findTranslation(state, german.file, language.code);
    if (!entry) {
      return el(
        "section",
        { class: "canvas stack" },
        heading,
        el("p", { class: "canvas__info" }, `Datei: ${path}`),
        el(
          "p",
          { class: "notice notice--error" },
          `Diese Übersetzung fehlt. Wer ${language.name} wählt, sieht die Sicherheitsunterweisung auf Deutsch. Die Datei wird außerhalb des Editors angelegt (siehe docs/PFLEGE.md).`,
        ),
      );
    }
    const model = entry.model;
    const germanText = serializeChapter(german);
    const status = translationStatus(german, germanText, model);

    const statusBox = el(
      "div",
      {
        class: `notice${status.state === "aktuell" ? " notice--success" : " notice--error"}`,
        role: "status",
      },
      el("p", {}, STATE_TEXT[status.state] ?? status.state),
      status.problems.length > 0
        ? el(
            "ul",
            {},
            status.problems.map((problem) => el("li", {}, problem)),
          )
        : null,
      status.state === "pruefen"
        ? el(
            "p",
            {},
            el(
              "button",
              {
                type: "button",
                class: "button button--small",
                onclick: () => {
                  editor.commit((doc) => {
                    findTranslation(
                      { doc },
                      german.file,
                      language.code,
                    ).model.meta.quellstand = sourceStamp(germanText);
                  });
                  editor.setStatus(
                    `Übersetzung ${language.name} als auf dem neuen Stand markiert.`,
                  );
                },
              },
              "Übersetzung ist nachgezogen – als aktuell markieren",
            ),
          )
        : null,
    );

    const parts = [
      { value: "kopf", label: "Kopfbereich (Titel, Lernziele)" },
      ...german.pages.map((page, index) => ({
        value: String(index),
        label: `Seite ${index + 1}: ${page.title}`,
      })),
      ...(german.quiz ? [{ value: "quiz", label: "Quiz" }] : []),
    ];
    let part = state.ui.translationPart ?? "kopf";
    if (!parts.some((option) => option.value === String(part))) {
      part = "kopf";
    }
    const partSelect = el(
      "select",
      { id: "translation-part", class: "field__input" },
      parts.map((option) =>
        el(
          "option",
          { value: option.value, selected: option.value === String(part) },
          option.label,
        ),
      ),
    );
    partSelect.addEventListener("change", () => {
      const value = partSelect.value;
      state.ui.translationPart =
        value === "kopf" || value === "quiz" ? value : Number(value);
      editor.rerenderMiddle();
    });

    const original = el(
      "textarea",
      {
        id: "translation-original",
        class: "field__input field__textarea canvas__source-input",
        rows: SOURCE_ROWS,
        readonly: true,
        spellcheck: "false",
        lang: "de",
      },
      partSource(german, part),
    );
    const edited = el(
      "textarea",
      {
        id: "translation-text",
        class: "field__input field__textarea canvas__source-input",
        rows: SOURCE_ROWS,
        spellcheck: "true",
        lang: language.code,
      },
      partSource(model, part),
    );
    const problems = el("div", { role: "status" });
    const applyButton = el(
      "button",
      {
        type: "button",
        class: "button button--primary",
        onclick: () => {
          const result = parsePart(model, part, edited.value);
          if (!result.ok) {
            problems.replaceChildren(
              el("p", { class: "notice notice--error" }, result.message),
            );
            return;
          }
          editor.commit((doc) => {
            result.apply(
              findTranslation({ doc }, german.file, language.code).model,
            );
          });
          editor.setStatus(
            "Übersetzung übernommen. Speichern nicht vergessen.",
          );
        },
      },
      "Änderung übernehmen",
    );

    return el(
      "section",
      { class: "canvas stack" },
      heading,
      el("p", { class: "canvas__info" }, `Datei: ${path}`),
      statusBox,
      el(
        "p",
        { class: "field__hint" },
        "Sicherheitsregeln werden nicht maschinell übersetzt. Ändert sich das deutsche Original, muss jede Übersetzung nachgezogen werden – sonst sehen Teilnehmende das Kapitel auf Deutsch. Aufbau, Antworten (- [x]) und Steuerzeichen (=>, |, >, ~) müssen dem Original entsprechen.",
      ),
      el(
        "div",
        { class: "field" },
        el("label", { for: "translation-part" }, "Teil"),
        partSelect,
      ),
      el(
        "div",
        { class: "translation-columns" },
        el(
          "div",
          { class: "field" },
          el(
            "label",
            { for: "translation-original" },
            "Deutsches Original (nur lesen)",
          ),
          original,
        ),
        el(
          "div",
          { class: "field" },
          el(
            "label",
            { for: "translation-text" },
            `Übersetzung ${language.name}`,
          ),
          edited,
        ),
      ),
      problems,
      el("p", {}, applyButton),
    );
  }

  EM.define("js/editor/translation-editor.js", {
    renderTranslationEditor,
    findTranslation,
  });
})();
