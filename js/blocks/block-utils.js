/*
 * block-utils.js – gemeinsame Helfer für alle Bausteine
 *
 * Zweck: Damit nicht jeder Baustein das Rad neu erfindet, stehen hier die wiederkehrenden
 * Arbeiten: Kopfzeile schreiben (:::name Titel attr="wert"), Einträge mit „# Name" lesen,
 * Zeilen an | trennen, Fehlermeldungen einheitlich bauen.
 *
 * Zusammenspiel: Wird von jedem Modul in js/blocks/ importiert. Die Vorlage
 * _vorlage-baustein.js zeigt, wie man die Helfer benutzt.
 *
 * Wenn du hier etwas ändern willst …
 *   – Änderungen wirken auf ALLE Bausteine. Danach unbedingt tests.html laufen lassen.
 */

/**
 * Rohdaten eines Bausteins, so wie documents.js sie aus der Datei liest.
 * @typedef {Object} RawBlock
 * @property {string} name        Bausteinname, z. B. 'karten'
 * @property {string} title       Text nach dem Namen in der Kopfzeile (ohne Attribute)
 * @property {Object<string, string>} attrs  Attribute aus der Kopfzeile, z. B. {anzahl: '5'}
 * @property {{text: string, line: number}[]} lines  Zeilen zwischen Kopfzeile und :::
 * @property {number} line        Zeilennummer der Kopfzeile
 * @property {string} file        Dateipfad (für Meldungen)
 */

/**
 * Was ein Baustein beim Darstellen bekommt.
 * @typedef {Object} BlockContext
 * @property {string} chapterId     ID des Kapitels (Dateiname ohne .md)
 * @property {import('../store.js').Store} store  Fortschrittsspeicher (in der Vorschau ohne Speichern)
 * @property {(markdown: string) => DocumentFragment} renderMarkdown  Mehrzeiligen Text darstellen
 * @property {(text: string, options?: {plainGlossary?: boolean}) => DocumentFragment} renderInline
 *           Eine Textzeile darstellen. plainGlossary: Begriffe ohne Popover-Knopf (z. B. in <label>)
 * @property {(prefix: string) => string} uid  Eindeutige ID für aria-Verknüpfungen
 * @property {() => number} random  Zufallszahl 0–1 (in Tests vorhersagbar)
 */

/**
 * Baut die Kopfzeile eines Bausteins in kanonischer Form.
 * Attribute ohne Leerzeichen/Sonderzeichen werden ohne Anführungszeichen geschrieben
 * (anzahl=5), alle anderen mit (bild="assets/bilder/auto.svg").
 *
 * @param {string} name
 * @param {string} [title]
 * @param {Array<[string, string|number|undefined|null]>} [attrs]  Reihenfolge = Ausgabereihenfolge
 * @returns {string}
 * @example formatHeader('quiz', '', [['anzahl', 5]]) // → ':::quiz anzahl=5'
 */
export function formatHeader(name, title = '', attrs = []) {
  const parts = [`:::${name}`];
  if (title.trim() !== '') parts.push(oneLine(title));
  for (const [key, value] of attrs) {
    if (value === undefined || value === null || value === '') continue;
    const text = oneLine(String(value)).replace(/"/g, "'");
    parts.push(/^[\w.%-]+$/.test(text) ? `${key}=${text}` : `${key}="${text}"`);
  }
  return parts.join(' ');
}

/**
 * Baut einen kompletten Baustein: Kopfzeile, Inhalt, Schlusszeile.
 * @param {string} header  Ergebnis von formatHeader
 * @param {string[]} bodyLines
 * @returns {string}
 */
export function formatBlock(header, bodyLines) {
  return [header, ...bodyLines, ':::'].join('\n');
}

/**
 * Liefert die Zeilen ohne führende/abschließende Leerzeilen.
 * @param {{text:string, line:number}[]} lines
 * @returns {{text:string, line:number}[]}
 */
export function trimLines(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].text.trim() === '') start += 1;
  while (end > start && lines[end - 1].text.trim() === '') end -= 1;
  return lines.slice(start, end);
}

/**
 * Inhalt als zusammenhängender Text (für Bausteine mit freiem Markdown, z. B. info).
 * @param {{text:string, line:number}[]} lines
 * @returns {string}
 */
