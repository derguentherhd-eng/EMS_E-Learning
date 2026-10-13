/*
 * editor-main.js – Einstieg und Steuerzentrale des Editors (editor.html)
 *
 * Grundprinzip: EIN Datenmodell (state.doc), aus dem die ganze Oberfläche gerendert wird.
 *   doc.course    Kurseinstellungen + Willkommenstext (content/kurs.md)
 *   doc.glossary  Glossareinträge (content/glossar.md)
 *   doc.chapters  alle Kapiteldateien: aktiv, inaktiv und archiviert, jeweils mit
 *                 { file, location: 'kapitel'|'archiv', origin, model }
 *                 origin = wo die Datei beim Laden lag (null = neu). Daraus ergibt sich beim
 *                 Speichern, was geschrieben, umbenannt oder verschoben werden muss.
 * Die Markdown-Dateien bleiben die einzige Quelle: Beim Speichern wird das Modell mit
 * js/content/serialize.js zurück in Text verwandelt.
 *
 * Jede Änderung läuft über commit(): Schnappschuss für „Rückgängig" → Änderung → betroffene
 * Bereiche neu zeichnen → Vorschau und Prüfung (verzögert) aktualisieren.
 *
 * Zusammenspiel:
 *   workspace.js     Dateien lesen/schreiben (Direkt- oder Download-Modus)
 *   course-tree.js   linke Spalte · page-canvas.js mittlere Spalte und Elementformulare
 *   preview.js       Live-Vorschau · history.js Rückgängig/Wiederholen · dialogs.js Dialoge
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Kapitel-Aktion: Funktion in `operations` ergänzen, Knopf in course-tree.js oder
 *     page-canvas.js. Immer über commit(), sonst funktioniert „Rückgängig" nicht.
 */

import { el } from '../dom.js';
import { normalizeText, parseChapter, parseCourse, parseGlossary, findGlossaryEntry, isReleased, isSafetyChapter } from '../content/documents.js';
import { serializeChapter, serializeCourse, serializeElement, serializeGlossary } from '../content/serialize.js';
import { validateCourse } from '../content/validate.js';
import { createHistory, record, redo as historyRedo, undo as historyUndo } from './history.js';
import { createDownloadWorkspace, downloadBlob, forgetDirectory, openDirectory, restoreDirectory, supportsDirectAccess } from './workspace.js';
import { backupPath, chapterFileName, slugify, uniqueName } from './names.js';
import { confirmDialog, openDialog, promptDialog } from './dialogs.js';
import { renderTree } from './course-tree.js';
import { renderMiddle, renderProperties } from './page-canvas.js';
import { createPreview } from './preview.js';
import { importImage } from './image-import.js';
import { applyTheme } from '../ui/theme.js';
import { getBlock } from '../blocks/registry.js';

const COURSE_PATH = 'content/kurs.md';
const GLOSSARY_PATH = 'content/glossar.md';
const TEMPLATE_PATH = 'content/_vorlage-kapitel.md';
const DIRS = { kapitel: 'content/kapitel', archiv: 'content/_archiv' };

/* ───────────────────────────── Zustand ───────────────────────────── */

/**
 * @typedef {Object} ChapterEntry
 * @property {string} file
 * @property {'kapitel'|'archiv'} location
 * @property {{file: string, location: 'kapitel'|'archiv'}|null} origin
 * @property {import('../content/documents.js').ChapterModel|null} model  null = Datei nicht lesbar
 * @property {string} [brokenText]   Originaltext einer nicht lesbaren Datei
 */

const state = {
  /** @type {import('./workspace.js').Workspace|null} */
  workspace: null,
  /** @type {{course: {meta: Object, welcome: string}, glossary: Object[], chapters: ChapterEntry[]}|null} */
  doc: null,
  /** Dateien, wie sie beim Laden/Speichern auf der Platte standen: Pfad → {text, lastModified, backedUp} */
  files: {},
  /** Quiz und Version beim Laden (für den Vorschlag „Version erhöhen") */
  baseline: {},
  template: null,
  selection: { kind: 'course' },
  ui: { rightTab: 'preview', previewWidth: 'mobile', previewTheme: 'dark', sourceView: false, expanded: new Set(), hintsAll: false },
  history: createHistory(),
  /** Bilder, die im Download-Modus noch heruntergeladen werden müssen: Pfad → {blob, url} */
  pendingAssets: new Map(),
  imageNames: [],
  validation: [],
};

const regions = {
  start: /** @type {HTMLElement} */ (document.querySelector('[data-region="start"]')),
  layout: /** @type {HTMLElement} */ (document.querySelector('[data-region="layout"]')),
  tree: /** @type {HTMLElement} */ (document.querySelector('[data-region="tree"]')),
  middle: /** @type {HTMLElement} */ (document.querySelector('[data-region="middle"]')),
  side: /** @type {HTMLElement} */ (document.querySelector('[data-region="side"]')),
  properties: /** @type {HTMLElement} */ (document.querySelector('[data-region="properties"]')),
  previewPanel: /** @type {HTMLElement} */ (document.querySelector('[data-region="preview"]')),
  hints: /** @type {HTMLElement} */ (document.querySelector('[data-region="hints"]')),
  status: /** @type {HTMLElement} */ (document.querySelector('[data-region="status"]')),
  mode: /** @type {HTMLElement} */ (document.querySelector('[data-region="mode"]')),
  dirty: /** @type {HTMLElement} */ (document.querySelector('[data-region="dirty"]')),
  title: /** @type {HTMLElement} */ (document.querySelector('[data-region="title"]')),
};

