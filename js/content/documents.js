/*
 * documents.js – die drei Dateiarten in Datenmodelle zerlegen
 *
 *   content/kurs.md           → parseCourse()    Kurseinstellungen + Willkommenstext
 *   content/kapitel/*.md      → parseChapter()   Kopfbereich, Seiten, Elemente, Quiz
 *   content/glossar.md        → parseGlossary()  Begriff: Erklärung
 *
 * Aufbau eines Kapitels (Datenmodell, siehe @typedef unten):
 *   Kopfbereich ──▶ meta
 *   Text vor dem ersten „## " ──▶ preamble (sollte leer sein, wird aber nie verworfen)
 *   jede „## Überschrift" ──▶ eine Seite mit Elementen:
 *       text   – Markdown-Rohtext (Absätze, Listen, Tabellen, ### …)
 *       image  – ein Absatz, der nur aus ![Alt](pfad "Unterschrift") besteht
 *       block  – ein lesbarer Baustein (:::name … :::) mit seinen Daten
 *       raw    – ein NICHT lesbarer Abschnitt (Syntaxfehler, unbekannter Baustein,
 *                fehlendes :::). Der Originaltext bleibt Zeichen für Zeichen erhalten.
 *   der :::quiz-Baustein ──▶ quiz (egal wo er steht; beim Speichern immer ans Ende)
 *
 * Der umgekehrte Weg (Modell → Text) steht in serialize.js. Beide zusammen garantieren:
 * parse(serialize(parse(text))) ist inhaltsgleich zu parse(text). tests.html prüft das.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Elementart: hier erkennen, in serialize.js schreiben, in render.js darstellen,
 *     im Editor (js/editor/page-canvas.js) anbieten, Round-Trip-Test ergänzen.
 */

import { parseFrontmatter } from './frontmatter.js';
import { getBlock } from '../blocks/registry.js';

/**
 * @typedef {{type:'text', markdown:string, line:number}} TextElement
 * @typedef {{type:'image', src:string, alt:string, caption:string, line:number}} ImageElement
 * @typedef {{type:'block', name:string, data:any, line:number}} BlockElement
 * @typedef {{type:'raw', text:string, errors:Object[], line:number}} RawElement
 * @typedef {TextElement|ImageElement|BlockElement|RawElement} Element
 */

/**
 * @typedef {Object} Page
 * @property {string} title     Text der „## "-Überschrift
 * @property {Element[]} elements
 * @property {number} line
 */

/**
 * @typedef {Object} ChapterModel
 * @property {string} id        Dateiname ohne .md, z. B. '01-formula-student'
 * @property {string} file      Dateiname, z. B. '01-formula-student.md'
 * @property {string} path      Pfad ab Projektordner, z. B. 'content/kapitel/01-formula-student.md'
 * @property {Object} meta      Kopfbereich (titel, kurztitel, dauer, version, lernziele …)
 * @property {Element[]} preamble
 * @property {Page[]} pages
 * @property {BlockElement|null} quiz
 * @property {Object[]} errors  Fehler beim Lesen des Kopfbereichs (Fehler nicht lesbarer
 *                              Abschnitte stehen am jeweiligen raw-Element)
 * @property {boolean} fatal    true, wenn der Kopfbereich unbrauchbar ist
 */

/** Bekannte Felder eines Kapitel-Kopfbereichs in kanonischer Reihenfolge. */
export const CHAPTER_KEYS = ['titel', 'kurztitel', 'dauer', 'version', 'bestehensgrenze', 'freigegeben', 'lernziele'];

/** Bekannte Felder von kurs.md in kanonischer Reihenfolge. */
export const COURSE_KEYS = [
  'titel',
  'team',
  'kursversion',
  'bestehensgrenze',
  'qualifying-fragen',
  'zertifikat-titel',
  'zertifikat-unterschrift-name',
  'zertifikat-unterschrift-rolle',
  'logo',
  'kapitel',
];

