/*
 * loader.js – alle Inhaltsdateien laden und zu einem Kursmodell zusammensetzen
 *
 * Ablauf:
 *   1. content/kurs.md laden → Einstellungen + Kapitelliste
 *   2. content/glossar.md laden
 *   3. jede Datei aus der Kapitelliste aus content/kapitel/ laden (parallel)
 * Fehlt eine Datei oder ist sie fehlerhaft, bricht der Kurs NICHT ab: Das Problem landet in
 * course.errors, das Kapitel fehlt, der Rest läuft. Nur ohne kurs.md geht gar nichts.
 *
 * Woher die Dateien kommen, entscheidet eine „Lesefunktion":
 *   – createFetchReader(): per HTTP vom Webserver (Kurs, Prüfseite, Editor im Download-Modus)
 *   – der Editor im Direktmodus liefert eine eigene, die über den Ordnerzugriff liest
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Inhaltsdatei (z. B. content/faq.md): hier laden, in documents.js zerlegen.
 */

import { normalizeText, parseChapter, parseCourse, parseGlossary } from './documents.js';

/** Ordner der Inhalte, relativ zur HTML-Seite. */
export const CONTENT_DIR = 'content';
export const CHAPTER_DIR = `${CONTENT_DIR}/kapitel`;

/**
 * @callback ReadText
 * @param {string} path  Pfad ab Projektordner, z. B. 'content/kurs.md'
 * @returns {Promise<string|null>}  Dateiinhalt oder null, wenn die Datei nicht existiert
 */

/**
 * Lesefunktion über HTTP. cache: 'no-cache' sorgt dafür, dass der Browser immer beim Server
 * nachfragt – sonst sähe man nach dem Speichern im Editor evtl. noch die alte Fassung.
 * @param {string} [base]  Präfix, z. B. '' (gleicher Ordner wie die HTML-Seite)
 * @returns {ReadText}
 */
export function createFetchReader(base = '') {
  return async (path) => {
    const response = await fetch(`${base}${path}`, { cache: 'no-cache' });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`${path}: Server antwortet mit ${response.status}`);
    return response.text();
  };
}

/**
 * @typedef {Object} CourseModel
 * @property {Object} meta          Einstellungen aus kurs.md (meta.kapitel = Kapitelliste)
 * @property {string} welcome       Willkommenstext
 * @property {import('./documents.js').ChapterModel[]} chapters  geladene, aktive Kapitel in Kursreihenfolge
 * @property {import('./documents.js').GlossaryEntry[]} glossary
 * @property {Object[]} errors      Lade- und Lesefehler aller Dateien
 * @property {Object<string, string>} sources  Originaltext je Pfad (für Prüfseite und Tests)
 */

/**
 * Lädt den kompletten Kurs.
 *
 * @param {ReadText} [readText]
 * @returns {Promise<CourseModel>}
 * @throws {Error} nur wenn kurs.md fehlt oder nicht geladen werden kann
 */
export async function loadCourse(readText = createFetchReader()) {
  const sources = {};
  const coursePath = `${CONTENT_DIR}/kurs.md`;
  const courseText = await readText(coursePath);
  if (courseText === null) {
    throw new Error('Die Datei content/kurs.md wurde nicht gefunden.');
  }
  sources[coursePath] = normalizeText(courseText);
  const courseFile = parseCourse(courseText, coursePath);
  const errors = [...courseFile.errors];

  const glossaryPath = `${CONTENT_DIR}/glossar.md`;
  let glossary = [];
  const glossaryText = await readText(glossaryPath).catch(() => null);
  if (glossaryText === null) {
    errors.push({ file: glossaryPath, line: 0, severity: 'warnung', message: 'Die Datei glossar.md fehlt.', fix: 'Lege content/glossar.md an (eine Zeile pro Begriff: „Begriff: Erklärung").' });
  } else {
    sources[glossaryPath] = normalizeText(glossaryText);
    const parsed = parseGlossary(glossaryText, glossaryPath);
    glossary = parsed.entries;
    errors.push(...parsed.errors);
  }

  const seen = new Set();
  const files = courseFile.meta.kapitel.filter((file) => {
    if (seen.has(file)) {
      errors.push({ file: coursePath, line: 0, severity: 'fehler', message: `Das Kapitel „${file}" steht doppelt in der Kapitelliste.`, fix: 'Lösche einen der beiden Einträge unter „kapitel:".' });
      return false;
    }
    seen.add(file);
    return true;
  });

  const loaded = await Promise.all(
    files.map(async (file) => {
      const path = `${CHAPTER_DIR}/${file}`;
      try {
        const text = await readText(path);
        if (text === null) {
          errors.push({ file: coursePath, line: 0, severity: 'fehler', message: `Das Kapitel „${file}" steht in der Kapitelliste, die Datei gibt es aber nicht.`, fix: `Lege content/kapitel/${file} an oder entferne den Eintrag aus kurs.md. Prüfe auch die Schreibweise (Groß-/Kleinschreibung, .md am Ende).` });
          return null;
        }
        sources[path] = normalizeText(text);
        const chapter = parseChapter(text, file, CHAPTER_DIR);
        errors.push(...chapter.errors);
        return chapter;
      } catch (error) {
        errors.push({ file: path, line: 0, severity: 'fehler', message: `Die Datei konnte nicht geladen werden (${error.message}).`, fix: 'Läuft der Kurs über das Startskript bzw. einen Webserver?' });
        return null;
      }
    }),
  );

  return {
    meta: courseFile.meta,
    welcome: courseFile.welcome,
    chapters: loaded.filter((chapter) => chapter !== null && !chapter.fatal),
    glossary,
    errors,
    sources,
  };
}

/**
 * Bestehensgrenze eines Kapitels: Kapitel-Wert, sonst Kurs-Wert, sonst 80.
 * @param {CourseModel} course
 * @param {import('./documents.js').ChapterModel} chapter
 * @returns {number}
 */
export function passThreshold(course, chapter) {
  const value = Number(chapter?.meta.bestehensgrenze ?? course.meta.bestehensgrenze ?? 80);
  return Number.isFinite(value) && value > 0 && value <= 100 ? value : 80;
}