let preview = null;

/* ───────────────────────────── Pfade und Abfragen ───────────────────────────── */

/** @param {{file: string, location: string}} entry */
function chapterPath(entry) {
  return `${DIRS[entry.location]}/${entry.file}`;
}

function entryByFile(file) {
  return state.doc.chapters.find((entry) => entry.file === file);
}

function activeEntries() {
  return state.doc.course.meta.kapitel.map(entryByFile).filter(Boolean);
}

function inactiveEntries() {
  return state.doc.chapters.filter((entry) => entry.location === 'kapitel' && !state.doc.course.meta.kapitel.includes(entry.file));
}

function archivedEntries() {
  return state.doc.chapters.filter((entry) => entry.location === 'archiv');
}

function allChapterFiles() {
  return state.doc.chapters.map((entry) => entry.file);
}

/** Kursmodell im Format des Kurses (für Prüfung und Vorschau). */
function courseModel(extraEntry = null) {
  const entries = activeEntries();
  if (extraEntry && !entries.includes(extraEntry)) entries.push(extraEntry);
  return {
    meta: state.doc.course.meta,
    welcome: state.doc.course.welcome,
    welcomeLine: 1,
    chapters: entries.map((entry) => entry.model).filter(Boolean),
    glossary: state.doc.glossary,
    errors: [],
  };
}

/* ───────────────────────────── Änderungen ───────────────────────────── */

/**
 * Führt eine Änderung am Modell aus.
 * @param {(doc: Object) => void} mutate
 * @param {Object} [options]
 * @param {string} [options.coalesce]  Bündelschlüssel fürs Tippen (siehe history.js)
 * @param {'tree'|'middle'|'right'|'forms'|null} [options.source]  Bereich, der NICHT neu gezeichnet wird
 * @param {string} [options.chapter]   betroffene Kapiteldatei (für die Freigabe-Regel)
 * @param {boolean} [options.releaseField]  Änderung betrifft das Feld „freigegeben" selbst
 * @param {boolean} [options.structural]    Quellbereich trotzdem neu zeichnen
 */
function commit(mutate, options = {}) {
  record(state.history, structuredClone(state.doc), options.coalesce ?? null);
  mutate(state.doc);
  const releaseReset = options.chapter && !options.releaseField ? resetRelease(options.chapter) : false;
  // Bei zurückgesetzter Freigabe auch den Bereich neu zeichnen, in dem gerade getippt wird –
  // sonst zeigt das Formular dort noch „ja".
  afterChange(options.structural || releaseReset ? null : options.source ?? null);
}

/**
 * Arbeitssicherheit: Jede Änderung an einem freigegebenen Sicherheitskapitel setzt die
 * Freigabe zurück – geänderte Inhalte müssen neu geprüft werden.
 * @returns {boolean} true, wenn die Freigabe zurückgesetzt wurde
 */
function resetRelease(file) {
  const model = entryByFile(file)?.model;
  if (model && isSafetyChapter(model) && isReleased(model)) {
    model.meta.freigegeben = 'nein';
    setStatus(`Hinweis: „${model.meta.titel}" ist ein Sicherheitskapitel. Wegen deiner Änderung steht „freigegeben" jetzt auf „nein" – bitte erneut freigeben lassen.`);
    return true;
  }
  return false;
}

/**
 * Zeichnet nach einer Änderung neu. source = Bereich, der gerade bearbeitet wird und deshalb
 * stehen bleibt ('forms' = beide Formularbereiche, z. B. während ein Dialog Text einfügt).
 */
function afterChange(source) {
  renderBar();
  if (source !== 'tree') regions.tree.replaceChildren(renderTree(api));
  if (source !== 'middle' && source !== 'forms') rerenderKeepingFocus(regions.middle, () => renderMiddle(api));
  if (source !== 'right' && source !== 'forms') rerenderKeepingFocus(regions.properties, () => renderProperties(api));
  schedulePreview();
  scheduleValidation();
}

/** Zeichnet einen Bereich neu und setzt den Fokus wieder auf das Element mit gleicher ID. */
function rerenderKeepingFocus(region, build) {
  const activeId = region.contains(document.activeElement) ? document.activeElement?.id : null;
  region.replaceChildren(build());
  if (activeId) document.getElementById(activeId)?.focus();
}

function undo() {
  const previous = historyUndo(state.history, structuredClone(state.doc));
  if (!previous) return setStatus('Nichts zum Rückgängigmachen.');
  state.doc = previous;
  fixSelection();
  renderAll();
  setStatus('Rückgängig gemacht.');
}

function redo() {
  const next = historyRedo(state.history, structuredClone(state.doc));
  if (!next) return setStatus('Nichts zum Wiederholen.');
  state.doc = next;
  fixSelection();
  renderAll();
  setStatus('Wiederholt.');
}

/** Nach Rückgängig kann die Auswahl auf etwas zeigen, das es nicht mehr gibt. */
function fixSelection() {
  const selection = state.selection;
  if (!selection.file) return;
  const entry = entryByFile(selection.file);
  if (!entry?.model) {
    state.selection = entry ? { kind: 'chapter', file: entry.file } : { kind: 'course' };
    return;
  }
  if (selection.kind === 'page' && !entry.model.pages[selection.page]) state.selection = { kind: 'chapter', file: entry.file };
  if (selection.kind === 'quiz' && !entry.model.quiz) state.selection = { kind: 'chapter', file: entry.file };
}

