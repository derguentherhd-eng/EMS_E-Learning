/*
 * matching.js – Baustein „zuordnen": Begriffe Kategorien zuordnen
 *
 * Kursdown (eine Zeile pro Begriff; nach | optional die Erklärung, warum es so ist):
 *   :::zuordnen Statisch oder dynamisch?
 *   Skidpad => Dynamisch | Das Auto fährt eine liegende Acht – es wird gefahren.
 *   Cost and Manufacturing => Statisch | Hier wird der Kostenbericht bewertet, ohne zu fahren.
 *   :::
 *
 * Die Kategorien ergeben sich aus den Zeilen (Reihenfolge des ersten Auftretens).
 *
 * Bedienung: Zu jedem Begriff gibt es ein Auswahlfeld. „Antworten prüfen" zeigt pro Begriff
 * richtig/falsch (Symbol + Text, nie nur Farbe) und die Erklärung. Das ist mit Tastatur und
 * Screenreader voll bedienbar; Drag & Drop gibt es bewusst nicht (wäre nur zusätzlich).
 *
 * Wenn du hier etwas ändern willst …
 *   – Aussehen: css/blocks/matching.css.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { icon } = EM.require("js/ui/icons.js");
  const {
    blockError,
    blockSection,
    escapePipes,
    formatBlock,
    formatHeader,
    shuffle,
    splitPipes,
    trimLines,
    trackExercise,
  } = EM.require("js/blocks/block-utils.js");

  /**
   * @typedef {{term: string, category: string, explanation: string}} MatchingItem
   * @typedef {{title: string, items: MatchingItem[]}} MatchingData
   */

  /** @type {import('./registry.js').BlockDefinition} */
  const definition = {
    name: "zuordnen",
    interactive: true,

    parse(raw) {
      const errors = [];
      const items = [];
      for (const { text, line } of trimLines(raw.lines)) {
        if (text.trim() === "") {
          continue;
        }
        const arrow = text.indexOf("=>");
        if (arrow === -1) {
          errors.push(
            blockError(
              raw,
              line,
              `In dieser Zeile fehlt der Pfeil =>: „${text.trim()}"`,
              'Schreibe jede Zeile als „Begriff => Kategorie | Erklärung" (die Erklärung ist optional).',
            ),
          );
          continue;
        }
        const [category, ...rest] = splitPipes(text.slice(arrow + 2));
        items.push({
          term: text.slice(0, arrow).trim().replace(/\\\|/g, "|"),
          category,
          explanation: rest.join(" | "),
        });
      }
      return { data: { title: raw.title, items }, errors };
    },

    validate(data, raw) {
      const errors = [];
      const categories = new Set(data.items.map((item) => item.category));
      if (data.items.length < 2) {
        errors.push(
          blockError(
            raw,
            raw.line,
            "Es braucht mindestens zwei Begriffe.",
            'Ergänze Zeilen der Form „Begriff => Kategorie".',
          ),
        );
      }
      if (categories.size < 2) {
        errors.push(
          blockError(
            raw,
            raw.line,
            "Es gibt nur eine Kategorie – dann gibt es nichts zuzuordnen.",
            "Verwende mindestens zwei verschiedene Kategorien.",
          ),
        );
      }
      for (const item of data.items) {
        if (!item.term || !item.category) {
          errors.push(
            blockError(
              raw,
              raw.line,
              "Ein Begriff oder eine Kategorie ist leer.",
              "Links und rechts vom => muss Text stehen.",
            ),
          );
        }
      }
      if (data.items.some((item) => !item.explanation)) {
        errors.push(
          blockError(
            raw,
            raw.line,
            "Nicht jeder Begriff hat eine Erklärung.",
            'Ergänze nach der Kategorie „| Erklärung". Das Feedback soll sagen, warum etwas richtig ist.',
            "hinweis",
          ),
        );
      }
      return errors;
    },

    /**
     * @param {MatchingData} data
     * @param {import("./block-utils.js").BlockContext} context
     */
    render(data, context) {
      const { section } = blockSection(
        "matching",
        data.title,
        context,
        "Zuordnungsaufgabe",
      );
      const categories = [...new Set(data.items.map((item) => item.category))];
      const status = el("p", { class: "block__status", "aria-live": "polite" });
      const rows = shuffle(data.items, context.random).map((item) => {
        const id = context.uid("zuordnen");
        const feedback = el("div", {
          class: "matching__feedback",
          hidden: true,
        });
        const select = el(
          "select",
          { id, class: "matching__select" },
          el("option", { value: "" }, "Bitte wählen …"),
          categories.map((category) =>
            el("option", { value: category }, category),
          ),
        );
        const row = el(
          "li",
          { class: "matching__row" },
          el(
            "label",
            { class: "matching__term", for: id },
            context.renderInline(item.term, { plainGlossary: true }),
          ),
          select,
          feedback,
        );
        return { item, row, select, feedback };
      });

      const checkButton = el(
        "button",
        { type: "button", class: "button button--primary" },
        "Antworten prüfen",
      );
      const resetButton = el(
        "button",
        { type: "button", class: "button", hidden: true },
        "Nochmal versuchen",
      );

      const markSolved = trackExercise(
        section,
        context,
        `zuordnen:${JSON.stringify(data.items)}`,
      );
      checkButton.addEventListener("click", () => {
        let correct = 0;
        for (const { item, row, select, feedback } of rows) {
          const ok = select.value === item.category;
          if (ok) {
            correct += 1;
          }
          row.classList.toggle("is-correct", ok);
          row.classList.toggle("is-wrong", !ok);
          feedback.hidden = false;
          feedback.replaceChildren(
            el(
              "p",
              { class: `feedback feedback--${ok ? "correct" : "wrong"}` },
              icon(ok ? "check" : "cross", "feedback__icon"),
              el(
                "strong",
                {},
                ok
                  ? "Richtig. "
                  : select.value
                    ? `Nicht ganz – richtig ist „${item.category}". `
                    : `Noch offen – richtig ist „${item.category}". `,
              ),
              item.explanation ? context.renderInline(item.explanation) : null,
            ),
          );
        }
        status.textContent = `${correct} von ${rows.length} richtig zugeordnet.`;
        resetButton.hidden = correct === rows.length;
        if (correct === rows.length) {
          markSolved();
        }
      });

      resetButton.addEventListener("click", () => {
        for (const { row, select, feedback } of rows) {
          select.value = "";
          feedback.hidden = true;
          row.classList.remove("is-correct", "is-wrong");
        }
        status.textContent = "";
        resetButton.hidden = true;
        rows[0]?.select.focus();
      });

      section.append(
        el(
          "p",
          { class: "block__hint" },
          "Ordne jeden Begriff einer Kategorie zu und prüfe dann deine Antworten.",
        ),
        el(
          "ul",
          { class: "matching__list" },
          rows.map((entry) => entry.row),
        ),
        el("div", { class: "block__actions" }, checkButton, resetButton),
        status,
      );
      return section;
    },

    /** @param {MatchingData} data */
    serialize(data) {
      const lines = data.items.map(
        (item) =>
          `${escapePipes(item.term)} => ${escapePipes(item.category)}${item.explanation ? ` | ${escapePipes(item.explanation)}` : ""}`,
      );
      return formatBlock(formatHeader("zuordnen", data.title), lines);
    },

    editor: {
      label: "Zuordnen",
      description:
        "Begriffe den richtigen Kategorien zuordnen, mit Erklärung je Begriff.",
      icon: "assets/icons/zuordnen.svg",
      createDefault: () => ({
        title: "Ordne zu",
        items: [
          {
            term: "Begriff A",
            category: "Kategorie 1",
            explanation: "Warum A zu Kategorie 1 gehört.",
          },
          {
            term: "Begriff B",
            category: "Kategorie 2",
            explanation: "Warum B zu Kategorie 2 gehört.",
          },
        ],
      }),
      fields: [
        { key: "title", type: "text", label: "Aufgabe / Überschrift" },
        {
          key: "items",
          type: "list",
          label: "Begriffe",
          itemLabel: "Begriff",
          min: 2,
          itemFields: [
            { key: "term", type: "text", label: "Begriff", required: true },
            {
              key: "category",
              type: "text",
              label: "Richtige Kategorie",
              required: true,
              help: "Gleiche Schreibweise = gleiche Kategorie.",
            },
            { key: "explanation", type: "text", label: "Erklärung (warum?)" },
          ],
        },
      ],
    },
  };

  EM.define("js/blocks/matching.js", { default: definition });
})();
