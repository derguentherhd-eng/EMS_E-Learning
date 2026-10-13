/*
 * markdown.js – Markdown-Text in einen Syntaxbaum (AST) zerlegen
 *
 * Wichtig für die Sicherheit: Dieser Parser erzeugt KEIN HTML. Er liefert eine Baumstruktur
 * aus einfachen Objekten ({type: 'paragraph', children: […]}). Erst js/core/render.js baut daraus
 * DOM-Elemente – und setzt Text dabei ausschließlich als Text. Steht in einer Inhaltsdatei
 * also „<script>", erscheint genau das als Text auf der Seite. Rohes HTML wird nie ausgeführt.
 *
 * Unterstützter Umfang („Kursdown", siehe docs/BAUSTEINE.md):
 *   Absätze · ### Zwischenüberschrift · **fett** · *kursiv* · `code` · [Text](url)
 *   ![Alternativtext](pfad "Bildunterschrift") · Listen (- oder 1.) auch verschachtelt
 *   > Zitat · Tabellen mit | · [[Glossarbegriff]] / [[Begriff|Anzeigetext]]
 *   {{TODO: Beschreibung}} · \* (Backslash hebt Sonderzeichen auf)
 *
 * Seiten (## …) und Bausteine (:::name) werden NICHT hier, sondern in documents.js erkannt.
 *
 * Zusammenspiel: render.js (Darstellung), validate.js (findet Bilder, Links, Glossarbegriffe
 * und Platzhalter im Baum), documents.js (Textabschnitte, Bildelemente).
 *
 * Wenn du hier etwas ändern willst …
 *   – Neues Inline-Format: in parseInline() einen Fall ergänzen, in render.js darstellen,
 *     in tests.html testen, in docs/BAUSTEINE.md dokumentieren.
 */