/**
 * Wählt etwas aus (Kurs, Glossar, Kapitel, Seite, Element, Quiz) und zeichnet neu.
 * @param {Object} selection
 */
function select(selection) {
  state.selection = selection;
  if (selection.file) state.ui.expanded.add(selection.file);
  if (selection.kind === 'page' && selection.element !== undefined) state.ui.rightTab = 'properties';
  state.ui.sourceView = false;
  renderAll();
  regions.middle.querySelector('h2')?.focus();
}

/* ───────────────────────────── Zeichnen ───────────────────────────── */

function renderAll() {
  renderBar();
  regions.tree.replaceChildren(renderTree(api));
  regions.middle.replaceChildren(renderMiddle(api));
  renderSide();
  schedulePreview();
  scheduleValidation();
}

/** Kopfleiste: Kursname, Modus, ungespeicherte Dateien. */
function renderBar() {
  const changes = collectChanges();
  regions.title.textContent = state.doc?.course.meta.titel ?? 'Editor';
  regions.dirty.textContent = changes.length === 0 ? 'Alles gespeichert' : `● ${changes.length} ${changes.length === 1 ? 'Datei' : 'Dateien'} ungespeichert`;
  regions.dirty.classList.toggle('editor-bar__dirty--on', changes.length > 0);
  document.querySelector('[data-action="undo"]').disabled = state.history.past.length === 0;
  document.querySelector('[data-action="redo"]').disabled = state.history.future.length === 0;
}

/** Rechte Spalte: Reiter Eigenschaften/Vorschau. */
function renderSide() {
  const tab = state.ui.rightTab;
  for (const button of document.querySelectorAll('[data-tab]')) {
    button.setAttribute('aria-selected', String(button.dataset.tab === tab));
    button.tabIndex = button.dataset.tab === tab ? 0 : -1;
  }
  regions.properties.hidden = tab !== 'properties';
  regions.previewPanel.hidden = tab !== 'preview';
  regions.properties.replaceChildren(renderProperties(api));
}

let previewTimer = 0;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => preview?.update(state, courseModel, entryByFile), 250);
}

let validationTimer = 0;
function scheduleValidation() {
  clearTimeout(validationTimer);
  validationTimer = setTimeout(runValidation, 400);
}

/** Live-Prüfung mit validate.js plus didaktische Hinweise. */
function runValidation() {
  if (!state.doc) return;
  const selectedEntry = state.selection.file ? entryByFile(state.selection.file) : null;
  state.validation = validateCourse(courseModel(selectedEntry?.model ? selectedEntry : null), { didactic: true });
  const currentPath = selectedEntry ? chapterPath(selectedEntry) : state.selection.kind === 'glossary' ? GLOSSARY_PATH : COURSE_PATH;
  const shown = state.ui.hintsAll ? state.validation : state.validation.filter((item) => item.file === currentPath);
  const errors = state.validation.filter((item) => item.severity === 'fehler').length;

  const toggle = el('button', { type: 'button', class: 'button button--small', 'aria-pressed': String(state.ui.hintsAll) }, 'Alle Dateien');
  toggle.addEventListener('click', () => {
    state.ui.hintsAll = !state.ui.hintsAll;
    runValidation();
  });
  regions.hints.replaceChildren(
    el('div', { class: 'hints__head' }, el('h2', { class: 'hints__title' }, `Hinweise (${shown.length})`), toggle),
    el('p', { class: 'hints__summary' }, errors === 0 ? 'Keine Fehler im ganzen Kurs.' : `${errors} Fehler im ganzen Kurs.`),
    shown.length === 0
      ? el('p', { class: 'hints__empty' }, 'Keine Hinweise für diese Datei.')
      : el('ul', { class: 'hints__list' }, shown.slice(0, 80).map(renderHint)),
  );
}

function renderHint(item) {
  const label = { fehler: 'Fehler', warnung: 'Warnung', hinweis: item.kind === 'todo' ? 'Platzhalter' : 'Hinweis' }[item.severity];
  const jump = item.ref ? () => jumpTo(item.ref) : null;
  const content = [el('span', { class: `hints__badge hints__badge--${item.severity}` }, label), ' ', item.message];
  return el(
    'li',
    { class: 'hints__item' },
    jump ? el('button', { type: 'button', class: 'hints__jump', onclick: jump }, content) : el('p', {}, content),
    item.fix ? el('p', { class: 'hints__fix' }, item.fix) : null,
  );
}

/** Springt zu dem Element, auf das eine Meldung zeigt. */
function jumpTo(ref) {
  const entry = state.doc.chapters.find((candidate) => candidate.model?.id === ref.chapterId);
  if (!entry) return;
  if (ref.page === 'quiz') select({ kind: 'quiz', file: entry.file });
  else if (typeof ref.page === 'number' && ref.page >= 0) select({ kind: 'page', file: entry.file, page: ref.page, element: ref.element ?? undefined });
  else select({ kind: 'chapter', file: entry.file });
}