const BLOCK_OPEN = /^:::\s*([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß0-9-]*)(.*)$/;
const PAGE_HEADING = /^##(?:\s+(.*?))?\s*$/;
// Leerer Pfad ist erlaubt (unfertiges Bild aus dem Editor) – die Prüfung meldet ihn.
const IMAGE_ONLY = /^!\[([^\]]*)\]\(\s*([^)\s]*)(?:\s+"([^"]*)")?\s*\)$/;

/**
 * Bereitet Dateitext vor: Byte-Order-Mark entfernen, Windows-Zeilenenden vereinheitlichen.
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

/**
 * Zerlegt eine Kapiteldatei.
 *
 * @param {string} text   Dateiinhalt
 * @param {string} file   Dateiname, z. B. '01-formula-student.md'
 * @param {string} [dir]  Ordner ab Projektordner (Standard: content/kapitel)
 * @returns {ChapterModel}
 */
export function parseChapter(text, file, dir = 'content/kapitel') {
  const path = `${dir}/${file}`;
  const source = normalizeText(text);
  const front = parseFrontmatter(source, path);
  const chapter = {
    id: file.replace(/\.md$/i, ''),
    file,
    path,
    meta: normalizeChapterMeta(front.meta),
    preamble: [],
    pages: [],
    quiz: null,
    errors: [...front.errors],
    fatal: !front.hasFrontmatter || front.errors.some((error) => error.line === 1),
  };
  if (!front.hasFrontmatter) {
    chapter.errors.push({
      file: path,
      line: 1,
      severity: 'fehler',
      message: 'Die Datei hat keinen Kopfbereich.',
      fix: 'Die erste Zeile muss --- sein. Kopiere den Anfang aus content/_vorlage-kapitel.md.',
    });
  }

  const elements = parseBody(front.body, front.bodyStartLine, path);
  let target = chapter.preamble;
  for (const item of elements) {
    if (item.type === 'page') {
      const page = { title: item.title, elements: [], line: item.line };
      chapter.pages.push(page);
      target = page.elements;
    } else if (item.type === 'block' && item.name === 'quiz' && chapter.quiz === null) {
      chapter.quiz = item;
    } else {
      target.push(item);
    }
    // Fehler nicht lesbarer Abschnitte bleiben am Element (item.errors). validate.js sammelt
    // sie dort ein – so stimmen sie auch noch, nachdem der Editor das Kapitel verändert hat.
  }
  return chapter;
}

/**
 * Vereinheitlicht den Kopfbereich eines Kapitels: Listenfelder sind immer Listen.
 * (Eine leere Liste steht in der Datei als „lernziele:" und wird beim Lesen zu '' –
 * hier wird daraus wieder [].)
 * @param {Object} meta
 * @returns {Object}
 */
export function normalizeChapterMeta(meta) {
  const result = { ...meta };
  if (!Array.isArray(result.lernziele)) {
    result.lernziele = result.lernziele ? [String(result.lernziele)] : [];
  }
  return result;
}

/**
 * Zerlegt den Text nach dem Kopfbereich in eine flache Folge aus Seitenanfängen und
 * Elementen. Seitenanfänge haben type 'page'.
 *
 * @param {string} body
 * @param {number} startLine
 * @param {string} path
 * @returns {Array<Element|{type:'page', title:string, line:number}>}
 */
export function parseBody(body, startLine, path) {
  const lines = body.split('\n');
  const result = [];
  let textBuffer = [];
  let block = null; // aktuell offener Baustein

  const flushText = () => {
    result.push(...textToElements(textBuffer));
    textBuffer = [];
  };

  const closeBlock = (complete) => {
    result.push(buildBlockElement(block, complete, path));
    block = null;
  };

  lines.forEach((line, index) => {
    const lineNumber = startLine + index;
    const trimmed = line.trim();

    if (block) {
      if (trimmed === ':::') {
        block.closeLine = line;
        closeBlock(true);
        return;
      }
      if (BLOCK_OPEN.test(trimmed)) {
        // Neuer Baustein, obwohl der alte nicht geschlossen ist → alter ist nicht lesbar.
        closeBlock(false);
      } else {
        block.lines.push({ text: line, line: lineNumber });
        return;
      }
    }

    const open = trimmed.match(BLOCK_OPEN);
    if (open) {
      flushText();
      const header = parseBlockHeader(open[2]);
      block = { name: open[1], title: header.title, attrs: header.attrs, headerLine: line, lines: [], line: lineNumber };
      return;
    }

    const heading = line.match(PAGE_HEADING);
    if (heading) {
      flushText();
      result.push({ type: 'page', title: (heading[1] ?? '').trim(), line: lineNumber });
      return;
    }

    textBuffer.push({ text: line, line: lineNumber });
  });

  if (block) closeBlock(false);
  flushText();
  return result;
}

