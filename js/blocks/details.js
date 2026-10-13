/*
 * details.js – Baustein „aufklappen": Vertiefung für Neugierige
 *
 * Kursdown:
 *   :::aufklappen Wie viele Punkte gibt es insgesamt?
 *   Freier Markdown-Text, der erst nach dem Aufklappen sichtbar ist.
 *   :::
 *
 * Technik: natives <details>/<summary>. Das ist ohne JavaScript bedienbar, mit Tastatur
 * (Enter/Leertaste) und wird von Screenreadern als „ausgeklappt/eingeklappt" angesagt.
 *
 * Didaktik: Für Zusatzwissen, das nicht prüfungsrelevant ist. Was im Quiz gefragt wird,
 * gehört nicht in einen zugeklappten Bereich.
 *
 * Wenn du hier etwas ändern willst …
 *   – Aussehen: css/blocks/details.css.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { blockError, formatBlock, formatHeader, joinLines } = EM.require(
    "js/blocks/block-utils.js",
  );

  /** @typedef {{title: string, markdown: string}} DetailsData */

  /** @type {import('./registry.js').BlockDefinition} */
  const definition = {
    name: "aufklappen",
    interactive: false,

    parse(raw) {
      return {
        data: { title: raw.title, markdown: joinLines(raw.lines) },
        errors: [],
      };
    },

    validate(data, raw) {
      const errors = [];
      if (data.title.trim() === "") {
        errors.push(
          blockError(
            raw,
            raw.line,
            "Der Titel fehlt.",
            'Schreibe den Titel direkt hinter :::aufklappen, z. B. „:::aufklappen Mehr zur Geschichte".',
            "warnung",
          ),
        );
      }
      if (data.markdown.trim() === "") {
        errors.push(
          blockError(
            raw,
            raw.line,
            "Der Inhalt ist leer.",
            "Schreibe den Text zwischen Kopfzeile und :::.",
            "warnung",
          ),
        );
      }
      return errors;
    },

    render(data, context) {
      return el(
        "details",
        { class: "details" },
        el(
          "summary",
          { class: "details__summary" },
          context.renderInline(data.title || "Mehr erfahren"),
        ),
        el(
          "div",
          { class: "details__body prose" },
          context.renderMarkdown(data.markdown),
        ),
      );
    },

    serialize(data) {
      return formatBlock(
        formatHeader("aufklappen", data.title),
        data.markdown.split("\n"),
      );
    },

    editor: {
      label: "Aufklappbereich",
      description: "Vertiefung für Neugierige, die erst auf Klick erscheint.",
      icon: "assets/icons/aufklappen.svg",
      createDefault: () => ({
        title: "Mehr erfahren",
        markdown: "Zusatzwissen für Neugierige.",
      }),
      fields: [
        {
          key: "title",
          type: "text",
          label: "Titel (sichtbar, bevor man aufklappt)",
          required: true,
        },
        { key: "markdown", type: "markdown", label: "Inhalt", required: true },
      ],
    },
  };

  EM.define("js/blocks/details.js", { default: definition });
})();