function setStatus(message) {
  regions.status.textContent = '';
  // Kurze Verzögerung, damit Screenreader auch eine gleichlautende Meldung erneut vorlesen.
  setTimeout(() => {
    regions.status.textContent = message;
  }, 30);
}

/* ───────────────────────────── Laden ───────────────────────────── */

/**
 * Lädt alle Inhaltsdateien über den gewählten Arbeitsbereich.
 * @param {import('./workspace.js').Workspace} workspace
 */
async function loadProject(workspace) {
  state.workspace = workspace;
  state.files = {};
  setStatus('Inhalte werden geladen …');

  const read = async (path) => {
    const file = await workspace.readFile(path);
    if (file) state.files[path] = { text: normalizeText(file.text), lastModified: file.lastModified, backedUp: false };
    return file ? normalizeText(file.text) : null;
  };

  const courseText = await read(COURSE_PATH);
  if (courseText === null) throw new Error('content/kurs.md wurde nicht gefunden.');
  const course = parseCourse(courseText);
  // canonical = Inhalt so, wie der Editor ihn schreiben würde. Eine Datei gilt nur dann als
  // geändert, wenn sich ihr INHALT ändert – nicht schon, weil sie anders formatiert ist.
  state.files[COURSE_PATH].canonical = serializeCourse({ meta: course.meta, welcome: course.welcome });
  const glossaryText = (await read(GLOSSARY_PATH)) ?? '';
  if (!state.files[GLOSSARY_PATH]) state.files[GLOSSARY_PATH] = { text: '', lastModified: null, backedUp: false };
  state.files[GLOSSARY_PATH].canonical = glossaryText ? serializeGlossary(parseGlossary(glossaryText).entries) : '';
  state.template = (await workspace.readFile(TEMPLATE_PATH))?.text ?? null;

  const chapterFiles = workspace.canList ? (await workspace.list(DIRS.kapitel)).filter((name) => name.endsWith('.md')) : [...course.meta.kapitel];
  const archiveFiles = workspace.canList ? (await workspace.list(DIRS.archiv)).filter((name) => name.endsWith('.md')) : [];
  state.imageNames = workspace.canList ? await workspace.list('assets/bilder') : [];

  const chapters = [];
  const load = async (file, location) => {
    const text = await read(`${DIRS[location]}/${file}`);
    if (text === null) return;
    const model = parseChapter(text, file, DIRS[location]);
    state.files[`${DIRS[location]}/${file}`].canonical = model.fatal ? text : serializeChapter(model);
    chapters.push({ file, location, origin: { file, location }, model: model.fatal ? null : model, brokenText: model.fatal ? text : undefined });
    state.baseline[file] = { quiz: model.quiz ? serializeElement(model.quiz) : '', version: model.meta.version };
  };
  for (const file of chapterFiles) await load(file, 'kapitel');
  for (const file of archiveFiles) await load(file, 'archiv');

  state.doc = { course: { meta: course.meta, welcome: course.welcome }, glossary: parseGlossary(glossaryText).entries, chapters };
  state.history = createHistory();
  state.selection = { kind: 'course' };

  const missing = course.meta.kapitel.filter((file) => !chapters.some((entry) => entry.file === file && entry.location === 'kapitel'));
  regions.start.hidden = true;
  regions.layout.hidden = false;
  regions.mode.textContent = workspace.mode === 'direkt' ? `Modus: Direkt (Ordner „${workspace.label}")` : 'Modus: Download (ohne Ordnerzugriff)';
  regions.mode.dataset.mode = workspace.mode;
  preview ??= createPreview(regions.previewPanel, api);
  renderAll();
  setStatus(missing.length > 0 ? `Geladen. Achtung: In kurs.md stehen Kapitel, deren Datei fehlt: ${missing.join(', ')}` : 'Inhalte geladen.');
}

/* ───────────────────────────── Speichern ───────────────────────────── */

/** Vergleichsstand einer Datei: kanonische Fassung beim Laden bzw. zuletzt gespeicherter Text. */
function baselineText(path) {
  return state.files[path]?.canonical ?? state.files[path]?.text;
}

/**
 * Ermittelt alle nötigen Dateioperationen.
 * @returns {{path: string, label: string, text?: string, blob?: Blob, from?: string, entry?: ChapterEntry}[]}
 */
function collectChanges() {
  if (!state.doc) return [];
  const changes = [];
  const courseText = serializeCourse(state.doc.course);
  if (courseText !== baselineText(COURSE_PATH)) changes.push({ path: COURSE_PATH, label: 'Kurseinstellungen', text: courseText });
  const glossaryText = serializeGlossary(state.doc.glossary);
  if (glossaryText !== (baselineText(GLOSSARY_PATH) ?? '') && !(glossaryText === '\n' && !baselineText(GLOSSARY_PATH))) {
    changes.push({ path: GLOSSARY_PATH, label: 'Glossar', text: glossaryText });
  }
  for (const entry of state.doc.chapters) {
    const path = chapterPath(entry);
    const from = entry.origin ? chapterPath(entry.origin) : null;
    const text = entry.model ? serializeChapter(entry.model) : entry.brokenText;
    const original = from ? baselineText(from) : null;
    if (from === null || from !== path || text !== original) {
      changes.push({ path, from, text, entry, label: entry.model?.meta.titel ?? entry.file });
    }
  }
  for (const [path, asset] of state.pendingAssets) changes.push({ path, label: 'Bild', blob: asset.blob });
  return changes;
}