export function joinLines(lines) {
  return trimLines(lines)
    .map((entry) => entry.text.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Teilt eine Zeile an | in Spalten (\| bleibt als Zeichen erhalten).
 * @param {string} text
 * @returns {string[]}
 */
export function splitPipes(text) {
  return text.split(/(?<![\\|])\|(?!\|)/).map((part) => part.trim().replace(/\\\|/g, '|'));
}

/**
 * Schützt | in Text, der in eine |-getrennte Zeile geschrieben wird.
 * @param {string} text
 * @returns {string}
 */
export function escapePipes(text) {
  return oneLine(text).replace(/\|/g, '\\|');
}

/**
 * Liest Einträge der Form:
 *   # Name
 *   schluessel: wert
 *   anderer-schluessel: wert
 * Leerzeilen sind erlaubt. Unbekannte Zeilen werden als Fehler gemeldet.
 *
 * @param {{text:string, line:number}[]} lines
 * @param {RawBlock} raw  für Fehlermeldungen
 * @returns {{entries: {name:string, fields:Object<string,string>, line:number}[], errors: Object[]}}
 */
export function parseEntries(lines, raw) {
  const entries = [];
  const errors = [];
  let current = null;
  for (const { text, line } of lines) {
    const trimmed = text.trim();
    if (trimmed === '') continue;
    const heading = trimmed.match(/^#\s+(.+)$/);
    if (heading) {
      current = { name: heading[1].trim(), fields: {}, line };
      entries.push(current);
      continue;
    }
    const field = trimmed.match(/^([A-Za-zÄÖÜäöüß0-9-]+):\s*(.*)$/);
    if (field && current) {
      current.fields[field[1].toLowerCase()] = field[2].trim();
      continue;
    }
    errors.push(
      blockError(
        raw,
        line,
        current ? `Diese Zeile verstehe ich nicht: „${trimmed}"` : 'Vor dem ersten Eintrag fehlt eine Zeile „# Name".',
        current ? 'Erwartet wird „feldname: wert".' : 'Beginne jeden Eintrag mit einer Zeile wie „# Chassis".',
      ),
    );
  }
  return { entries, errors };
}

/**
 * Baut eine Fehlermeldung für einen Baustein.
 * @param {RawBlock} raw
 * @param {number} line
 * @param {string} message
 * @param {string} [fix]
 * @param {'fehler'|'warnung'|'hinweis'} [severity]
 * @returns {import('../content/frontmatter.js').ValidationError}
 */
export function blockError(raw, line, message, fix = '', severity = 'fehler') {
  return { file: raw.file, line, severity, message: `Baustein „${raw.name}": ${message}`, fix };
}

/**
 * Wandelt mehrzeiligen Text in eine Zeile (für |-getrennte Formate und Kopfzeilen).
 * @param {string} text
 * @returns {string}
 */
export function oneLine(text) {
  return String(text ?? '').replace(/\s*\n\s*/g, ' ').trim();
}

/**
 * Mischt eine Liste (Fisher-Yates) und gibt eine neue Liste zurück.
 * @template T
 * @param {T[]} items
 * @param {() => number} [random]
 * @returns {T[]}
 */
export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Kurzer, stabiler Schlüssel aus einem Text (FNV-1a, 32 Bit, Basis 36).
 * Wird z. B. für Checklisten genutzt: Der Haken hängt am Text des Eintrags, nicht an seiner
 * Position – Umsortieren behält die Haken, Umformulieren setzt nur diesen Eintrag zurück.
 * @param {string} text
 * @returns {string}
 */
export function hashText(text) {
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Prüft, ob Bewegung reduziert werden soll (Systemeinstellung „Bewegung reduzieren").
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Baut die gemeinsame Hülle eines Bausteins: <section> mit Überschrift.
 * @param {string} className   z. B. 'flashcards'
 * @param {string} title       Überschrift ('' = keine)
 * @param {import('./block-utils.js').BlockContext} context
 * @param {string} [fallbackLabel]  Name für Screenreader, wenn es keine Überschrift gibt
 * @returns {{section: HTMLElement, headingId: string}}
 */
export function blockSection(className, title, context, fallbackLabel = '') {
  const headingId = context.uid(className);
  const section = document.createElement('section');
  section.className = `block ${className}`;
  if (title) {
    const heading = document.createElement('h2');
    heading.className = 'block__title';
    heading.id = headingId;
    heading.append(context.renderInline(title));
    section.append(heading);
    section.setAttribute('aria-labelledby', headingId);
  } else if (fallbackLabel) {
    section.setAttribute('aria-label', fallbackLabel);
  }
  return { section, headingId };
}