/**
 * Liest Titel und Attribute aus dem Rest der Kopfzeile eines Bausteins.
 * Wörter der Form schluessel=wert oder schluessel="wert mit Leerzeichen" sind Attribute,
 * alles andere ergibt zusammen den Titel.
 *
 * @param {string} rest  Text nach „:::name"
 * @returns {{title: string, attrs: Object<string, string>}}
 * @example parseBlockHeader(' Unser Drive bild="a b.svg" x=1')
 *   // → { title: 'Unser Drive', attrs: { bild: 'a b.svg', x: '1' } }
 */
export function parseBlockHeader(rest) {
  const attrs = {};
  const titleParts = [];
  const token = /([a-zäöüß][a-zäöüß0-9-]*)=(?:"([^"]*)"|(\S+))|("[^"]*"|\S+)/gi;
  for (const match of rest.matchAll(token)) {
    if (match[1]) {
      attrs[match[1].toLowerCase()] = match[2] ?? match[3];
    } else {
      titleParts.push(match[4]);
    }
  }
  return { title: titleParts.join(' '), attrs };
}

/**
 * Macht aus einem eingelesenen Baustein ein Element: lesbar (block) oder nicht lesbar (raw).
 */
function buildBlockElement(block, complete, path) {
  const rawText = [block.headerLine, ...block.lines.map((entry) => entry.text), ...(complete ? [block.closeLine] : [])].join('\n');
  const definition = getBlock(block.name);
  const raw = { name: block.name, title: block.title, attrs: block.attrs, lines: block.lines, line: block.line, file: path };

  if (!complete) {
    return rawElement(rawText, block.line, [
      {
        file: path,
        line: block.line,
        severity: 'fehler',
        message: `Der Baustein „${block.name}" wird nicht geschlossen.`,
        fix: 'Füge am Ende des Bausteins eine Zeile mit genau drei Doppelpunkten (:::) ein.',
      },
    ]);
  }
  if (!definition) {
    return rawElement(rawText, block.line, [
      {
        file: path,
        line: block.line,
        severity: 'fehler',
        message: `Unbekannter Baustein „${block.name}".`,
        fix: 'Prüfe die Schreibweise. Alle Bausteine stehen in docs/BAUSTEINE.md.',
      },
    ]);
  }
  let parsed;
  try {
    parsed = definition.parse(raw);
  } catch (error) {
    parsed = { data: null, errors: [{ file: path, line: block.line, severity: 'fehler', message: `Baustein „${block.name}" konnte nicht gelesen werden (${error.message}).`, fix: 'Vergleiche den Abschnitt mit der Vorlage in docs/BAUSTEINE.md.' }] };
  }
  const fatal = parsed.errors.filter((error) => error.severity === 'fehler');
  if (fatal.length > 0) {
    return rawElement(rawText, block.line, parsed.errors);
  }
  return { type: 'block', name: block.name, data: parsed.data, line: block.line, warnings: parsed.errors };
}

function rawElement(text, line, errors) {
  return { type: 'raw', text, errors, line };
}

/**
 * Teilt gesammelte Textzeilen in Elemente: Absätze, die nur aus einem Bild bestehen, werden
 * Bildelemente; alles andere wird zu möglichst großen Textelementen zusammengefasst.
 * @param {{text:string, line:number}[]} buffer
 * @returns {Element[]}
 */
