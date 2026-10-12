/*
 * check-page.js – Logik der Prüfseite (pruefen.html)
 *
 * Ablauf:
 *   1. Kurs laden (js/content/loader.js) – mit Originaltexten für exakte Zeilennummern.
 *   2. Inhalte prüfen (js/content/validate.js).
 *   3. Zusätzlich über das Netzwerk prüfen: Gibt es alle Bilder? Liegen in content/kapitel/
 *      Dateien, die nicht in kurs.md eingetragen sind?
 *   4. Meldungen nach Datei gruppiert anzeigen, oben eine Zusammenfassung.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Prüfregel gehört nach validate.js (dann gilt sie auch im Editor), nicht hierher.
 */

import { el } from './dom.js';
import { icon } from './ui/icons.js';
import { CHAPTER_DIR, loadCourse } from './content/loader.js';
import { collectImages, summarize, validateCourse } from './content/validate.js';

const summaryOutput = /** @type {HTMLElement} */ (document.querySelector('[data-summary]'));
const results = /** @type {HTMLElement} */ (document.querySelector('[data-results]'));

const SEVERITY = {
  fehler: { label: 'Fehler', icon: 'cross', order: 0 },
  warnung: { label: 'Warnung', icon: 'warning', order: 1 },
  hinweis: { label: 'Hinweis', icon: 'info', order: 2 },
  todo: { label: 'Platzhalter', icon: 'flag', order: 3 },
};

/** Führt die komplette Prüfung aus und zeigt das Ergebnis. */
async function run() {
  summaryOutput.textContent = 'Prüfung läuft …';
  results.replaceChildren();
  let course;
  try {
    course = await loadCourse();
  } catch (error) {
    summaryOutput.textContent = '';
    results.replaceChildren(
      el('p', { class: 'notice notice--error' }, `Der Kurs konnte nicht geladen werden: ${error.message} Läuft die Seite über das Startskript?`),
    );
    return;
  }
  const errors = validateCourse(course, { sources: course.sources });
  const [imageErrors, listErrors] = await Promise.all([checkImages(course), checkUnlistedChapters(course)]);
  errors.push(...imageErrors, ...listErrors);
  showSummary(summarize(errors));
  showResults(errors, course);
}

/**
 * Prüft per HTTP-Anfrage, ob alle Bilddateien existieren.
 * @returns {Promise<Object[]>}
 */
async function checkImages(course) {
  const checks = collectImages(course).map(async (image) => {
    try {
      const response = await fetch(image.src, { method: 'HEAD', cache: 'no-cache' });
      if (response.ok) return null;
    } catch {
      // Netzwerkfehler wie „nicht gefunden" behandeln.
    }
    return {
      file: image.file,
      line: image.line,
      severity: image.file === 'content/kurs.md' ? 'warnung' : 'fehler',
      message: `Die Bilddatei „${image.src}" wurde nicht gefunden.`,
      fix: 'Prüfe den Pfad (ab Projektordner, z. B. assets/bilder/auto.svg) und die Schreibweise. Groß-/Kleinschreibung zählt auf vielen Webservern!',
    };
  });
  return (await Promise.all(checks)).filter(Boolean);
}

/**
 * Sucht Kapiteldateien, die nicht in kurs.md stehen. Ein statischer Webserver kann Ordner
 * normalerweise nicht auflisten – der Server aus dem Startskript aber schon. Klappt es
 * nicht, gibt es einen Hinweis statt einer Prüfung.
 * @returns {Promise<Object[]>}
 */
async function checkUnlistedChapters(course) {
  try {
    const response = await fetch(`${CHAPTER_DIR}/`, { cache: 'no-cache' });
    const type = response.headers.get('content-type') ?? '';
    if (!response.ok || !type.includes('html')) throw new Error('keine Ordnerliste');
    // DOMParser liest das HTML nur als Daten – Skripte darin werden nicht ausgeführt.
    const listing = new DOMParser().parseFromString(await response.text(), 'text/html');
    const files = [...listing.querySelectorAll('a[href]')]
      .map((link) => decodeURIComponent(link.getAttribute('href') ?? '').split('/').pop())
      .filter((name) => name.endsWith('.md'));
    return files
      .filter((name) => !course.meta.kapitel.includes(name))
      .map((name) => ({
        file: `${CHAPTER_DIR}/${name}`,
        line: 0,
        severity: 'warnung',
        message: `Die Datei „${name}" liegt in content/kapitel/, steht aber nicht in der Kapitelliste von kurs.md. Das Kapitel ist deaktiviert.`,
        fix: 'Gewollt? Dann alles gut. Sonst die Datei unter „kapitel:" in kurs.md eintragen – oder sie nach content/_archiv/ verschieben.',
      }));
  } catch {
    return [
      {
        file: 'content/kurs.md',
        line: 0,
        severity: 'hinweis',
        message: 'Nicht eingetragene Kapiteldateien konnten nicht gesucht werden (der Webserver listet keine Ordner).',
        fix: 'Öffne die Prüfseite über das Startskript, dann klappt diese Prüfung.',
      },
    ];
  }
}

