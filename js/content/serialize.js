/*
 * serialize.js – Datenmodell zurück in Kursdown-Text schreiben (für den Editor)
 *
 * Gegenstück zu documents.js. Der Editor ändert nur das Datenmodell; beim Speichern macht
 * diese Datei daraus wieder gut lesbaren Markdown-Text.
 *
 * Kanonische Form (der Editor vereinheitlicht die Formatierung):
 *   – Kopfbereich: bekannte Felder in fester Reihenfolge, unbekannte danach unverändert.
 *   – Genau eine Leerzeile zwischen allen Elementen und vor jeder „## "-Seite.
 *   – Bausteine schreiben sich selbst (serialize() im jeweiligen Modul).
 *   – Das Quiz steht immer am Ende des Kapitels.
 *   – Die Datei endet mit genau einem Zeilenumbruch.
 *   – Nicht lesbare Abschnitte (raw) werden Zeichen für Zeichen wie gelesen zurückgeschrieben.
 *
 * Garantie (geprüft in tests.html): parse(serialize(parse(text))) ist inhaltsgleich zu
 * parse(text). Leerzeilen und Einrückungen können sich ändern, Inhalte nie.
 *
 * Wenn du hier etwas ändern willst …
 *   – Reihenfolge der Kopfbereichsfelder: CHAPTER_KEYS / COURSE_KEYS in documents.js.
 */

(function () {
  "use strict";

  const { serializeFrontmatter } = EM.require("js/content/frontmatter.js");
  const { CHAPTER_KEYS, COURSE_KEYS } = EM.require("js/content/documents.js");
  const { getBlock } = EM.require("js/blocks/registry.js");

  /**
   * Schreibt ein einzelnes Element.
   * @param {import("./documents.js").Element} element
   * @returns {string}
   */
  function serializeElement(element) {
    switch (element.type) {
      case "text":
        return element.markdown.replace(/\s+$/, "");
      case "image":
        return element.caption
          ? `![${element.alt}](${element.src} "${element.caption.replace(/"/g, "'")}")`
          : `![${element.alt}](${element.src})`;
      case "block": {
        const definition = getBlock(element.name);
        if (!definition) {
          throw new Error(`Unbekannter Baustein „${element.name}"`);
        }
        return definition.serialize(element.data);
      }
      case "raw":
        return element.text;
      default:
        throw new Error(`Unbekannte Elementart „${element.type}"`);
    }
  }

  /**
   * Schreibt ein ganzes Kapitel.
   * @param {import("./documents.js").ChapterModel} chapter
   * @returns {string}
   */
  function serializeChapter(chapter) {
    const meta = { ...chapter.meta };
    const parts = [serializeFrontmatter(meta, CHAPTER_KEYS)];
    for (const element of chapter.preamble) {
      parts.push(serializeElement(element));
    }
    for (const page of chapter.pages) {
      parts.push(
        page.title ? `## ${page.title.replace(/\s*\n\s*/g, " ").trim()}` : "##",
      );
      for (const element of page.elements) {
        parts.push(serializeElement(element));
      }
    }
    if (chapter.quiz) {
      parts.push(serializeElement(chapter.quiz));
    }
    return `${parts.filter((part) => part !== "").join("\n\n")}\n`;
  }

  /**
   * Schreibt content/kurs.md.
   * @param {{meta: Object, welcome: string}} course
   * @returns {string}
   */
  function serializeCourse(course) {
    const head = serializeFrontmatter(course.meta, COURSE_KEYS);
    const welcome = course.welcome.trim();
    return welcome ? `${head}\n\n${welcome}\n` : `${head}\n`;
  }

  /**
   * Schreibt content/glossar.md (eine Zeile pro Begriff, Reihenfolge bleibt erhalten).
   * @param {import("./documents.js").GlossaryEntry[]} entries
   * @returns {string}
   */
  function serializeGlossary(entries) {
    const lines = entries.map((entry) =>
      "raw" in entry
        ? entry.raw
        : `${oneLine(entry.term)}: ${oneLine(entry.text)}`,
    );
    return `${lines.join("\n")}\n`;
  }

  /**
   * Fasst einen mehrzeiligen Text zu einer Zeile zusammen (für einzeilige Felder im Kursdown).
   * @param {string} text
   * @returns {string}
   */
  function oneLine(text) {
    return String(text)
      .replace(/\s*\n\s*/g, " ")
      .trim();
  }

  EM.define("js/content/serialize.js", {
    serializeElement,
    serializeChapter,
    serializeCourse,
    serializeGlossary,
  });
})();
