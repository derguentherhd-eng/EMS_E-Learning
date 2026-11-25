/*
 * tests-markdown.js – Selbsttests: Frontmatter, Markdown-Parser, Renderer und Router
 *
 * Zusammenspiel: registriert beim Laden Testfälle über js/tests/test-utils.js;
 * ausgeführt und angezeigt werden sie von js/pages/tests.js.
 * Geprüfter Code: js/content/frontmatter.js, markdown.js, core/render.js, core/router.js.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Logik: einen test(...)-Block in der passenden group(...) ergänzen.
 *   – Neuer Baustein: in tests-blocks.js (BLOCK_SAMPLES) ein gültiges und ein
 *     ungültiges Beispiel ergänzen; Parser- und Round-Trip-Tests entstehen daraus.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { parseFrontmatter, serializeFrontmatter } = EM.require(
    "js/content/frontmatter.js",
  );
  const { parseInline, parseMarkdown } = EM.require("js/content/markdown.js");
  const { renderInline, renderMarkdown } = EM.require("js/core/render.js");
  const { parseRoute } = EM.require("js/core/router.js");
  const { assert, assertEqual, group, test } = EM.require(
    "js/tests/test-utils.js",
  );

  // ───────────────────────────── Kopfbereich ─────────────────────────────

  group("Kopfbereich (Frontmatter)");

  test("liest Text, Zahlen und Listen", () => {
    const result = parseFrontmatter(
      "---\ntitel: Was ist: FS?\ndauer: 8\nkursversion: 1.0\nlernziele:\n  - Eins\n  - Zwei\n---\nText",
    );
    assertEqual(result.meta, {
      titel: "Was ist: FS?",
      dauer: 8,
      kursversion: "1.0",
      lernziele: ["Eins", "Zwei"],
    });
    assertEqual(result.body, "Text");
    assertEqual(result.bodyStartLine, 9);
    assertEqual(result.errors, []);
  });

  test("meldet nicht geschlossenen Kopfbereich mit Zeile 1", () => {
    const result = parseFrontmatter("---\ntitel: X\n", "a.md");
    assertEqual(result.errors.length, 1);
    assertEqual(result.errors[0].line, 1);
  });

  test("meldet ungültige Zeile mit richtiger Zeilennummer", () => {
    const result = parseFrontmatter(
      "---\ntitel: X\ndas ist falsch\n---\n",
      "a.md",
    );
    assertEqual(
      result.errors.map((error) => error.line),
      [3],
    );
  });

  test("meldet doppelten Schlüssel und Listeneintrag ohne Schlüssel", () => {
    const result = parseFrontmatter("---\n  - lose\ntitel: A\ntitel: B\n---\n");
    assertEqual(
      result.errors.map((error) => error.line),
      [2, 4],
    );
  });

  test("Serializer: bevorzugte Reihenfolge, unbekannte Schlüssel bleiben", () => {
    const text = serializeFrontmatter(
      { extra: "x", dauer: 8, titel: "T", liste: [] },
      ["titel", "dauer"],
    );
    assertEqual(text, "---\ntitel: T\ndauer: 8\nextra: x\nliste:\n---");
  });

  test("Round-Trip Kopfbereich", () => {
    const meta = {
      titel: "Ä Ö Ü ß",
      dauer: 12,
      version: 3,
      kursversion: "1.0",
      lernziele: ["a", "b: c"],
    };
    assertEqual(parseFrontmatter(`${serializeFrontmatter(meta)}\n`).meta, meta);
  });

  // ───────────────────────────── Markdown ─────────────────────────────

  group("Markdown-Parser");

  test("Inline: fett, kursiv, Code, Link, Glossar, Platzhalter", () => {
    const nodes = parseInline(
      "A **f** *k* `c` [L](https://x.de) [[Begriff|Text]] {{TODO: Foto}}",
    );
    assertEqual(
      nodes.map((node) => node.type),
      [
        "text",
        "strong",
        "text",
        "em",
        "text",
        "code",
        "text",
        "link",
        "text",
        "glossary",
        "text",
        "todo",
      ],
    );
    assertEqual(nodes[9], { type: "glossary", term: "Begriff", label: "Text" });
    assertEqual(nodes[11], { type: "todo", text: "Foto" });
  });

  test("HTML in Inhalten bleibt Text (wird nicht interpretiert)", () => {
    const nodes = parseInline("<script>alert(1)</script><b>fett</b>");
    assertEqual(nodes, [
      { type: "text", value: "<script>alert(1)</script><b>fett</b>" },
    ]);
    const blocks = parseMarkdown("<img src=x onerror=alert(1)>");
    assertEqual(blocks[0].children, [
      { type: "text", value: "<img src=x onerror=alert(1)>" },
    ]);
  });

  test('„5 * 3 * 2" wird nicht kursiv', () => {
    assertEqual(parseInline("5 * 3 * 2"), [
      { type: "text", value: "5 * 3 * 2" },
    ]);
  });

  test("Backslash hebt Sonderzeichen auf", () => {
    assertEqual(parseInline("\\*kein kursiv\\*"), [
      { type: "text", value: "*kein kursiv*" },
    ]);
  });

  test("Blöcke: Überschrift, Listen (verschachtelt), Zitat, Tabelle, Bild, Platzhalter", () => {
    const text = [
      "### Zwischen",
      "",
      "- eins",
      "  - eins-a",
      "- zwei",
      "",
      "1. erstens",
      "2. zweitens",
      "",
      "> Zitat",
      "",
      "| A | B |",
      "|---|---|",
      "| 1 | 2 \\| 3 |",
      "",
      '![Alt](assets/x.svg "Unterschrift")',
      "",
      "{{TODO: Text folgt}}",
    ].join("\n");
    const blocks = parseMarkdown(text, 10);
    assertEqual(
      blocks.map((block) => block.type),
      ["heading", "list", "list", "blockquote", "table", "figure", "todo"],
    );
    assertEqual(blocks[0].line, 10);
    assertEqual(blocks[1].items.length, 2);
    assert(blocks[1].items[0].sublist?.items.length === 1, "Unterliste fehlt");
    assertEqual(blocks[2].ordered, true);
    assertEqual(blocks[4].rows[0][1], [{ type: "text", value: "2 | 3" }]);
    assertEqual(blocks[5], {
      type: "figure",
      alt: "Alt",
      src: "assets/x.svg",
      caption: "Unterschrift",
      line: 25,
    });
  });

  // ───────────────────────────── Darstellung ─────────────────────────────

  group("Darstellung (Renderer) und Router");

  test("HTML aus Inhalten erscheint als Text, nie als Element", () => {
    const box = el(
      "div",
      {},
      renderMarkdown(
        "<b>fett</b> <img src=x onerror=alert(1)>\n\n<script>alert(1)</script>",
      ),
    );
    assertEqual(
      box.querySelectorAll("b, img, script").length,
      0,
      "eingeschleuste Elemente",
    );
    assert(box.textContent.includes("<script>alert(1)</script>"), "Text fehlt");
  });

  test("javascript:-Links werden nicht zu Links", () => {
    const box = el("div", {}, renderInline("[klick](javascript:alert%281%29)"));
    assertEqual(box.querySelectorAll("a").length, 0);
    assertEqual(box.textContent, "klick");
  });

  test("Externe Links öffnen im neuen Tab und sagen das", () => {
    const link = el(
      "div",
      {},
      renderInline("[FS](https://example.org)"),
    ).querySelector("a");
    assertEqual(link?.getAttribute("target"), "_blank");
    assert(link.getAttribute("rel").includes("noopener"), "rel=noopener fehlt");
    assert(link.textContent.includes("neuem Tab"), "Hinweis fehlt");
  });

  test("Überschriften: ### im Kapitel wird zu <h2>", () => {
    const box = el(
      "div",
      {},
      renderMarkdown("### Zwischen", { headingShift: -1 }),
    );
    assertEqual(box.firstElementChild.tagName, "H2");
  });

  test("Router: alle Routen", () => {
    assertEqual(parseRoute("").name, "start");
    assertEqual(parseRoute("#/kapitel/01-a/3").params, { id: "01-a", page: 3 });
    assertEqual(parseRoute("#/kapitel/01-a").params.page, 1);
    assertEqual(parseRoute("#/kapitel/01-a/quiz").name, "quiz");
    assertEqual(parseRoute("#/glossar/Endurance").params, {
      term: "Endurance",
    });
    assertEqual(parseRoute("#/zertifikat").name, "certificate");
    assertEqual(parseRoute("#/kapitel/01-a/0").name, "notfound");
    assertEqual(parseRoute("#main"), null);
  });

  EM.define("js/tests/tests-markdown.js", {});
})();
