/*
 * pictogram-block.js – Baustein „piktogramm“: animiertes Sicherheits-Piktogramm
 *
 * Kursdown:
 *   :::piktogramm Schutzbrille aufsetzen motiv=schutzbrille schleife=ja groesse=mittel farbe=akzent
 *   :::
 *   Titel (optional)  Bildunterschrift unter dem Piktogramm
 *   motiv             schutzbrille | stolpern | heben | fluchtweg (siehe js/ui/pictograms.js)
 *   schleife          ja = Endlosschleife, nein = einmal abspielen, sobald es sichtbar wird
 *                     (erneut bei Maus darüber oder Fokus). Standard: ja
 *   groesse           klein | mittel | gross | breit (ganze Spaltenbreite, für Querformate).
 *                     Standard: mittel
 *   farbe             text (Schriftfarbe) | akzent (Gelb). Standard: akzent
 *
 * Wer „Bewegung reduzieren“ eingestellt hat, sieht nur die stehende Pose (Phase 2).
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Motive: js/ui/pictograms.js (PICTOGRAMS) und css/components/pictogram.css.
 *   – Aussehen des Bausteins: css/blocks/pictogram.css.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { blockError, formatBlock, formatHeader } = EM.require(
    "js/blocks/block-utils.js",
  );
  const { PICTOGRAMS, createPictogram } = EM.require("js/ui/pictograms.js");

  /** Größen in der Kursdown-Schreibweise → CSS-Breite. */
  const SIZES = {
    klein: "8rem",
    mittel: "12rem",
    gross: "16rem",
    breit: "100%",
  };
  /** Farben → CSS-Wert (über currentColor). */
  const COLORS = { text: "", akzent: "var(--color-yellow)" };

  /** @typedef {{title: string, motif: string, loop: boolean, size: string, color: string}} PictogramData */

  /** @type {import('./registry.js').BlockDefinition} */
  const definition = {
    name: "piktogramm",
    interactive: false,

    parse(raw) {
      const attrs = raw.attrs ?? {};
      return {
        data: {
          title: raw.title,
          motif: String(attrs.motiv ?? "").trim(),
          loop:
            String(attrs.schleife ?? "ja")
              .trim()
              .toLowerCase() !== "nein",
          size: String(attrs.groesse ?? "mittel")
            .trim()
            .toLowerCase(),
          color: String(attrs.farbe ?? "akzent")
            .trim()
            .toLowerCase(),
        },
        errors: [],
      };
    },

    validate(data, raw) {
      const errors = [];
      if (!PICTOGRAMS[data.motif]) {
        errors.push(
          blockError(
            raw,
            raw.line,
            data.motif
              ? `Das Motiv „${data.motif}“ gibt es nicht.`
              : "Das Motiv fehlt.",
            `Schreibe z. B. „motiv=schutzbrille“. Möglich: ${Object.keys(PICTOGRAMS).join(", ")}.`,
          ),
        );
      }
      if (!(data.size in SIZES)) {
        errors.push(
          blockError(
            raw,
            raw.line,
            `Die Größe „${data.size}“ gibt es nicht.`,
            "Möglich: klein, mittel, gross, breit.",
            "warnung",
          ),
        );
      }
      if (!(data.color in COLORS)) {
        errors.push(
          blockError(
            raw,
            raw.line,
            `Die Farbe „${data.color}“ gibt es nicht.`,
            "Möglich: text, akzent.",
            "warnung",
          ),
        );
      }
      return errors;
    },

    render(data, context) {
      const pictogram = createPictogram(data.motif, {
        loop: data.loop,
        size: SIZES[data.size] ?? SIZES.mittel,
        color: COLORS[data.color] || undefined,
        label: data.title || undefined,
      });
      if (!pictogram) {
        return el("p", { class: "notice" }, "Piktogramm nicht gefunden.");
      }
      return el(
        "figure",
        {
          class: `pictogram-block${data.size === "breit" ? " pictogram-block--wide" : ""}`,
        },
        pictogram,
        data.title
          ? el(
              "figcaption",
              { class: "pictogram-block__caption" },
              context.renderInline(data.title),
            )
          : null,
      );
    },

    serialize(data) {
      return formatBlock(
        formatHeader("piktogramm", data.title, [
          ["motiv", data.motif],
          ["schleife", data.loop ? "ja" : "nein"],
          ["groesse", data.size],
          ["farbe", data.color],
        ]),
        [],
      );
    },

    editor: {
      label: "Piktogramm (animiert)",
      description:
        "Animiertes Sicherheits-Piktogramm: Auftritt, klare Pose, Abgang.",
      icon: "assets/icons/piktogramm.svg",
      createDefault: () => ({
        title: PICTOGRAMS.schutzbrille.label,
        motif: "schutzbrille",
        loop: true,
        size: "mittel",
        color: "akzent",
      }),
      fields: [
        {
          key: "motif",
          type: "select",
          label: "Motiv",
          options: Object.keys(PICTOGRAMS),
          required: true,
        },
        {
          key: "title",
          type: "text",
          label: "Bildunterschrift (wird auch vorgelesen)",
        },
        {
          key: "loop",
          type: "boolean",
          label: "Endlos wiederholen (sonst einmal, sobald sichtbar)",
        },
        {
          key: "size",
          type: "select",
          label: "Größe",
          options: Object.keys(SIZES),
        },
        {
          key: "color",
          type: "select",
          label: "Farbe",
          options: Object.keys(COLORS),
        },
      ],
    },
  };

  EM.define("js/blocks/pictogram-block.js", { default: definition });
})();