/** Zeigt die Zahlen oben, z. B. „3 Fehler · 5 Warnungen · 12 offene Platzhalter". */
function showSummary(summary) {
  const parts = [
    `${summary.fehler} ${summary.fehler === 1 ? 'Fehler' : 'Fehler'}`,
    `${summary.warnung} ${summary.warnung === 1 ? 'Warnung' : 'Warnungen'}`,
    `${summary.hinweis} ${summary.hinweis === 1 ? 'Hinweis' : 'Hinweise'}`,
    `${summary.todo} offene ${summary.todo === 1 ? 'Platzhalter' : 'Platzhalter'}`,
  ];
  summaryOutput.replaceChildren(
    el('span', { class: `check-summary__count${summary.fehler > 0 ? ' check-summary__count--error' : ''}` }, parts[0]),
    ' · ',
    parts.slice(1).join(' · '),
  );
  if (summary.fehler === 0) {
    summaryOutput.append(el('span', { class: 'check-summary__ok' }, ' – keine Fehler, der Kurs ist lauffähig.'));
  }
}

/** Gruppiert die Meldungen nach Datei und zeigt sie an. */
function showResults(errors, course) {
  if (errors.length === 0) {
    results.replaceChildren(el('p', { class: 'notice notice--success' }, 'Alles in Ordnung. Keine Meldungen.'));
    return;
  }
  const fileOrder = ['content/kurs.md', 'content/glossar.md', ...course.chapters.map((chapter) => chapter.path)];
  const groups = new Map();
  for (const error of errors) {
    if (!groups.has(error.file)) groups.set(error.file, []);
    groups.get(error.file).push(error);
  }
  const sortedFiles = [...groups.keys()].sort((a, b) => rank(fileOrder, a) - rank(fileOrder, b) || a.localeCompare(b));

  results.replaceChildren(
    ...sortedFiles.map((file) => {
      const items = groups.get(file).sort((a, b) => severityOrder(a) - severityOrder(b) || a.line - b.line);
      const chapter = course.chapters.find((entry) => entry.path === file);
      const headingId = `file-${file.replace(/[^a-z0-9]/gi, '-')}`;
      return el(
        'section',
        { class: 'check-file', 'aria-labelledby': headingId },
        el(
          'div',
          { class: 'check-file__head' },
          el('h2', { id: headingId, class: 'check-file__title' }, chapter ? `${chapter.meta.titel} ` : '', el('code', {}, file)),
          chapter
            ? el('a', { class: 'button button--small', href: `index.html#/kapitel/${encodeURIComponent(chapter.id)}/1`, target: '_blank', rel: 'noopener' }, 'Kapitel in der Vorschau öffnen')
            : null,
        ),
        el('ol', { class: 'check-list' }, items.map(renderItem)),
      );
    }),
  );
}

function renderItem(error) {
  const type = error.kind === 'todo' ? 'todo' : error.severity;
  const severity = SEVERITY[type];
  return el(
    'li',
    { class: `check-item check-item--${type}` },
    el(
      'p',
      { class: 'check-item__meta' },
      el('span', { class: 'check-item__badge' }, icon(severity.icon, 'check-item__icon'), severity.label),
      error.line > 0 ? ` Zeile ${error.line}` : ' ganze Datei',
    ),
    el('p', { class: 'check-item__message' }, error.message),
    error.fix ? el('p', { class: 'check-item__fix' }, el('strong', {}, 'Lösung: '), error.fix) : null,
  );
}

function rank(order, file) {
  const index = order.indexOf(file);
  return index === -1 ? order.length : index;
}

function severityOrder(error) {
  return SEVERITY[error.kind === 'todo' ? 'todo' : error.severity].order;
}

document.querySelector('[data-action="recheck"]')?.addEventListener('click', run);
run();
