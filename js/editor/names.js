/*
 * names.js – Dateinamen für neue Kapitel und importierte Bilder
 *
 * Regeln (auch in docs/PFLEGE.md erklärt):
 *   – nur Kleinbuchstaben, Ziffern und Bindestriche
 *   – Umlaute werden ausgeschrieben (ä → ae, ß → ss), andere Akzente entfernt
 *   – Kapitel beginnen mit einer zweistelligen Nummer: 07-boxengasse-regeln.md
 *   – gibt es den Namen schon, wird -2, -3 … angehängt
 * Warum so streng? Viele Webserver unterscheiden Groß-/Kleinschreibung und mögen keine
 * Leer- oder Sonderzeichen. So funktionieren die Dateien überall.
 *
 * Reine Funktionen ohne DOM – getestet in tests.html.
 *
 * Wenn du hier etwas ändern willst …
 *   – Erlaubte Bildformate: IMAGE_TYPES.
 */

(function () {
  'use strict';

/** Erlaubte Bildformate (Dateiendung → MIME-Typ). */
const IMAGE_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  gif: 'image/gif',
};

/**
 * Macht aus beliebigem Text einen Dateinamen-Teil.
 * @param {string} text
 * @param {number} [maxLength]
 * @returns {string}
 * @example slugify('Boxengasse: Regeln & Tipps!') // → 'boxengasse-regeln-tipps'
 */
function slugify(text, maxLength = 50) {
  const slug = String(text)
    .trim()
    .toLocaleLowerCase('de')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, maxLength).replace(/-+$/g, '');
}

/**
 * Hängt -2, -3 … an, bis der Name noch nicht vergeben ist.
 * @param {string} base       ohne Endung
 * @param {string} extension  z. B. 'md'
 * @param {string[]} existing vorhandene Dateinamen (mit Endung)
 * @returns {string}
 */
function uniqueName(base, extension, existing) {
  const taken = new Set(existing.map((name) => name.toLowerCase()));
  let candidate = `${base}.${extension}`;
  for (let counter = 2; taken.has(candidate.toLowerCase()); counter += 1) {
    candidate = `${base}-${counter}.${extension}`;
  }
  return candidate;
}

/**
 * Dateiname für ein neues Kapitel: nächste freie Nummer + Titel.
 * @param {string} title
 * @param {string[]} existing  alle bekannten Kapiteldateien (aktiv, inaktiv, archiviert)
 * @returns {string}
 * @example chapterFileName('Boxengasse-Regeln', ['01-a.md', '06-b.md']) // → '07-boxengasse-regeln.md'
 */
function chapterFileName(title, existing) {
  const highest = existing.reduce((max, name) => {
    const match = name.match(/^(\d+)-/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const number = String(highest + 1).padStart(2, '0');
  return uniqueName(`${number}-${slugify(title) || 'kapitel'}`, 'md', existing);
}

/**
 * Bereinigter Dateiname für ein importiertes Bild.
 * @param {string} original   Dateiname vom Rechner, z. B. „Team Foto (1).JPG"
 * @param {string[]} existing  Dateien in assets/bilder/
 * @returns {string|null}  null, wenn das Format nicht erlaubt ist
 */
function imageFileName(original, existing) {
  const match = original.match(/^(.*)\.([^.]+)$/);
  if (!match) return null;
  const extension = match[2].toLowerCase();
  if (!(extension in IMAGE_TYPES)) return null;
  return uniqueName(slugify(match[1]) || 'bild', extension === 'jpeg' ? 'jpg' : extension, existing);
}

/**
 * Name der Sicherungskopie: content/_backup/<datei>-<JJJJ-MM-TT-HHMM>.md
 * @param {string} path  z. B. 'content/kapitel/01-formula-student.md'
 * @param {Date} [date]
 * @returns {string}
 */
function backupPath(path, date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  const name = path.split('/').pop().replace(/\.md$/i, '');
  return `content/_backup/${name}-${stamp}.md`;
}

EM.define('js/editor/names.js', { slugify, uniqueName, chapterFileName, imageFileName, backupPath, IMAGE_TYPES });
})();