(function () {
  "use strict";

  /**
   * @typedef {Object} InlineNode
   * @property {'text'|'strong'|'em'|'code'|'link'|'image'|'glossary'|'todo'} type
   * @property {string} [value]   text, code
   * @property {InlineNode[]} [children]  strong, em, link
   * @property {string} [href]    link
   * @property {string} [src] @property {string} [alt] @property {string} [title]  image
   * @property {string} [term] @property {string} [label]  glossary
   * @property {string} [text]    todo
   */

  /**
   * @typedef {Object} BlockNode
   * @property {'paragraph'|'heading'|'list'|'blockquote'|'table'|'figure'|'todo'} type
   * @property {number} line            Zeilennummer in der Datei
   * @property {InlineNode[]} [children]   paragraph, heading
   * @property {number} [level]            heading: Anzahl der # im Markdown (1–6)
   * @property {boolean} [ordered] @property {number} [start] @property {ListItem[]} [items]  list
   * @property {BlockNode[]} [blocks]      blockquote
   * @property {InlineNode[][]} [header] @property {InlineNode[][][]} [rows]  table
   * @property {string} [src] @property {string} [alt] @property {string} [caption]  figure
   * @property {string} [text]             todo
   */

  /** @typedef {{children: InlineNode[], sublist: BlockNode|null, line: number}} ListItem */

  const LIST_MARKER = /^(\s*)([-*+]|\d+\.)\s+(.*)$/;
  const IMAGE_ONLY = /^!\[([^\]]*)\]\(\s*([^)\s]*)(?:\s+"([^"]*)")?\s*\)$/;
  const TODO_ONLY = /^\{\{\s*TODO:?\s*(.*?)\s*\}\}$/i;

  /**
   * Zerlegt mehrzeiligen Markdown-Text in Blöcke.
   *
   * @param {string} text
   * @param {number} [startLine]  Zeilennummer der ersten Zeile in der Datei (für Meldungen)
   * @returns {BlockNode[]}
   * @example
   *   parseMarkdown('Hallo **Welt**')
   *   // → [{ type: 'paragraph', line: 1, children: [text 'Hallo ', strong […]] }]
   */
  function parseMarkdown(text, startLine = 1) {
    const lines = text.split("\n");
    const blocks = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      const lineNumber = startLine + index;
      const trimmed = line.trim();

      if (trimmed === "") {
        index += 1;
        continue;
      }

      // Überschrift: # bis ######
      const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        blocks.push({
          type: "heading",
          level: heading[1].length,
          children: parseInline(heading[2].trim()),
          line: lineNumber,
        });
        index += 1;
        continue;
      }

      // Zitat: alle direkt folgenden Zeilen mit > einsammeln und rekursiv zerlegen
      if (trimmed.startsWith(">")) {
        const quoteLines = [];
        while (index < lines.length && lines[index].trim().startsWith(">")) {
          quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
          index += 1;
        }
        blocks.push({
          type: "blockquote",
          blocks: parseMarkdown(quoteLines.join("\n"), lineNumber),
          line: lineNumber,
        });
        continue;
      }

      // Tabelle: Zeilen, die mit | beginnen
      if (trimmed.startsWith("|")) {
        const tableLines = [];
        while (index < lines.length && lines[index].trim().startsWith("|")) {
          tableLines.push(lines[index].trim());
          index += 1;
        }
        blocks.push(parseTable(tableLines, lineNumber));
        continue;
      }

      // Liste
      if (LIST_MARKER.test(line)) {
        const listLines = [];
        const [, baseIndent, baseMarker] = line.match(LIST_MARKER);
        // Gehört eine Zeile als neuer Eintrag zur selben Liste? (gleiche Ebene, gleiche Art)
        function sameList(candidate) {
          const match = candidate.match(LIST_MARKER);
          if (!match) {
            return false;
          }
          if (match[1].length > baseIndent.length) {
            return true;
          } // Unterliste
          return /\d/.test(match[2]) === /\d/.test(baseMarker);
        }
        while (index < lines.length) {
          const current = lines[index];
          if (current.trim() === "") {
            // Leerzeile beendet die Liste, außer es geht danach mit derselben Liste weiter.
            const next = lines[index + 1];
            if (
              next !== undefined &&
              (sameList(next) || /^\s{2,}\S/.test(next))
            ) {
              index += 1;
              continue;
            }
            break;
          }
          if (
            listLines.length > 0 &&
            LIST_MARKER.test(current) &&
            !sameList(current)
          ) {
            break;
          }
          if (
            listLines.length > 0 &&
            !LIST_MARKER.test(current) &&
            !/^\s/.test(current)
          ) {
            break;
          }
          listLines.push({ text: current, line: startLine + index });
          index += 1;
        }
        blocks.push(parseList(listLines));
        continue;
      }

      // Absatz: bis zur nächsten Leerzeile oder bis ein anderer Block beginnt
      const paragraphLines = [];
      while (index < lines.length) {
        const current = lines[index];
        const currentTrimmed = current.trim();
        if (currentTrimmed === "") {
          break;
        }
        if (paragraphLines.length > 0 && startsOtherBlock(current)) {
          break;
        }
        paragraphLines.push(currentTrimmed);
        index += 1;
      }
      const paragraph = paragraphLines.join("\n");
      const image = paragraph.match(IMAGE_ONLY);
      const todo = paragraph.match(TODO_ONLY);
      if (image) {
        blocks.push({
          type: "figure",
          alt: image[1],
          src: image[2],
          caption: image[3] ?? "",
          line: lineNumber,
        });
      } else if (todo) {
        blocks.push({ type: "todo", text: todo[1], line: lineNumber });
      } else {
        blocks.push({
          type: "paragraph",
          children: parseInline(paragraph),
          line: lineNumber,
        });
      }
    }
    return blocks;
  }

  /**
   * Beginnt mit dieser Zeile ein anderer Block (Überschrift, Zitat, Tabelle, Liste)?
   * Dann endet der laufende Absatz.
   * @param {string} line
   * @returns {boolean}
   */
  function startsOtherBlock(line) {
    const trimmed = line.trim();
    return (
      /^#{1,6}\s/.test(trimmed) ||
      trimmed.startsWith(">") ||
      trimmed.startsWith("|") ||
      LIST_MARKER.test(line)
    );
  }

  /**
   * Zerlegt eingesammelte Listenzeilen. Einträge mit tieferer Einrückung werden zur
   * Unterliste des vorherigen Eintrags.
   * @param {{text:string, line:number}[]} listLines
   * @returns {BlockNode}
   */
  function parseList(listLines) {
    const first = listLines[0].text.match(LIST_MARKER);
    const baseIndent = first[1].length;
    const ordered = /\d/.test(first[2]);
    const items = [];
    let current = null;
    let nested = [];

    function closeItem() {
      if (current) {
        current.sublist = nested.length > 0 ? parseList(nested) : null;
        items.push(current);
      }
      nested = [];
    }

    for (const entry of listLines) {
      const match = entry.text.match(LIST_MARKER);
      if (match && match[1].length <= baseIndent) {
        closeItem();
        current = {
          children: [],
          sublist: null,
          line: entry.line,
          rawText: match[3],
        };
      } else if (match) {
        nested.push(entry);
      } else if (current && nested.length === 0) {
        // Fortsetzungszeile eines Eintrags (eingerückt, ohne Aufzählungszeichen)
        current.rawText += `\n${entry.text.trim()}`;
      } else if (nested.length > 0) {
        nested.push(entry);
      }
    }
    closeItem();

    for (const item of items) {
      item.children = parseInline(item.rawText);
      delete item.rawText;
    }
    return {
      type: "list",
      ordered,
      start: ordered ? Number.parseInt(first[2], 10) : 1,
      items,
      line: listLines[0].line,
    };
  }

  /**
   * Zerlegt eine Tabelle. Die zweite Zeile darf eine Trennzeile sein (|---|---|); dann ist die
   * erste Zeile die Kopfzeile.
   * @param {string[]} tableLines
   * @param {number} line
   * @returns {BlockNode}
   */
  function parseTable(tableLines, line) {
    const rows = tableLines.map(splitTableRow);
    function isSeparator(cells) {
      return (
        cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell))
      );
    }
    let header = [];
    let body = rows;
    if (rows.length >= 2 && isSeparator(rows[1])) {
      header = rows[0];
      body = rows.slice(2);
    }
    return {
      type: "table",
      header: header.map(parseInline),
      rows: body.map((cells) => cells.map(parseInline)),
      line,
    };
  }

  /** Teilt eine Tabellenzeile an | (außer bei \|). */
  function splitTableRow(row) {
    const inner = row.replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
    return inner
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim().replace(/\\\|/g, "|"));
  }

  /**
   * Zerlegt eine Textzeile in Inline-Elemente (fett, kursiv, Links, Glossar …).
   *
   * @param {string} text
   * @returns {InlineNode[]}
   * @example
   *   parseInline('Das ist [[Scrutineering|die Abnahme]].')
   *   // → [text 'Das ist ', glossary {term: 'Scrutineering', label: 'die Abnahme'}, text '.']
   */
  function parseInline(text) {
    const nodes = [];
    let buffer = "";
    let index = 0;

    function flush() {
      if (buffer !== "") {
        nodes.push({ type: "text", value: buffer });
        buffer = "";
      }
    }

    while (index < text.length) {
      const rest = text.slice(index);
      const char = text[index];

      // \* \[ \` … → Zeichen wörtlich übernehmen
      if (char === "\\" && /^\\[\\`*_[\]{}()#|!>~-]/.test(rest)) {
        buffer += rest[1];
        index += 2;
        continue;
      }

      if (char === "`") {
        const end = text.indexOf("`", index + 1);
        if (end > index + 1) {
          flush();
          nodes.push({ type: "code", value: text.slice(index + 1, end) });
          index = end + 1;
          continue;
        }
      }

      if (rest.startsWith("{{")) {
        const end = text.indexOf("}}", index + 2);
        const inner = end === -1 ? null : text.slice(index + 2, end);
        const todo = inner?.match(/^\s*TODO:?\s*([\s\S]*?)\s*$/i);
        if (todo) {
          flush();
          nodes.push({ type: "todo", text: todo[1] });
          index = end + 2;
          continue;
        }
      }

      if (rest.startsWith("[[")) {
        const end = text.indexOf("]]", index + 2);
        if (end > index + 2) {
          const [term, label] = text
            .slice(index + 2, end)
            .split("|")
            .map((part) => part.trim());
          flush();
          nodes.push({ type: "glossary", term, label: label || term });
          index = end + 2;
          continue;
        }
      }

      if (rest.startsWith("![")) {
        const match = rest.match(
          /^!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*\)/,
        );
        if (match) {
          flush();
          nodes.push({
            type: "image",
            alt: match[1],
            src: match[2],
            title: match[3] ?? "",
          });
          index += match[0].length;
          continue;
        }
      }

      if (char === "[") {
        const match = rest.match(/^\[([^\]]+)\]\(\s*([^)\s]+)\s*\)/);
        if (match) {
          flush();
          nodes.push({
            type: "link",
            href: match[2],
            children: parseInline(match[1]),
          });
          index += match[0].length;
          continue;
        }
      }

      if (rest.startsWith("**")) {
        const end = text.indexOf("**", index + 2);
        if (end > index + 2) {
          flush();
          nodes.push({
            type: "strong",
            children: parseInline(text.slice(index + 2, end)),
          });
          index = end + 2;
          continue;
        }
      }

      // *kursiv*: Nach dem öffnenden * darf kein Leerzeichen stehen (sonst ist „5 * 3" kursiv).
      if (char === "*" && /^\*[^\s*]/.test(rest)) {
        const end = findClosingStar(text, index + 1);
        if (end !== -1) {
          flush();
          nodes.push({
            type: "em",
            children: parseInline(text.slice(index + 1, end)),
          });
          index = end + 1;
          continue;
        }
      }

      buffer += char;
      index += 1;
    }
    flush();
    return nodes;
  }

  /** Sucht das schließende einzelne * (kein **, kein Leerzeichen davor). */
  function findClosingStar(text, from) {
    for (let i = from; i < text.length; i += 1) {
      if (
        text[i] === "*" &&
        text[i + 1] !== "*" &&
        text[i - 1] !== "*" &&
        !/\s/.test(text[i - 1])
      ) {
        return i;
      }
      if (text[i] === "*" && text[i + 1] === "*") {
        i += 1;
      }
    }
    return -1;
  }

  /**
   * Liefert den reinen Text eines Inline-Baums (z. B. für Wortzählung oder Seitentitel).
   * @param {InlineNode[]} nodes
   * @returns {string}
   */
  function inlineToText(nodes) {
    return nodes
      .map((node) => {
        switch (node.type) {
          case "text":
          case "code":
            return node.value;
          case "glossary":
            return node.label;
          case "todo":
            return "";
          case "image":
            return node.alt;
          default:
            return inlineToText(node.children ?? []);
        }
      })
      .join("");
  }

  /**
   * Durchläuft alle Knoten eines Blockbaums (Blöcke und Inline-Elemente) und ruft für jeden
   * visit(node, line) auf. Praktisch für die Prüfung (Bilder, Links, Glossarbegriffe finden).
   * @param {BlockNode[]} blocks
   * @param {(node: BlockNode|InlineNode, line: number) => void} visit
   */
  function walkMarkdown(blocks, visit) {
    function walkInline(nodes, line) {
      for (const node of nodes) {
        visit(node, line);
        if (node.children) {
          walkInline(node.children, line);
        }
      }
    }
    function walkList(list) {
      for (const item of list.items) {
        walkInline(item.children, item.line);
        if (item.sublist) {
          visit(item.sublist, item.sublist.line);
          walkList(item.sublist);
        }
      }
    }
    for (const block of blocks) {
      visit(block, block.line);
      if (block.type === "paragraph" || block.type === "heading") {
        walkInline(block.children, block.line);
      }
      if (block.type === "list") {
        walkList(block);
      }
      if (block.type === "blockquote") {
        walkMarkdown(block.blocks, visit);
      }
      if (block.type === "table") {
        for (const cell of [...block.header, ...block.rows.flat()]) {
          walkInline(cell, block.line);
        }
      }
    }
  }

  /**
   * Zählt die Wörter eines Markdown-Textes (für die geschätzte Lesedauer im Editor).
   * @param {string} text
   * @returns {number}
   */
  function countWords(text) {
    const plain = text
      .replace(/\{\{[^}]*\}\}/g, " ")
      .replace(/[#>*`|[\]()!_~-]/g, " ")
      .trim();
    return plain === "" ? 0 : plain.split(/\s+/).length;
  }

  EM.define("js/content/markdown.js", {
    parseMarkdown,
    parseInline,
    inlineToText,
    walkMarkdown,
    countWords,
  });
})();