async function save() {
  const changes = collectChanges();
  if (changes.length === 0) return setStatus('Keine ungespeicherten Änderungen.');
  runValidation();
  const errors = state.validation.filter((item) => item.severity === 'fehler').length;
  if (errors > 0) {
    const proceed = await confirmDialog({
      title: 'Trotzdem speichern?',
      text: `Die Prüfung meldet ${errors} Fehler. Du kannst trotzdem speichern – es geht nichts verloren. Im Kurs funktionieren die betroffenen Stellen aber erst, wenn die Fehler behoben sind.`,
      confirmLabel: 'Trotzdem speichern',
    });
    if (!proceed) return;
  }
  if (state.workspace.mode === 'direkt') await saveDirect(changes);
  else await saveDownload(changes);
  renderAll();
}

/** Direktmodus: Konflikte prüfen, Sicherungskopie anlegen, schreiben/verschieben. */
async function saveDirect(changes) {
  const workspace = state.workspace;
  const saved = [];
  for (const change of changes) {
    try {
      const source = change.from === undefined ? change.path : change.from;
      if (source && state.files[source]) {
        // Konfliktprüfung: Wurde die Datei seit dem Öffnen außerhalb des Editors geändert?
        const onDisk = await workspace.readFile(source);
        if (onDisk && state.files[source].lastModified !== null && onDisk.lastModified !== state.files[source].lastModified) {
          const overwrite = await confirmDialog({
            title: 'Datei wurde außerhalb geändert',
            text: `„${source}" wurde geändert, seit du den Editor geöffnet hast (z. B. in einem Texteditor). Wenn du überschreibst, landet die andere Fassung als Sicherungskopie in content/_backup/.`,
            confirmLabel: 'Überschreiben',
            cancelLabel: 'Diese Datei auslassen',
            danger: true,
          });
          if (!overwrite) continue;
          state.files[source].backedUp = false;
        }
        // Beim ersten Speichern pro Sitzung: bisherige Fassung sichern.
        if (onDisk && !state.files[source].backedUp) {
          await workspace.writeText(backupPath(source), onDisk.text);
          state.files[source].backedUp = true;
        }
        if (change.from && change.from !== change.path) await workspace.move(change.from, change.path);
      }
      if (change.blob) await workspace.writeBlob(change.path, change.blob);
      else await workspace.writeText(change.path, change.text);
      const lastModified = await workspace.lastModified(change.path);
      state.files[change.path] = { text: change.text ?? '', lastModified, backedUp: true };
      if (change.from && change.from !== change.path) delete state.files[change.from];
      if (change.entry) change.entry.origin = { file: change.entry.file, location: change.entry.location };
      if (change.blob) state.pendingAssets.delete(change.path);
      saved.push(change.path.split('/').pop());
    } catch (error) {
      setStatus(`Fehler beim Speichern von ${change.path}: ${error.message}`);
      return;
    }
  }
  setStatus(saved.length > 0 ? `Gespeichert: ${saved.join(', ')}. Sicherungskopien liegen in content/_backup/.` : 'Nichts gespeichert.');
}

/** Download-Modus: Dateien zum Herunterladen anbieten, mit Zielordner. */
async function saveDownload(changes) {
  const id = 'save-dialog-title';
  const rows = changes.map((change) => {
    const name = change.path.split('/').pop();
    const folder = change.path.split('/').slice(0, -1).join('/');
    const button = el('button', { type: 'button', class: 'button button--small' }, 'Herunterladen');
    button.addEventListener('click', () => {
      downloadBlob(name, change.blob ?? new Blob([change.text], { type: 'text/markdown;charset=utf-8' }));
      button.textContent = 'Heruntergeladen ✓';
    });
    const moveNote = change.from && change.from !== change.path ? el('p', { class: 'field__hint' }, `Danach die alte Datei „${change.from}" löschen bzw. verschieben (der Editor kann das ohne Ordnerzugriff nicht).`) : null;
    return el('li', { class: 'save-list__item' }, el('p', {}, el('strong', {}, name), ` → in den Ordner `, el('code', {}, `${folder}/`)), moveNote, button);
  });
  const done = await openDialog(
    (close) => [
      el('h2', { id }, 'Dateien herunterladen'),
      el('p', {}, 'Ohne Ordnerzugriff kann der Editor nicht direkt speichern. Lade jede Datei herunter und lege sie in den angegebenen Ordner im Projekt (vorhandene Datei ersetzen).'),
      el('ul', { class: 'save-list' }, rows),
      el(
        'div',
        { class: 'dialog__actions' },
        el('button', { type: 'button', class: 'button', onclick: () => close(false) }, 'Später'),
        el('button', { type: 'button', class: 'button button--primary', onclick: () => close(true) }, 'Erledigt – alle Dateien abgelegt'),
      ),
    ],
    id,
  );
  if (!done) return setStatus('Nicht gespeichert. Deine Änderungen sind noch da.');
  for (const change of changes) {
    state.files[change.path] = { text: change.text ?? '', lastModified: null, backedUp: true };
    if (change.from && change.from !== change.path) delete state.files[change.from];
    if (change.entry) change.entry.origin = { file: change.entry.file, location: change.entry.location };
    if (change.blob) state.pendingAssets.delete(change.path);
  }
  setStatus('Als gespeichert markiert. Lade den Kurs neu, um die Änderungen zu sehen.');
}

