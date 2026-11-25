/*
 * canvas-elements.js – Elementkarten und Palette im Baukasten einer Seite
 *
 * Jedes Element einer Seite ist eine Karte (renderCard) mit ↑ ↓, Duplizieren,
 * Entfernen und Auf-/Zuklappen. Zwischen den Karten steht „+ Element
 * einfügen" (insertButton), das die Palette (openPalette) öffnet. Die
 * Palette enthält Textabschnitt, Bild und ALLE Bausteine aus registry.js.
 *
 * Zusammenspiel: canvas-dnd.js (Ziehen), page-canvas.js (Seitenansicht
 * baut die Kartenliste), canvas-fields.js (elementLabel für die Überschrift).
 *
 * Wenn du hier etwas ändern willst …
 *   – Aussehen/Werkzeuge einer Karte: renderCard.
 *   – Vorschautext der Karte: summary (Länge: SUMMARY_MAX_CHARS).
 *   – Einträge der Palette: openPalette (Bausteine kommen aus der Registry).
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { getBlock, listBlocks } = EM.require("js/blocks/registry.js");
  const { serializeElement } = EM.require("js/content/serialize.js");
  const { openDialog } = EM.require("js/editor/dialogs.js");
  const { addDrag } = EM.require("js/editor/canvas-dnd.js");

  /** Zugeklappte Kartenvorschau: maximale Zeichenzahl. */
  const SUMMARY_MAX_CHARS = 140;
  /** Kantenlänge der Symbole in der Palette (Pixel). */
  const PALETTE_ICON_SIZE = 32;

  /**
   * Knopf „+ Element einfügen" an einer Position.
   * @param {Object} editor Editor-Objekt.
   * @param {Object} entry Kapiteleintrag.
   * @param {number} pageIndex Index der Seite.
   * @param {number} index Einfügeposition in der Seite.
   * @returns {HTMLElement} Listeneintrag mit dem Knopf.
   */
  function insertButton(editor, entry, pageIndex, index) {
    return el(
      "li",
      { class: "cards__insert" },
      el(
        "button",
        {
          type: "button",
          class: "cards__insert-button",
          onclick: () => openPalette(editor, entry, pageIndex, index),
        },
        "+ Element einfügen",
        el("span", { class: "visually-hidden" }, ` an Position ${index + 1}`),
      ),
    );
  }

  /**
   * Eine Karte im Baukasten: Kopf mit Auswahl, Werkzeugen (↑ ↓ ⧉ ✕ ▾),
   * optional aufgeklapptem Inhalt und Ziehen zum Umsortieren.
   * @param {Object} editor Editor-Objekt.
   * @param {Object} entry Kapiteleintrag.
   * @param {number} pageIndex Index der Seite.
   * @param {number} index Index des Elements in der Seite.
   * @returns {HTMLElement} Listeneintrag der Karte.
   */
  function renderCard(editor, entry, pageIndex, index) {
    const { state } = editor;
    const page = entry.model.pages[pageIndex];
    const element = page.elements[index];
    const file = entry.file;
    const selected =
      state.selection.kind === "page" &&
      state.selection.page === pageIndex &&
      state.selection.element === index;
    const key = `${file}:${pageIndex}:${index}`;
    const expanded = state.ui.expanded.has(key);
    const label = elementLabel(element);

    /**
     * Tauscht die Karte mit ihrem Nachbarn und wählt sie neu aus.
     * @param {number} delta −1 (nach oben) oder 1 (nach unten).
     * @returns {void}
     */
    function move(delta) {
      editor.commit(
        () => {
          [page.elements[index], page.elements[index + delta]] = [
            page.elements[index + delta],
            page.elements[index],
          ];
        },
        { chapter: file },
      );
      editor.select({
        kind: "page",
        file,
        page: pageIndex,
        element: index + delta,
      });
      editor.setStatus(
        `„${label}" ist jetzt an Position ${index + delta + 1}.`,
      );
    }
    /**
     * Klappt die Karte auf oder zu.
     * @returns {void}
     */
    function toggle() {
      if (expanded) {
        state.ui.expanded.delete(key);
      } else {
        state.ui.expanded.add(key);
      }
      editor.rerenderMiddle();
    }

    const card = el(
      "li",
      {
        class: `card${selected ? " card--selected" : ""}${element.type === "raw" ? " card--raw" : ""}`,
        draggable: "true",
      },
      el(
        "div",
        { class: "card__head" },
        el(
          "button",
          {
            type: "button",
            class: "card__select",
            "aria-pressed": String(selected),
            onclick: () =>
              editor.select({
                kind: "page",
                file,
                page: pageIndex,
                element: index,
              }),
          },
          el("span", { class: "card__type" }, label),
          el("span", { class: "card__summary" }, summary(element, false)),
        ),
        el(
          "span",
          { class: "card__tools" },
          el(
            "button",
            {
              type: "button",
              class: "card__tool",
              disabled: index === 0,
              "aria-label": `„${label}" nach oben`,
              onclick: () => move(-1),
            },
            "↑",
          ),
          el(
            "button",
            {
              type: "button",
              class: "card__tool",
              disabled: index === page.elements.length - 1,
              "aria-label": `„${label}" nach unten`,
              onclick: () => move(1),
            },
            "↓",
          ),
          el(
            "button",
            {
              type: "button",
              class: "card__tool",
              "aria-label": `„${label}" duplizieren`,
              onclick: () => {
                editor.commit(
                  () =>
                    page.elements.splice(
                      index + 1,
                      0,
                      structuredClone(element),
                    ),
                  { chapter: file },
                );
                editor.select({
                  kind: "page",
                  file,
                  page: pageIndex,
                  element: index + 1,
                });
              },
            },
            "⧉",
          ),
          el(
            "button",
            {
              type: "button",
              class: "card__tool",
              "aria-label": `„${label}" entfernen`,
              onclick: () => {
                editor.commit(() => page.elements.splice(index, 1), {
                  chapter: file,
                });
                editor.select({ kind: "page", file, page: pageIndex });
                editor.setStatus(
                  `„${label}" entfernt. Rückgängig mit Strg/Cmd+Z.`,
                );
              },
            },
            "✕",
          ),
          el(
            "button",
            {
              type: "button",
              class: "card__tool",
              "aria-expanded": String(expanded),
              "aria-label": `„${label}" ${expanded ? "zuklappen" : "aufklappen"}`,
              onclick: toggle,
            },
            expanded ? "▴" : "▾",
          ),
        ),
      ),
      expanded
        ? el("div", { class: "card__body" }, summary(element, true))
        : null,
      element.type === "raw"
        ? el(
            "p",
            { class: "card__problem" },
            `Nicht lesbarer Abschnitt – im Quelltext bearbeiten. ${element.errors[0]?.message ?? ""}`,
          )
        : null,
    );
    addDrag(card, "text/x-element", index, (from) => {
      if (from === index) {
        return;
      }
      editor.commit(
        () => {
          const [moved] = page.elements.splice(from, 1);
          page.elements.splice(index, 0, moved);
        },
        { chapter: file },
      );
    });
    return card;
  }

  /**
   * Name eines Elements (für Karte und Ansagen).
   * @param {Object} element Element der Seite (Text, Bild, Baustein, Roh).
   * @returns {string} Anzeigename.
   */
  function elementLabel(element) {
    if (element.type === "text") {
      return "Textabschnitt";
    }
    if (element.type === "image") {
      return "Bild";
    }
    if (element.type === "raw") {
      return "Nicht lesbarer Abschnitt";
    }
    return getBlock(element.name)?.editor.label ?? element.name;
  }

  /**
   * Kurzbeschreibung (zugeklappt) bzw. vollständiger Inhalt (aufgeklappt).
   * @param {Object} element Element der Seite.
   * @param {boolean} full true für den vollständigen Inhalt.
   * @returns {string|HTMLElement} Text bzw. <pre>-Element.
   */
  function summary(element, full) {
    /**
     * Kürzt zugeklappte Texte auf SUMMARY_MAX_CHARS.
     * @param {string} text Ungekürzter Text.
     * @returns {string}
     */
    function cut(text) {
      return full || text.length <= SUMMARY_MAX_CHARS
        ? text
        : `${text.slice(0, SUMMARY_MAX_CHARS)} …`;
    }
    if (element.type === "text") {
      return full
        ? el("pre", { class: "card__text" }, element.markdown)
        : cut(element.markdown.replace(/\s+/g, " "));
    }
    if (element.type === "image") {
      return `${element.src}${element.alt ? ` – ${element.alt}` : " – Alternativtext fehlt!"}`;
    }
    if (element.type === "raw") {
      return full
        ? el("pre", { class: "card__text" }, element.text)
        : cut(element.text.split("\n")[0]);
    }
    const data = element.data ?? {};
    const counts = Object.entries(data)
      .filter(([, value]) => Array.isArray(value))
      .map(([, value]) => value.length);
    const title = data.title ? `„${data.title}"` : "";
    if (full) {
      return el("pre", { class: "card__text" }, serializeElement(element));
    }
    return [
      title,
      counts.length ? `${counts.join(" / ")} Einträge` : "",
      !data.title && data.markdown
        ? cut(data.markdown.replace(/\s+/g, " "))
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  /**
   * Palette „Element einfügen" mit Suchfeld; fügt die Wahl an der Position
   * ein, wählt sie aus und meldet das im Status.
   * @param {Object} editor Editor-Objekt.
   * @param {Object} entry Kapiteleintrag.
   * @param {number} pageIndex Index der Seite.
   * @param {number} index Einfügeposition.
   * @returns {Promise<void>}
   */
  async function openPalette(editor, entry, pageIndex, index) {
    const id = "palette-title";
    const options = [
      {
        name: "text",
        label: "Textabschnitt",
        description: "Absätze, Listen, Zwischenüberschriften, Tabellen.",
        icon: "assets/icons/text.svg",
        create: () => ({ type: "text", markdown: "Neuer Text.", line: 0 }),
      },
      {
        name: "image",
        label: "Bild",
        description:
          "Ein Bild mit Alternativtext und optionaler Bildunterschrift.",
        icon: "assets/icons/bild.svg",
        create: () => ({
          type: "image",
          src: "",
          alt: "",
          caption: "",
          line: 0,
        }),
      },
      ...listBlocks()
        .filter((block) => block.name !== "quiz")
        .map((block) => ({
          name: block.name,
          label: block.editor.label,
          description: block.editor.description,
          icon: block.editor.icon,
          create: () => ({
            type: "block",
            name: block.name,
            data: block.editor.createDefault(),
            line: 0,
          }),
        })),
    ];
    const choice = await openDialog((close) => {
      const search = el("input", {
        type: "search",
        id: "palette-search",
        class: "field__input",
        autocomplete: "off",
        autofocus: true,
        "aria-controls": "palette-list",
      });
      const list = el(
        "ul",
        { class: "palette", id: "palette-list" },
        options.map((option) =>
          el(
            "li",
            {
              "data-search":
                `${option.label} ${option.description} ${option.name}`.toLowerCase(),
            },
            el(
              "button",
              {
                type: "button",
                class: "palette__option",
                onclick: () => close(option),
              },
              el("img", {
                src: option.icon,
                alt: "",
                class: "palette__icon",
                width: PALETTE_ICON_SIZE,
                height: PALETTE_ICON_SIZE,
              }),
              el(
                "span",
                {},
                el("strong", {}, option.label),
                el(
                  "span",
                  { class: "palette__description" },
                  option.description,
                ),
              ),
            ),
          ),
        ),
      );
      const count = el(
        "p",
        { class: "field__hint", role: "status" },
        `${options.length} Elemente`,
      );
      search.addEventListener("input", () => {
        const query = search.value.trim().toLowerCase();
        let visible = 0;
        for (const item of list.children) {
          item.hidden = query !== "" && !item.dataset.search.includes(query);
          if (!item.hidden) {
            visible += 1;
          }
        }
        count.textContent = `${visible} Elemente`;
      });
      return [
        el("h2", { id }, "Element einfügen"),
        el(
          "div",
          { class: "field" },
          el("label", { for: "palette-search" }, "Suchen"),
          search,
          count,
        ),
        list,
        el(
          "div",
          { class: "dialog__actions" },
          el(
            "button",
            { type: "button", class: "button", onclick: () => close(null) },
            "Abbrechen",
          ),
        ),
      ];
    }, id);
    if (!choice) {
      return;
    }
    editor.commit(
      (doc) => {
        doc.chapters
          .find((candidate) => candidate.file === entry.file)
          .model.pages[pageIndex].elements.splice(index, 0, choice.create());
      },
      { chapter: entry.file },
    );
    editor.select({
      kind: "page",
      file: entry.file,
      page: pageIndex,
      element: index,
    });
    editor.setStatus(
      `„${choice.label}" eingefügt. Bearbeite es rechts unter „Eigenschaften".`,
    );
  }

  EM.define("js/editor/canvas-elements.js", {
    insertButton,
    renderCard,
    elementLabel,
    summary,
    openPalette,
  });
})();
