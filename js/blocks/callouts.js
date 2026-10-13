/*
 * callouts.js – Hinweiskästen: info, tipp, achtung
 *
 * Kursdown:
 *   :::achtung Optionaler Titel
 *   Freier Markdown-Text, auch mit **fett**, Listen und [[Glossar]].
 *   :::
 *
 * Gestaltung (css/blocks/callouts.css): info und tipp sind bewusst leise. Nur „achtung" ist laut – mit
 * gelb-schwarzer Boxengassen-Schraffur – und ist für Sicherheit reserviert. Wird achtung für
 * Nebensächliches benutzt, stumpft die Warnung ab.
 *
 * Ein Modul, drei Bausteine: createCallout() erzeugt die Definition für jeden der drei Namen.
 * In registry.js stehen alle drei einzeln.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Hinweisart (z. B. „merke"): Eintrag in VARIANTS ergänzen, in registry.js eintragen,
 *     CSS-Klasse .callout--merke in css/blocks/callouts.css anlegen, docs/BAUSTEINE.md ergänzen.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { icon } = EM.require("js/ui/icons.js");
  const { formatBlock, formatHeader, joinLines } = EM.require(
    "js/blocks/block-utils.js",
  );

  const VARIANTS = {
    info: {
      label: "Info",
      paletteLabel: "Info-Kasten",
      description: "Ergänzende Information, die nicht übersehen werden soll.",
      icon: "info",
    },
    tipp: {
      label: "Tipp",
      paletteLabel: "Tipp-Kasten",
      description: "Praktischer Rat aus dem Teamalltag.",
      icon: "flag",
    },
    achtung: {
      label: "Achtung",
      paletteLabel: "Achtung-Kasten",
      description:
        "Sicherheitsrelevanter Hinweis. Nur für echte Gefahren verwenden.",
      icon: "warning",
    },
  };

  /**
   * @typedef {{title: string, markdown: string}} CalloutData
   */

  /**
   * Erzeugt die Baustein-Definition für eine Hinweisart.
   * @param {'info'|'tipp'|'achtung'} name
   * @returns {import("./registry.js").BlockDefinition}
   */
  function createCallout(name) {
    const variant = VARIANTS[name];
    return {
      name,
      interactive: false,

      /** @param {import('./block-utils.js').RawBlock} raw */
      parse(raw) {
        return {
          data: { title: raw.title, markdown: joinLines(raw.lines) },
          errors: [],
        };
      },

      /** @param {CalloutData} data */
      validate(data, raw) {
        if (data.markdown.trim() === "") {
          return [
            {
              file: raw.file,
              line: raw.line,
              severity: "warnung",
              message: `Baustein „${name}" ist leer.`,
              fix: "Schreibe den Hinweistext zwischen die Kopfzeile und die Zeile :::.",
            },
          ];
        }
        return [];
      },

      /**
       * @param {CalloutData} data
       * @param {import("./block-utils.js").BlockContext} context
       */
      render(data, context) {
        return el(
          "div",
          { class: `callout callout--${name}`, role: "note" },
          el(
            "p",
            { class: "callout__label" },
            icon(variant.icon, "callout__icon"),
            variant.label,
          ),
          data.title
            ? el(
                "p",
                { class: "callout__title" },
                context.renderInline(data.title),
              )
            : null,
          el(
            "div",
            { class: "callout__body prose" },
            context.renderMarkdown(data.markdown),
          ),
        );
      },

      /** @param {CalloutData} data */
      serialize(data) {
        return formatBlock(
          formatHeader(name, data.title),
          data.markdown.split("\n"),
        );
      },

      editor: {
        label: variant.paletteLabel,
        description: variant.description,
        icon: `assets/icons/${name}.svg`,
        createDefault: () => ({ title: "", markdown: "Text des Hinweises." }),
        fields: [
          { key: "title", type: "text", label: "Überschrift (optional)" },
          { key: "markdown", type: "markdown", label: "Text", required: true },
        ],
      },
    };
  }

  EM.define("js/blocks/callouts.js", { createCallout });
})();