/* ───────────────────────────── Kapitel- und Seitenoperationen ───────────────────────────── */

const operations = {
  async newChapter() {
    if (!state.template) return setStatus('Die Vorlage content/_vorlage-kapitel.md fehlt – ohne sie kann kein Kapitel angelegt werden.');
    const title = await promptDialog({ title: 'Neues Kapitel', label: 'Titel des Kapitels', hint: 'Daraus entsteht automatisch der Dateiname, z. B. 07-boxengasse-regeln.md.', confirmLabel: 'Kapitel anlegen' });
    if (!title) return;
    const file = chapterFileName(title, allChapterFiles());
    const model = parseChapter(state.template, file);
    model.meta.titel = title;
    model.meta.kurztitel = title.length > 22 ? `${title.slice(0, 20)}…` : title;
    commit((doc) => {
      doc.chapters.push({ file, location: 'kapitel', origin: null, model });
      doc.course.meta.kapitel.push(file);
    });
    select({ kind: 'chapter', file });
    setStatus(`Kapitel „${title}" angelegt (${file}). Speichern nicht vergessen.`);
  },

  async renameFile(file) {
    const entry = entryByFile(file);
    const prefix = file.match(/^(\d+)-/)?.[1];
    const base = `${prefix ? `${prefix}-` : ''}${slugify(entry.model.meta.titel) || 'kapitel'}`;
    const others = allChapterFiles().filter((name) => name !== file);
    const newFile = uniqueName(base, 'md', others);
    if (newFile === file) return setStatus('Der Dateiname passt schon zum Titel.');
    const ok = await confirmDialog({
      title: 'Datei umbenennen?',
      text: `„${file}" wird zu „${newFile}". kurs.md wird automatisch angepasst. Achtung: Wer das Kapitel schon bestanden hat, muss es danach erneut abschließen (der Fortschritt hängt am Dateinamen).`,
      confirmLabel: 'Umbenennen',
    });
    if (!ok) return;
    commit((doc) => {
      const target = doc.chapters.find((candidate) => candidate.file === file);
      target.file = newFile;
      target.model.file = newFile;
      target.model.id = newFile.replace(/\.md$/, '');
      target.model.path = chapterPath(target);
      doc.course.meta.kapitel = doc.course.meta.kapitel.map((name) => (name === file ? newFile : name));
    });
    state.baseline[newFile] = state.baseline[file];
    state.ui.expanded.add(newFile);
    select({ kind: 'chapter', file: newFile });
  },

  duplicateChapter(file) {
    const source = entryByFile(file);
    const title = `${source.model.meta.titel} (Kopie)`;
    const newFile = chapterFileName(title, allChapterFiles());
    commit((doc) => {
      const model = structuredClone(source.model);
      Object.assign(model, { file: newFile, id: newFile.replace(/\.md$/, ''), path: `${DIRS.kapitel}/${newFile}` });
      model.meta.titel = title;
      model.meta.version = 1;
      doc.chapters.push({ file: newFile, location: 'kapitel', origin: null, model });
      const list = doc.course.meta.kapitel;
      const index = list.indexOf(file);
      list.splice(index === -1 ? list.length : index + 1, 0, newFile);
    });
    select({ kind: 'chapter', file: newFile });
  },

  moveChapter(file, delta) {
    const list = state.doc.course.meta.kapitel;
    const index = list.indexOf(file);
    const target = index + delta;
    if (index === -1 || target < 0 || target >= list.length) return;
    commit((doc) => {
      const items = doc.course.meta.kapitel;
      [items[index], items[target]] = [items[target], items[index]];
    });
    setStatus(`Kapitel ist jetzt an Position ${target + 1}.`);
  },

  moveChapterTo(file, targetIndex) {
    const list = state.doc.course.meta.kapitel;
    const index = list.indexOf(file);
    if (index === -1 || index === targetIndex) return;
    commit((doc) => {
      const items = doc.course.meta.kapitel;
      items.splice(index, 1);
      items.splice(Math.min(targetIndex, items.length), 0, file);
    });
  },

  deactivate(file) {
    commit((doc) => {
      doc.course.meta.kapitel = doc.course.meta.kapitel.filter((name) => name !== file);
    });
    setStatus('Kapitel deaktiviert. Die Datei bleibt erhalten; du findest sie unter „Inaktiv".');
  },

  activate(file) {
    commit((doc) => {
      if (!doc.course.meta.kapitel.includes(file)) doc.course.meta.kapitel.push(file);
    });
    setStatus('Kapitel aktiviert und ans Ende der Liste gesetzt.');
  },

  async archive(file) {
    const ok = await confirmDialog({
      title: 'Kapitel archivieren?',
      text: state.workspace.canMove
        ? 'Das Kapitel verschwindet aus dem Kurs und wird beim Speichern nach content/_archiv/ verschoben. Es lässt sich jederzeit wiederherstellen.'
        : 'Das Kapitel verschwindet aus dem Kurs. Ohne Ordnerzugriff musst du die Datei nach dem Speichern selbst nach content/_archiv/ verschieben.',
      confirmLabel: 'Archivieren',
    });
    if (!ok) return;
    commit((doc) => {
      doc.course.meta.kapitel = doc.course.meta.kapitel.filter((name) => name !== file);
      const entry = doc.chapters.find((candidate) => candidate.file === file);
      entry.location = 'archiv';
      if (entry.model) entry.model.path = chapterPath(entry);
    });
    select({ kind: 'course' });
    setStatus('Kapitel archiviert (wird beim Speichern verschoben).');
  },

  restore(file) {
    commit((doc) => {
      const entry = doc.chapters.find((candidate) => candidate.file === file);
      entry.location = 'kapitel';
      if (entry.model) entry.model.path = chapterPath(entry);
    });
    setStatus('Kapitel wiederhergestellt. Es ist noch inaktiv – mit „Aktivieren" kommt es zurück in den Kurs.');
  },

  async addPage(file, afterIndex) {
    const title = await promptDialog({ title: 'Neue Seite', label: 'Titel der Seite', confirmLabel: 'Seite anlegen' });
    if (!title) return;
    const index = afterIndex + 1;
    commit((doc) => {
      doc.chapters.find((entry) => entry.file === file).model.pages.splice(index, 0, { title, elements: [], line: 0 });
    }, { chapter: file });
    select({ kind: 'page', file, page: index });
  },

  async removePage(file, pageIndex) {
    const page = entryByFile(file).model.pages[pageIndex];
    const ok = await confirmDialog({ title: 'Seite entfernen?', text: `Die Seite „${page.title}" mit ${page.elements.length} Element(en) wird entfernt. Mit „Rückgängig" (Strg/Cmd+Z) holst du sie zurück, solange der Editor offen ist.`, confirmLabel: 'Seite entfernen', danger: true });
    if (!ok) return;
    commit((doc) => {
      doc.chapters.find((entry) => entry.file === file).model.pages.splice(pageIndex, 1);
    }, { chapter: file });
    select({ kind: 'chapter', file });
  },

  createQuiz(file) {
    commit((doc) => {
      const model = doc.chapters.find((entry) => entry.file === file).model;
      model.quiz = { type: 'block', name: 'quiz', data: getBlock('quiz').editor.createDefault(), line: 0 };
    }, { chapter: file });
    select({ kind: 'quiz', file });
  },

  openInCourse(file, page = 1) {
    const model = entryByFile(file)?.model;
    if (!model) return;
    window.open(`index.html#/kapitel/${encodeURIComponent(model.id)}/${page}`, '_blank', 'noopener');
    if (collectChanges().length > 0) setStatus('Hinweis: Der Kurs zeigt den gespeicherten Stand. Speichere zuerst, um deine Änderungen dort zu sehen.');
  },
};

