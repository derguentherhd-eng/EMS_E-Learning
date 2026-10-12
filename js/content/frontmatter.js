/*
 * frontmatter.js – Kopfbereich einer Inhaltsdatei lesen und schreiben
 *
 * Der Kopfbereich steht zwischen zwei Zeilen mit drei Bindestrichen:
 *
 *   ---
 *   titel: Was ist Formula Student?
 *   dauer: 8
 *   lernziele:
 *     - Du kannst die drei Fahrzeugklassen benennen.
 *   ---
 *
 * Unterstützt wird bewusst nur:
 *   – schluessel: wert       (Text; ganze Zahlen und Kommazahlen mit Punkt werden zu Zahlen)
 *   – schluessel:            gefolgt von Zeilen „  - eintrag" (Liste)
 * Mehr nicht – keine Anführungszeichen-Regeln, keine Verschachtelung. Das hält die Dateien
 * für alle lesbar und Fehler leicht findbar.
 *
 * Zahlen-Regel: Ein Wert wird nur dann zur Zahl, wenn er beim Zurückschreiben exakt gleich
 * aussieht. „80" → 80, aber „1.0" bleibt Text „1.0" (sonst würde daraus beim Speichern „1").
 *
 * Zusammenspiel: documents.js nutzt parseFrontmatter für alle drei Dateiarten,
 * serialize.js nutzt serializeFrontmatter beim Speichern aus dem Editor.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Syntax bitte nur mit gutem Grund: Jede Erweiterung muss auch der Serializer,
 *     die Prüfseite und docs/PFLEGE.md kennen.
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} file       Dateipfad relativ zum Projektordner, z. B. 'content/kurs.md'
 * @property {number} line       Zeilennummer (ab 1) oder 0, wenn die ganze Datei betroffen ist
 * @property {'fehler'|'warnung'|'hinweis'} severity
 * @property {string} message    Was ist los? (Klartext, Du-Form)
 * @property {string} [fix]      Was kann ich tun?
 * @property {'todo'} [kind]     'todo' für {{TODO}}-Platzhalter (eigene Zählung auf der Prüfseite)
 * @property {Object} [ref]      Sprungziel im Editor: {page, element} (siehe validate.js)
 */

/**
 * @typedef {Object} FrontmatterResult
 * @property {Object<string, string|number|string[]>} meta  Werte in Originalreihenfolge
 * @property {string} body              Text nach dem Kopfbereich
 * @property {number} bodyStartLine     Zeilennummer, mit der body beginnt (ab 1)
 * @property {boolean} hasFrontmatter   false, wenn die Datei nicht mit --- beginnt
 * @property {ValidationError[]} errors
 */

const KEY_LINE = /^([A-Za-z0-9ÄÖÜäöüß_-]+):(?:\s+(.*))?\s*$/;
const LIST_LINE = /^\s*-\s+(.*?)\s*$|^\s*-\s*$/;

/**
 * Liest den Kopfbereich.
 *
 * @param {string} text  vollständiger Dateiinhalt (Zeilenenden \n)
 * @param {string} [file]  Dateipfad für Fehlermeldungen
 * @returns {FrontmatterResult}
 * @example
 *   parseFrontmatter('---\ntitel: Hallo\ndauer: 8\n---\nText').meta
 *   // → { titel: 'Hallo', dauer: 8 }
 */
export function parseFrontmatter(text, file = '') {
  const lines = text.split('\n');
  const errors = [];
  const meta = {};

  if (lines[0]?.trim() !== '---') {
    return { meta, body: text, bodyStartLine: 1, hasFrontmatter: false, errors };
  }

  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (end === -1) {
    errors.push({
      file,
      line: 1,
      severity: 'fehler',
      message: 'Der Kopfbereich wird nicht geschlossen.',
      fix: 'Füge nach dem letzten Eintrag eine Zeile mit genau drei Bindestrichen (---) ein.',
    });
    return { meta, body: '', bodyStartLine: lines.length + 1, hasFrontmatter: true, errors };
  }

  let listKey = null;
  for (let index = 1; index < end; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;
    if (line.trim() === '') continue;

    const keyMatch = !/^\s/.test(line) && line.match(KEY_LINE);
    if (keyMatch) {
      const [, key, rawValue = ''] = keyMatch;
      if (key in meta) {
        errors.push({
          file,
          line: lineNumber,
          severity: 'fehler',
          message: `Der Eintrag „${key}" kommt im Kopfbereich doppelt vor.`,
          fix: 'Lösche eine der beiden Zeilen.',
        });
      }
      const value = rawValue.trim();
      meta[key] = value === '' ? '' : toValue(value);
      listKey = value === '' ? key : null;
      continue;
    }

    const listMatch = line.match(LIST_LINE);
    if (listMatch) {
      if (listKey === null) {
        errors.push({
          file,
          line: lineNumber,
          severity: 'fehler',
          message: 'Dieser Listeneintrag gehört zu keinem Schlüssel.',
          fix: 'Listeneinträge stehen direkt unter einer Zeile wie „lernziele:" (ohne Wert dahinter).',
        });
        continue;
      }
      if (!Array.isArray(meta[listKey])) meta[listKey] = [];
      meta[listKey].push((listMatch[1] ?? '').trim());
      continue;
    }

    errors.push({
      file,
      line: lineNumber,
      severity: 'fehler',
      message: `Diese Zeile im Kopfbereich ist ungültig: „${line.trim()}"`,
      fix: 'Erlaubt sind nur „schluessel: wert" und Listeneinträge „  - eintrag".',
    });
  }

  return {
    meta,
    body: lines.slice(end + 1).join('\n'),
    bodyStartLine: end + 2,
    hasFrontmatter: true,
    errors,
  };
}

/**
 * Schreibt einen Kopfbereich (inklusive der beiden ---Zeilen, ohne abschließenden Zeilenumbruch).
 *
 * Reihenfolge: zuerst die Schlüssel aus `order` (sofern vorhanden), danach alle übrigen in
 * ihrer bisherigen Reihenfolge. So bleiben unbekannte Schlüssel erhalten.
 *
 * @param {Object<string, string|number|string[]>} meta
 * @param {string[]} [order]  bevorzugte Reihenfolge der Schlüssel
 * @returns {string}
 * @example
 *   serializeFrontmatter({ dauer: 8, titel: 'X' }, ['titel', 'dauer'])
 *   // → '---\ntitel: X\ndauer: 8\n---'
 */
export function serializeFrontmatter(meta, order = []) {
  const keys = [
    ...order.filter((key) => key in meta),
    ...Object.keys(meta).filter((key) => !order.includes(key)),
  ];
  const lines = ['---'];
  for (const key of keys) {
    const value = meta[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${oneLine(item)}`);
    } else if (value === '') {
      lines.push(`${key}:`);
    } else {
      lines.push(`${key}: ${oneLine(value)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

/**
 * Wandelt einen Textwert in eine Zahl um – aber nur, wenn das verlustfrei ist.
 * @param {string} value
 * @returns {string|number}
 */
function toValue(value) {
  if (/^-?\d+(\.\d+)?$/.test(value) && String(Number(value)) === value) {
    return Number(value);
  }
  return value;
}

/** Zeilenumbrüche würden den Kopfbereich zerstören → durch Leerzeichen ersetzen. */
function oneLine(value) {
  return String(value).replace(/\s*\n\s*/g, ' ').trim();
}