function textToElements(buffer) {
  const chunks = [];
  let current = null;
  for (const entry of buffer) {
    if (entry.text.trim() === '') {
      current = null;
      continue;
    }
    if (!current) {
      current = { lines: [], line: entry.line };
      chunks.push(current);
    }
    current.lines.push(entry.text.replace(/\s+$/, ''));
  }

  const elements = [];
  let text = null;
  for (const chunk of chunks) {
    const joined = chunk.lines.join('\n');
    const image = chunk.lines.length === 1 ? joined.trim().match(IMAGE_ONLY) : null;
    if (image) {
      text = null;
      elements.push({ type: 'image', alt: image[1], src: image[2], caption: image[3] ?? '', line: chunk.line });
    } else if (text) {
      text.markdown += `\n\n${joined}`;
    } else {
      text = { type: 'text', markdown: joined, line: chunk.line };
      elements.push(text);
    }
  }
  return elements;
}

/**
 * @typedef {Object} CourseFile
 * @property {Object} meta       Kopfbereich von kurs.md; meta.kapitel ist immer eine Liste
 * @property {string} welcome    Willkommenstext (Markdown)
 * @property {number} welcomeLine
 * @property {Object[]} errors
 */

/**
 * Zerlegt content/kurs.md.
 * @param {string} text
 * @param {string} [path]
 * @returns {CourseFile}
 */
export function parseCourse(text, path = 'content/kurs.md') {
  const front = parseFrontmatter(normalizeText(text), path);
  const meta = { ...front.meta };
  if (!Array.isArray(meta.kapitel)) meta.kapitel = meta.kapitel ? [String(meta.kapitel)] : [];
  const errors = [...front.errors];
  if (!front.hasFrontmatter) {
    errors.push({ file: path, line: 1, severity: 'fehler', message: 'kurs.md hat keinen Kopfbereich.', fix: 'Die erste Zeile muss --- sein.' });
  }
  return { meta, welcome: front.body.trim(), welcomeLine: front.bodyStartLine, errors };
}

/**
 * @typedef {{term: string, text: string, line: number}|{raw: string, line: number}} GlossaryEntry
 *   raw-Einträge sind Zeilen, die nicht dem Format entsprechen; sie bleiben beim Speichern erhalten.
 */

/**
 * Zerlegt content/glossar.md. Format pro Zeile: „Begriff: Erklärung".
 * @param {string} text
 * @param {string} [path]
 * @returns {{entries: GlossaryEntry[], errors: Object[]}}
 */
export function parseGlossary(text, path = 'content/glossar.md') {
  const entries = [];
  const errors = [];
  normalizeText(text)
    .split('\n')
    .forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed === '') return;
      const match = trimmed.match(/^([^:]+?):\s+(.+)$/);
      if (match) {
        entries.push({ term: match[1].trim(), text: match[2].trim(), line: index + 1 });
      } else {
        entries.push({ raw: trimmed, line: index + 1 });
        errors.push({
          file: path,
          line: index + 1,
          severity: 'fehler',
          message: `Diese Glossarzeile verstehe ich nicht: „${trimmed}"`,
          fix: 'Format: „Begriff: Erklärung in ein bis zwei Sätzen." – mit Doppelpunkt und Leerzeichen.',
        });
      }
    });
  return { entries, errors };
}

/**
 * Sucht einen Glossareintrag (Groß-/Kleinschreibung egal).
 * @param {GlossaryEntry[]} entries
 * @param {string} term
 * @returns {{term:string, text:string}|undefined}
 */
export function findGlossaryEntry(entries, term) {
  const wanted = term.trim().toLocaleLowerCase('de');
  return entries.find((entry) => 'term' in entry && entry.term.toLocaleLowerCase('de') === wanted);
}

/**
 * Ist das Kapitel ein Sicherheitskapitel? Erkennungsmerkmal: Es hat das Feld „freigegeben".
 * @param {ChapterModel} chapter
 * @returns {boolean}
 */
export function isSafetyChapter(chapter) {
  return 'freigegeben' in chapter.meta;
}

/**
 * Ist das Sicherheitskapitel freigegeben? (ja/true/1, egal wie geschrieben)
 * @param {ChapterModel} chapter
 * @returns {boolean}
 */
export function isReleased(chapter) {
  return ['ja', 'true', '1'].includes(String(chapter.meta.freigegeben).trim().toLowerCase());
}