/* ───────────────────────────── Bilder und Glossar ───────────────────────────── */

async function pickImage() {
  const result = await importImage(api);
  if (!result) return null;
  if (result.blob) {
    state.pendingAssets.set(result.path, { blob: result.blob, url: URL.createObjectURL(result.blob) });
  }
  state.imageNames.push(result.path.split('/').pop());
  renderBar();
  return result.path;
}

/** Pfad → anzeigbare Adresse (für Bilder, die im Download-Modus noch nicht abgelegt sind). */
function imageUrl(path) {
  return state.pendingAssets.get(path)?.url ?? path;
}

/**
 * Glossarbegriff wählen – mit Autovervollständigung. Unbekannte Begriffe können direkt im
 * Glossar angelegt werden.
 * @returns {Promise<string|null>}
 */
async function pickGlossaryTerm() {
  const id = 'glossary-pick-title';
  const terms = state.doc.glossary.filter((entry) => 'term' in entry).map((entry) => entry.term).sort((a, b) => a.localeCompare(b, 'de'));
  return openDialog((close) => {
    const input = el('input', { type: 'text', id: 'glossary-pick', list: 'glossary-pick-list', class: 'field__input', autofocus: true, autocomplete: 'off' });
    const text = el('textarea', { id: 'glossary-pick-text', rows: 3, class: 'field__input' });
    const newArea = el('div', { class: 'field', hidden: true }, el('label', { for: 'glossary-pick-text' }, 'Neu im Glossar – Erklärung in ein bis zwei Sätzen'), text);
    input.addEventListener('input', () => {
      newArea.hidden = input.value.trim() === '' || Boolean(findGlossaryEntry(state.doc.glossary, input.value));
    });
    const form = el(
      'form',
      { class: 'stack' },
      el('div', { class: 'field' }, el('label', { for: 'glossary-pick' }, 'Begriff'), el('p', { class: 'field__hint' }, 'Tippe, um vorhandene Begriffe vorgeschlagen zu bekommen.'), input, el('datalist', { id: 'glossary-pick-list' }, terms.map((term) => el('option', { value: term })))),
      newArea,
      el('div', { class: 'dialog__actions' }, el('button', { type: 'button', class: 'button', onclick: () => close(null) }, 'Abbrechen'), el('button', { type: 'submit', class: 'button button--primary' }, 'Einfügen')),
    );
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const term = input.value.trim();
      if (!term) return input.focus();
      const existing = findGlossaryEntry(state.doc.glossary, term);
      if (!existing) {
        // source 'forms': das Textfeld, in das gleich [[Begriff]] eingefügt wird, bleibt bestehen.
        commit((doc) => doc.glossary.push({ term, text: text.value.trim(), line: 0 }), { source: 'forms' });
        setStatus(`„${term}" wurde im Glossar angelegt${text.value.trim() ? '' : ' – die Erklärung fehlt noch'}.`);
      }
      close(existing?.term ?? term);
    });
    return [el('h2', { id }, 'Glossarbegriff einfügen'), form];
  }, id);
}

