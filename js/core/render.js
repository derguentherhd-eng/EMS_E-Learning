/*
 * render.js – Inhalte sicher darstellen (Markdown-Baum und Seitenelemente → DOM)
 *
 * Der einzige Weg, auf dem Inhalte aus content/ auf die Seite kommen. Alles wird mit
 * createElement gebaut, Text wird immer als Text eingefügt (nie als HTML). Dadurch kann keine
 * Inhaltsdatei Skripte oder fremdes HTML einschleusen.
 *
 * Benutzt von: Kursansichten (js/views/), Bausteinen (über den BlockContext) und der
 * Live-Vorschau im Editor. So sieht die Vorschau garantiert genauso aus wie der Kurs.
 *
 * Überschriften: In Kapiteln ist „## " die Seite (= <h1> der Ansicht), „### " wird deshalb
 * zu <h2>. Im Willkommenstext von kurs.md wird „## " zu <h2>. Das regelt headingShift.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neues Markdown-Element: erst in markdown.js erkennen, dann hier in renderBlockNode()
 *     bzw. renderInlineNodes() darstellen.
 */

(function () {
  "use strict";

  const { append, el, uniqueId } = EM.require("js/core/dom.js");
  const { icon } = EM.require("js/ui/icons.js");
  const { createGlossaryTerm } = EM.require("js/ui/glossary.js");
  const { parseInline, parseMarkdown } = EM.require("js/content/markdown.js");
  const { findGlossaryEntry } = EM.require("js/content/documents.js");
  const { getBlock } = EM.require("js/blocks/registry.js");

  /**
   * @typedef {Object} RenderOptions
   * @property {Object[]} [glossary]     Glossareinträge für [[Begriff]]
   * @property {number} [headingShift]   Wird zur Anzahl der # addiert (Kapitel: -1)
   * @property {boolean} [plainGlossary] Glossarbegriffe als einfachen Text darstellen (z. B. im Popover)
   */

  const EXTERNAL = /^https?:/i;
  const SAFE_HREF = /^(https?:|mailto:|#|\.{0,2}\/|[^:]*$)/i;

  /**
   * Stellt mehrzeiligen Markdown-Text dar.
   * @param {string} markdown
   * @param {RenderOptions} [options]
   * @returns {DocumentFragment}
   * @example container.append(renderMarkdown('Hallo **Welt**'));
   */
  function renderMarkdown(markdown, options = {}) {
    const fragment = document.createDocumentFragment();
    for (const block of parseMarkdown(markdown)) {
      fragment.append(renderBlockNode(block, options));
    }
    return fragment;
  }

  /**
   * Stellt eine einzelne Textzeile dar (fett, kursiv, Links, Glossar …), ohne <p> drumherum.
   * @param {string} text
   * @param {RenderOptions} [options]
   * @returns {DocumentFragment}
   */
  function renderInline(text, options = {}) {
    const fragment = document.createDocumentFragment();
    append(fragment, renderInlineNodes(parseInline(text), options));
    return fragment;
  }

  /**
   * @param {import('../content/markdown.js').BlockNode} block
   * @param {RenderOptions} options
   * @returns {Node}
   */
  function renderBlockNode(block, options) {
    switch (block.type) {
      case "paragraph":
        return el("p", {}, renderInlineNodes(block.children, options));
      case "heading": {
        const level = Math.min(
          6,
          Math.max(2, block.level + (options.headingShift ?? 0)),
        );
        return el(`h${level}`, {}, renderInlineNodes(block.children, options));
      }
      case "list":
        return renderList(block, options);
      case "blockquote":
        return el(
          "blockquote",
          {},
          block.blocks.map((inner) => renderBlockNode(inner, options)),
        );
      case "table":
        return renderTable(block, options);
      case "figure":
        return renderFigure(block.src, block.alt, block.caption);
      case "todo":
        return renderTodo(block.text);
      default:
        return document.createTextNode("");
    }
  }

  /**
   * Baut eine Aufzählung (ul) oder nummerierte Liste (ol) inklusive Unterlisten.
   * @param {Object} list  Listen-Knoten aus markdown.js
   * @param {Object} options  Darstellungsoptionen (Glossar usw.)
   * @returns {HTMLElement}
   */
  function renderList(list, options) {
    return el(
      list.ordered ? "ol" : "ul",
      { start: list.ordered && list.start !== 1 ? list.start : null },
      list.items.map((item) =>
        el(
          "li",
          {},
          renderInlineNodes(item.children, options),
          item.sublist ? renderList(item.sublist, options) : null,
        ),
      ),
    );
  }

  /**
   * Tabellen stehen in einem scrollbaren Bereich, damit breite Tabellen auf dem Handy nicht die
   * ganze Seite verbreitern. Der Bereich ist per Tastatur erreichbar (tabindex=0), damit man
   * auch ohne Maus seitlich scrollen kann.
   */
  function renderTable(table, options) {
    const head =
      table.header.length > 0
        ? el(
            "thead",
            {},
            el(
              "tr",
              {},
              table.header.map((cell) =>
                el("th", { scope: "col" }, renderInlineNodes(cell, options)),
              ),
            ),
          )
        : null;
    const body = el(
      "tbody",
      {},
      table.rows.map((row) =>
        el(
          "tr",
          {},
          row.map((cell) => el("td", {}, renderInlineNodes(cell, options))),
        ),
      ),
    );
    return el(
      "div",
      {
        class: "table-wrap",
        role: "region",
        tabindex: 0,
        "aria-label": "Tabelle, seitlich scrollbar",
      },
      el("table", {}, head, body),
    );
  }

  /**
   * Bild mit optionaler Bildunterschrift.
   * @param {string} src
   * @param {string} alt
   * @param {string} [caption]
   * @returns {HTMLElement}
   */
  function renderFigure(src, alt, caption = "") {
    if (!src) {
      return el(
        "p",
        { class: "notice", role: "note" },
        "Hier fehlt noch ein Bild.",
      );
    }
    return el(
      "figure",
      { class: "figure" },
      el("img", { src: safeSrc(src), alt, loading: "lazy", decoding: "async" }),
      caption ? el("figcaption", {}, renderInline(caption)) : null,
    );
  }

  /**
   * Deutlich markierter Kasten für einen Platzhalter {{TODO: …}}.
   * @param {string} text
   * @returns {HTMLElement}
   */
  function renderTodo(text) {
    return el(
      "div",
      { class: "todo", role: "note" },
      el(
        "p",
        { class: "todo__label" },
        icon("flag", "todo__icon"),
        "Inhalt folgt",
      ),
      text ? el("p", { class: "todo__text" }, text) : null,
    );
  }

  /**
   * @param {import('../content/markdown.js').InlineNode[]} nodes
   * @param {RenderOptions} options
   * @returns {Node[]}
   */
  function renderInlineNodes(nodes, options) {
    return nodes.map((node) => {
      switch (node.type) {
        case "text":
          return document.createTextNode(node.value);
        case "strong":
          return el("strong", {}, renderInlineNodes(node.children, options));
        case "em":
          return el("em", {}, renderInlineNodes(node.children, options));
        case "code":
          return el("code", {}, node.value);
        case "link":
          return renderLink(node, options);
        case "image":
          return el("img", {
            class: "inline-image",
            src: safeSrc(node.src),
            alt: node.alt,
            title: node.title || null,
            loading: "lazy",
          });
        case "glossary": {
          const entry = options.plainGlossary
            ? null
            : findGlossaryEntry(options.glossary ?? [], node.term);
          return entry
            ? createGlossaryTerm(entry, node.label)
            : document.createTextNode(node.label);
        }
        case "todo":
          return el(
            "span",
            { class: "todo todo--inline" },
            el("span", { class: "todo__label" }, "Inhalt folgt:"),
            " ",
            node.text,
          );
        default:
          return document.createTextNode("");
      }
    });
  }

  /**
   * Links: Nur sichere Ziele werden zu Links. Externe Links öffnen in einem neuen Tab und sagen
   * das auch (Symbol + versteckter Text), damit niemand überrascht wird.
   */
  function renderLink(node, options) {
    const children = renderInlineNodes(node.children, options);
    if (!SAFE_HREF.test(node.href)) {
      return el("span", {}, children);
    }
    if (EXTERNAL.test(node.href)) {
      return el(
        "a",
        {
          href: node.href,
          target: "_blank",
          rel: "noopener noreferrer",
          class: "link--external",
        },
        children,
        icon("external", "link__icon"),
        el("span", { class: "visually-hidden" }, " (öffnet in neuem Tab)"),
      );
    }
    return el("a", { href: node.href }, children);
  }

  /** Bildpfade dürfen nur auf Dateien des Kurses oder auf http(s) zeigen. */
  function safeSrc(src) {
    return /^(https?:|[^:]*$)/i.test(src) ? src : "";
  }

  /**
   * Baut den Kontext, den Bausteine zum Darstellen bekommen.
   * @param {Object} params
   * @param {string} params.chapterId
   * @param {import("./store.js").Store} params.store
   * @param {Object[]} params.glossary
   * @param {() => number} [params.random]
   * @returns {import('../blocks/block-utils.js').BlockContext}
   */
  function createBlockContext({
    chapterId,
    store,
    glossary,
    random = Math.random,
  }) {
    return {
      chapterId,
      store,
      glossary,
      random,
      uid: (prefix) => uniqueId(prefix),
      renderMarkdown: (markdown) =>
        renderMarkdown(markdown, { glossary, headingShift: -1 }),
      renderInline: (text, extra = {}) =>
        renderInline(text, { glossary, ...extra }),
    };
  }

  /**
   * Stellt ein Seitenelement dar (Text, Bild, Baustein oder nicht lesbarer Abschnitt).
   * Geht beim Darstellen eines Bausteins etwas schief, erscheint ein neutraler Hinweis statt
   * einer kaputten Seite.
   *
   * @param {import('../content/documents.js').Element} element
   * @param {import('../blocks/block-utils.js').BlockContext} context
   * @returns {Node}
   */
  function renderElement(element, context) {
    switch (element.type) {
      case "text":
        return el(
          "div",
          { class: "prose" },
          renderMarkdown(element.markdown, {
            glossary: context.glossary,
            headingShift: -1,
          }),
        );
      case "image":
        return renderFigure(element.src, element.alt, element.caption);
      case "block": {
        const definition = getBlock(element.name);
        try {
          return definition.render(element.data, context);
        } catch (error) {
          console.error(
            `Baustein „${element.name}" konnte nicht dargestellt werden:`,
            error,
          );
          return renderUnreadable();
        }
      }
      default:
        return renderUnreadable();
    }
  }

  /**
   * Stellt alle Elemente einer Seite dar. Mehrere Bilder direkt hintereinander kommen in eine
   * Bildreihe (nebeneinander, auf schmalen Bildschirmen untereinander – css/components/prose.css).
   *
   * @param {import('../content/documents.js').Element[]} elements
   * @param {import('../blocks/block-utils.js').BlockContext} context
   * @returns {Node[]}
   */
  function renderElements(elements, context) {
    const nodes = [];
    let row = null;
    elements.forEach((element, index) => {
      const isImage = element.type === "image" && Boolean(element.src);
      const previous = elements[index - 1];
      const next = elements[index + 1];
      const nextIsImage = next?.type === "image" && Boolean(next.src);
      const node = renderElement(element, context);
      if (isImage && (row || nextIsImage)) {
        if (!row) {
          row = el("div", { class: "figure-row" });
          nodes.push(row);
        }
        row.append(node);
        if (!nextIsImage) {
          row = null;
        }
        return;
      }
      // Einzelnes Bild direkt nach Text: letzter Abschnitt des Textes links, Bild rechts.
      const prose = nodes[nodes.length - 1];
      if (
        isImage &&
        previous?.type === "text" &&
        prose?.classList?.contains("prose")
      ) {
        const split = renderMediaSplit(prose, node);
        if (split) {
          if (!prose.hasChildNodes()) {
            nodes.pop();
          }
          nodes.push(split);
          return;
        }
      }
      nodes.push(node);
    });
    return nodes;
  }

  /** Elemente, die in der Textspalte neben einem Bild stehen dürfen. */
  const SPLIT_TEXT_TAGS = new Set(["P", "UL", "OL"]);
  const SPLIT_HEADING_TAGS = new Set(["H2", "H3", "H4"]);

  /**
   * Nimmt den letzten Abschnitt eines Textes (Überschrift + Absätze/Listen am Ende) heraus und
   * stellt ihn neben das Bild: Text links, Bild rechts. Auf schmalen Bildschirmen untereinander
   * (.media-split in css/components/prose.css).
   * @param {HTMLElement} prose   gerenderter Text (div.prose); wird verändert
   * @param {HTMLElement} figure  gerendertes Bild
   * @returns {HTMLElement|null}  null, wenn der Text nicht mit Absätzen endet (z. B. Tabelle)
   */
  function renderMediaSplit(prose, figure) {
    const moved = [];
    let node = prose.lastElementChild;
    while (node && SPLIT_TEXT_TAGS.has(node.tagName)) {
      moved.unshift(node);
      node = node.previousElementSibling;
    }
    if (moved.length === 0) {
      return null;
    }
    if (node && SPLIT_HEADING_TAGS.has(node.tagName)) {
      moved.unshift(node);
    }
    return el(
      "div",
      { class: "media-split" },
      el("div", { class: "prose media-split__text" }, moved),
      figure,
    );
  }

  /** Neutraler Kasten für Abschnitte, die nicht angezeigt werden können. */
  function renderUnreadable() {
    return el(
      "div",
      { class: "notice", role: "note" },
      el(
        "p",
        {},
        "Dieser Abschnitt kann gerade nicht angezeigt werden. Wenn das so bleibt, gib bitte dem Media-Team Bescheid.",
      ),
    );
  }

  EM.define("js/core/render.js", {
    renderMarkdown,
    renderInline,
    renderFigure,
    renderTodo,
    createBlockContext,
    renderElement,
    renderElements,
  });
})();
