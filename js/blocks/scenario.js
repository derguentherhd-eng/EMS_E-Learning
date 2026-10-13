/*
 * scenario.js – Baustein „szenario": Entscheidungssituation mit Feedback je Option
 *
 * Kursdown (Situation als freier Text, danach die Optionen; nach > das Feedback):
 *   :::szenario Öl auf dem Werkstattboden
 *   Du kommst in die Werkstatt und siehst eine Öllache neben der Hebebühne.
 *   - [ ] Drumherum gehen, ist ja nicht meins > Die nächste Person rutscht vielleicht aus.
 *   - [x] Absichern und mit Bindemittel aufnehmen > Genau: erst sichern, dann beseitigen.
 *   :::
 *
 * [x] markiert die gute Entscheidung (es dürfen auch mehrere sein).
 *
 * Bedienung: Optionen als Radiobuttons, „Entscheidung prüfen" zeigt das Feedback zur gewählten
 * Option. War sie nicht gut, erscheint zusätzlich die gute Option mit ihrem Feedback – damit
 * klar ist, WARUM.
 *
 * Wenn du hier etwas ändern willst …
 *   – Aussehen: css/blocks/scenario.css.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { icon } = EM.require("js/ui/icons.js");
  const {
    blockError,
    blockSection,
    formatBlock,
    formatHeader,
    joinLines,
    oneLine,
  } = EM.require("js/blocks/block-utils.js");

  /**
   * @typedef {{text: string, correct: boolean, feedback: string}} ScenarioOption
   * @typedef {{title: string, situation: string, options: ScenarioOption[]}} ScenarioData
   */

  const OPTION = /^-\s*\[([ xX])\]\s*(.*)$/;

  /** @type {import('./registry.js').BlockDefinition} */
  const definition = {
    name: "szenario",
    interactive: true,

    parse(raw) {
      const errors = [];
      const situation = [];
      const options = [];
      for (const entry of raw.lines) {
        const trimmed = entry.text.trim();
        const option = trimmed.match(OPTION);
        if (option) {
          const [text, ...feedback] = option[2].split(/\s+>\s+/);
          options.push({
            text: text.trim(),
            correct: option[1].toLowerCase() === "x",
            feedback: feedback.join(" > ").trim(),
          });
        } else if (options.length > 0 && trimmed !== "") {
          errors.push(
            blockError(
              raw,
              entry.line,
              `Nach den Optionen steht noch Text: „${trimmed}"`,
              'Die Situation steht vor den Optionen. Jede Option ist eine Zeile „- [ ] Text > Feedback".',
            ),
          );
        } else {
          situation.push(entry);
        }
      }
      return {
        data: { title: raw.title, situation: joinLines(situation), options },
        errors,
      };
    },

    validate(data, raw) {
      const errors = [];
      if (!data.situation) {
        errors.push(
          blockError(
            raw,
            raw.line,
            "Die Situation fehlt.",
            "Beschreibe vor den Optionen, was passiert.",
          ),
        );
      }
      if (data.options.length < 2) {
        errors.push(
          blockError(
            raw,
            raw.line,
            "Es braucht mindestens zwei Optionen.",
            'Jede Option ist eine Zeile „- [ ] Text > Feedback".',
          ),
        );
      }
      if (!data.options.some((option) => option.correct)) {
        errors.push(
          blockError(
            raw,
            raw.line,
            "Keine Option ist als gute Entscheidung markiert.",
            "Markiere die gute Entscheidung mit [x].",
          ),
        );
      }
      if (data.options.some((option) => !option.feedback)) {
        errors.push(
          blockError(
            raw,
            raw.line,
            "Nicht jede Option hat ein Feedback.",
            'Schreibe nach der Option „ > " und dann, was passiert bzw. warum.',
          ),
        );
      }
      return errors;
    },

    /**
     * @param {ScenarioData} data
     * @param {import("./block-utils.js").BlockContext} context
     */
    render(data, context) {
      const { section } = blockSection(
        "scenario",
        data.title,
        context,
        "Szenario",
      );
      const name = context.uid("szenario");
      const result = el("div", {
        class: "scenario__result",
        "aria-live": "polite",
      });
      const inputs = data.options.map((option) => {
        const id = context.uid("option");
        const input = el("input", {
          type: "radio",
          name,
          id,
          class: "scenario__input",
        });
        return {
          option,
          input,
          label: el(
            "label",
            { class: "scenario__option", for: id },
            input,
            el(
              "span",
              {},
              context.renderInline(option.text, { plainGlossary: true }),
            ),
          ),
        };
      });

      const checkButton = el(
        "button",
        { type: "button", class: "button button--primary" },
        "Entscheidung prüfen",
      );
      checkButton.addEventListener("click", () => {
        const chosen = inputs.find((entry) => entry.input.checked);
        if (!chosen) {
          result.replaceChildren(
            el(
              "p",
              { class: "feedback feedback--hint" },
              "Wähle zuerst eine Option.",
            ),
          );
          return;
        }
        const good = chosen.option.correct;
        const best = data.options.filter((option) => option.correct);
        result.replaceChildren(
          el(
            "div",
            { class: `feedback feedback--${good ? "correct" : "wrong"}` },
            el(
              "p",
              {},
              icon(good ? "check" : "cross", "feedback__icon"),
              el(
                "strong",
                {},
                good ? "Gute Entscheidung. " : "Keine gute Idee. ",
              ),
              context.renderInline(chosen.option.feedback),
            ),
            good
              ? null
              : best.map((option) =>
                  el(
                    "p",
                    {},
                    el("strong", {}, "Besser: "),
                    context.renderInline(option.text),
                    " – ",
                    context.renderInline(option.feedback),
                  ),
                ),
          ),
        );
      });

      section.append(
        el(
          "div",
          { class: "scenario__situation prose" },
          context.renderMarkdown(data.situation),
        ),
        el(
          "fieldset",
          { class: "scenario__options" },
          el("legend", {}, "Was tust du?"),
          inputs.map((entry) => entry.label),
        ),
        el("div", { class: "block__actions" }, checkButton),
        result,
      );
      return section;
    },

    /** @param {ScenarioData} data */
    serialize(data) {
      const lines = data.situation ? data.situation.split("\n") : [];
      for (const option of data.options) {
        lines.push(
          `- [${option.correct ? "x" : " "}] ${oneLine(option.text).replace(/\s+>\s+/g, " – ")}${option.feedback ? ` > ${oneLine(option.feedback)}` : ""}`,
        );
      }
      return formatBlock(formatHeader("szenario", data.title), lines);
    },

    editor: {
      label: "Szenario",
      description:
        "Entscheidungssituation: Was tust du? Mit Feedback zu jeder Option.",
      icon: "assets/icons/szenario.svg",
      createDefault: () => ({
        title: "Was tust du?",
        situation: "Beschreibe die Situation in ein, zwei Sätzen.",
        options: [
          {
            text: "Gute Entscheidung",
            correct: true,
            feedback: "Warum das gut ist.",
          },
          {
            text: "Weniger gute Entscheidung",
            correct: false,
            feedback: "Was dann passieren könnte.",
          },
        ],
      }),
      fields: [
        { key: "title", type: "text", label: "Überschrift" },
        {
          key: "situation",
          type: "markdown",
          label: "Situation",
          required: true,
        },
        {
          key: "options",
          type: "list",
          label: "Optionen",
          itemLabel: "Option",
          min: 2,
          itemFields: [
            { key: "text", type: "text", label: "Option", required: true },
            { key: "correct", type: "boolean", label: "Gute Entscheidung" },
            {
              key: "feedback",
              type: "text",
              label: "Feedback (was passiert / warum?)",
              required: true,
            },
          ],
        },
      ],
    },
  };

  EM.define("js/blocks/scenario.js", { default: definition });
})();