/* ───────────────────────────── Öffentliche Schnittstelle für die Teilmodule ───────────────────────────── */

/**
 * Was course-tree.js, page-canvas.js usw. vom Editor benutzen dürfen.
 */
const api = {
  get state() {
    return state;
  },
  commit,
  select,
  setStatus,
  confirm: confirmDialog,
  prompt: promptDialog,
  pickImage,
  pickGlossaryTerm,
  imageUrl,
  entryByFile,
  activeEntries,
  inactiveEntries,
  archivedEntries,
  chapterPath,
  courseModel,
  collectChanges,
  operations,
  renderSide,
  rerenderMiddle: () => rerenderKeepingFocus(regions.middle, () => renderMiddle(api)),
  rerenderProperties: () => rerenderKeepingFocus(regions.properties, () => renderProperties(api)),
  schedulePreview,
};

/* ───────────────────────────── Start ───────────────────────────── */

/** Startbildschirm: Ordner wählen oder Download-Modus. */
async function showStart() {
  const directPossible = supportsDirectAccess();
  const area = /** @type {HTMLElement} */ (regions.start.querySelector('[data-start-actions]'));
  const info = /** @type {HTMLElement} */ (regions.start.querySelector('[data-start-info]'));
  const error = /** @type {HTMLElement} */ (regions.start.querySelector('[data-start-error]'));

  const run = async (task) => {
    error.hidden = true;
    try {
      await task();
    } catch (problem) {
      if (problem?.name === 'AbortError') return; // Auswahl abgebrochen
      error.hidden = false;
      error.textContent = problem.message;
    }
  };

  const buttons = [];
  if (directPossible) {
    const remembered = await restoreDirectory(false).catch(() => ({ workspace: null, needsPermission: false, name: '' }));
    if (remembered.workspace) {
      await run(() => loadProject(remembered.workspace));
      return;
    }
    if (remembered.needsPermission) {
      buttons.push(el('button', { type: 'button', class: 'button button--primary button--large', onclick: () => run(async () => {
        const again = await restoreDirectory(true);
        if (!again.workspace) throw new Error('Der Zugriff wurde nicht erlaubt. Wähle den Ordner neu.');
        await loadProject(again.workspace);
      }) }, `Mit Ordner „${remembered.name}" weiterarbeiten`));
    }
    buttons.push(el('button', { type: 'button', class: `button button--large${remembered.needsPermission ? '' : ' button--primary'}`, onclick: () => run(async () => {
      await forgetDirectory().catch(() => {});
      await loadProject(await openDirectory());
    }) }, 'Projektordner öffnen'));
    info.textContent = 'Empfohlen: Öffne den Ordner „onboarding". Dann speichert der Editor direkt in die Dateien und legt Sicherungskopien an.';
  } else {
    info.textContent = window.isSecureContext
      ? 'Dieser Browser kann nicht direkt in Ordner speichern (z. B. Firefox oder Safari). Du kannst trotzdem arbeiten: Beim Speichern lädst du die geänderten Dateien herunter. Am bequemsten ist der Editor in Chrome oder Edge.'
      : 'Der Editor ist nicht über das Startskript (localhost) geöffnet. Direktes Speichern ist deshalb nicht möglich – nur der Download-Modus. Tipp: editor.html gehört nicht auf den öffentlichen Webspace.';
  }
  buttons.push(el('button', { type: 'button', class: `button button--large${directPossible ? '' : ' button--primary'}`, onclick: () => run(() => loadProject(createDownloadWorkspace())) }, 'Ohne Ordnerzugriff arbeiten (Download-Modus)'));
  area.replaceChildren(...buttons);
}

function setupChrome() {
  document.querySelector('[data-action="undo"]').addEventListener('click', undo);
  document.querySelector('[data-action="redo"]').addEventListener('click', redo);
  document.querySelector('[data-action="save"]').addEventListener('click', save);

  // Reiter Eigenschaften/Vorschau (WAI-ARIA-Muster „Tabs", Pfeiltasten wechseln).
  const tabs = [...document.querySelectorAll('[data-tab]')];
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      state.ui.rightTab = tab.dataset.tab;
      renderSide();
      schedulePreview();
    });
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const next = tabs[(tabs.indexOf(tab) + 1) % tabs.length];
      state.ui.rightTab = next.dataset.tab;
      renderSide();
      schedulePreview();
      next.focus();
    });
  }

  // Tastenkürzel: Strg/Cmd+Z, Strg/Cmd+Umschalt+Z (oder Strg+Y), Strg/Cmd+S.
  document.addEventListener('keydown', (event) => {
    if (!state.doc || !(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      undo();
    } else if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault();
      redo();
    } else if (key === 's') {
      event.preventDefault();
      save();
    }
  });

  // Warnung beim Verlassen mit ungespeicherten Änderungen.
  window.addEventListener('beforeunload', (event) => {
    if (collectChanges().length > 0) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  // Editor folgt dem gespeicherten Theme des Kurses (nur Darstellung des Editors selbst).
  try {
    const stored = JSON.parse(localStorage.getItem('em-onboarding:v1') ?? 'null');
    if (stored?.theme) applyTheme(stored.theme);
  } catch {
    // ohne Speicherzugriff: Systemeinstellung
  }
}

setupChrome();
showStart();
