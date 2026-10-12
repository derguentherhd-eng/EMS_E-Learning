/*
 * page-canvas.js – mittlere Spalte des Editors und die Formulare der rechten Spalte
 *
 * Mittlere Spalte, je nach Auswahl in der Kursstruktur:
 *   Kurseinstellungen · Glossar (glossary-editor.js) · Kapitelübersicht (Kopfbereich,
 *   Seitenliste, Kapitel-Aktionen) · Seite (Baukasten mit Elementen) · Quiz (quiz-editor.js)
 *
 * Baukasten einer Seite: Jedes Element ist eine Karte mit ↑ ↓ (verschieben), Duplizieren,
 * Entfernen und Auf-/Zuklappen. Zwischen den Karten fügt „+ Element einfügen" über die
 * Palette Neues ein. Die Palette enthält Textabschnitt, Bild und ALLE Bausteine aus
 * registry.js – ein neuer Baustein erscheint dort automatisch.
 *
 * Quelltext: Jede Seite lässt sich als Kursdown-Text bearbeiten. Beim Zurückschalten wird der
 * Text neu eingelesen. Was nicht lesbar ist, bleibt als „Nicht lesbarer Abschnitt" erhalten –
 * der Editor verwirft nie Inhalte.
 *
 * Rechte Spalte (renderProperties): Formular des ausgewählten Elements, gebaut aus dem
 * Schema des Bausteins (field-renderers.js).
 *
 * Wenn du hier etwas ändern willst …
 *   – Felder der Kurseinstellungen: COURSE_FIELDS. Felder des Kapitelkopfs: CHAPTER_FIELDS.
 */

import { el } from '../dom.js';
import { getBlock, listBlocks } from '../blocks/registry.js';
import { parseBody, isSafetyChapter } from '../content/documents.js';
import { serializeElement } from '../content/serialize.js';
import { countWords } from '../content/markdown.js';
import { openDialog } from './dialogs.js';
import { renderFields, renderMarkdownField } from './field-renderers.js';
import { renderQuizEditor, quizChanged, versionNotice } from './quiz-editor.js';
import { renderGlossaryEditor } from './glossary-editor.js';
import { renderHotspotEditor } from './hotspot-editor.js';

const COURSE_FIELDS = [
  { key: 'titel', type: 'text', label: 'Kurstitel', required: true },
  { key: 'team', type: 'text', label: 'Team' },
  { key: 'kursversion', type: 'text', label: 'Kursversion', required: true, help: 'Erhöhen (z. B. 1.0 → 1.1), wenn sich der Kurs grundlegend ändert. Wer das Qualifying mit einer älteren Version bestanden hat, muss es dann neu machen.' },
  { key: 'bestehensgrenze', type: 'number', label: 'Bestehensgrenze in Prozent', min: 1, max: 100 },
  { key: 'qualifying-fragen', type: 'number', label: 'Anzahl Fragen im Qualifying', min: 1, max: 50 },
  { key: 'zertifikat-titel', type: 'text', label: 'Titel auf dem Zertifikat' },
  { key: 'zertifikat-unterschrift-name', type: 'text', label: 'Unterschrift: Name' },
  { key: 'zertifikat-unterschrift-rolle', type: 'text', label: 'Unterschrift: Rolle' },
  { key: 'logo', type: 'image', label: 'Logo (SVG empfohlen)' },
];

const CHAPTER_FIELDS = [
  { key: 'titel', type: 'text', label: 'Titel', required: true },
  { key: 'kurztitel', type: 'text', label: 'Kurztitel (Sektoranzeige)', required: true, help: 'Höchstens ca. 20 Zeichen.' },
  { key: 'dauer', type: 'number', label: 'Dauer in Minuten', min: 1, max: 120, required: true },
  { key: 'version', type: 'number', label: 'Version', min: 1, required: true, help: 'Erhöhen, wenn sich das Quiz ändert – dann müssen alle das Quiz neu machen.' },
  { key: 'bestehensgrenze', type: 'number', label: 'Eigene Bestehensgrenze (optional)', min: 1, max: 100, help: 'Leer lassen = Wert aus den Kurseinstellungen.' },
  { key: 'lernziele', type: 'list', label: 'Lernziele', itemLabel: 'Lernziel', itemFields: [{ key: 'value', type: 'text', label: 'Lernziel' }] },
];

const IMAGE_FIELDS = [
  { key: 'src', type: 'image', label: 'Bild', required: true },
  { key: 'alt', type: 'text', label: 'Alternativtext (was ist zu sehen?)', required: true, help: 'Pflicht. Menschen mit Screenreader hören diesen Text statt das Bild zu sehen.' },
  { key: 'caption', type: 'text', label: 'Bildunterschrift (optional)' },
];

/** Lesetempo für die Schätzung (Wörter pro Minute) und Zeit je Interaktion. */
const WORDS_PER_MINUTE = 180;
const MINUTES_PER_INTERACTION = 0.75;

/* ───────────────────────────── Mittlere Spalte ───────────────────────────── */

/**
 * @param {Object} editor
 * @returns {HTMLElement}
 */
export function renderMiddle(editor) {
  const { state } = editor;
  const selection = state.selection;
  if (selection.kind === 'course') return renderCourseSettings(editor);
  if (selection.kind === 'glossary') return renderGlossaryEditor(editor);
  const entry = editor.entryByFile(selection.file);
  if (!entry) return el('p', {}, 'Nichts ausgewählt.');
  if (!entry.model) return renderBroken(entry);
  if (selection.kind === 'quiz') return renderQuizEditor(editor, entry);
  if (selection.kind === 'page') return renderPage(editor, entry, selection.page);
  return renderChapterOverview(editor, entry);
}

/** Formular-Kontext für Felder in der mittleren Spalte. */
function middleContext(editor, idPrefix, chapterFile = null) {
  return {
    idPrefix,
    change: (mutate, options = {}) => editor.commit(mutate, { source: 'middle', coalesce: options.key, structural: options.structural, chapter: chapterFile }),
    pickImage: editor.pickImage,
    pickGlossaryTerm: editor.pickGlossaryTerm,
    imageUrl: editor.imageUrl,
  };
}

function renderCourseSettings(editor) {
  const course = editor.state.doc.course;
  const context = middleContext(editor, 'kurs');
  return el(
    'section',
    { class: 'canvas stack' },
    el('h2', { class: 'editor-column__title', tabindex: -1 }, 'Kurseinstellungen'),
    el('p', { class: 'canvas__info' }, 'Datei: content/kurs.md'),
    el('div', { class: 'form-grid' }, renderFields(COURSE_FIELDS, course.meta, context)),
    renderMarkdownField({
      id: 'kurs-willkommen',
      label: el('label', { for: 'kurs-willkommen' }, 'Willkommenstext auf der Startseite'),
      hint: null,
      hintId: null,
      value: course.welcome,
      set: (value) => context.change(() => { course.welcome = value; }, { key: 'kurs-willkommen' }),
      context,
    }),
  );
}

function renderBroken(entry) {
  return el(
    'section',
    { class: 'canvas stack' },
    el('h2', { class: 'editor-column__title', tabindex: -1 }, `${entry.file} – nicht lesbar`),
    el('p', { class: 'notice notice--error' }, 'Der Kopfbereich dieser Datei ist kaputt (z. B. fehlt die abschließende Zeile ---). Damit nichts verloren geht, öffnet der Editor sie nicht. Bitte in einem Texteditor reparieren – die Prüfseite zeigt die genaue Zeile.'),
    el('pre', { class: 'canvas__source' }, entry.brokenText ?? ''),
  );
}

/** Geschätzte Lesedauer in Minuten (Wörter + Interaktionen). */
function estimateMinutes(elements) {
  let words = 0;
  let interactions = 0;
  for (const element of elements) {
    if (element.type === 'text') words += countWords(element.markdown);
    if (element.type === 'block') {
      words += countWords(JSON.stringify(element.data).replace(/["{}[\],:]/g, ' '));
      if (getBlock(element.name)?.interactive) interactions += 1;
    }
  }
  return { words, minutes: words / WORDS_PER_MINUTE + interactions * MINUTES_PER_INTERACTION };
}

function renderChapterOverview(editor, entry) {
  const model = entry.model;
  const { operations, state } = editor;
  const file = entry.file;
  const context = middleContext(editor, `kapitel-${model.id}`, file);
  const isActive = state.doc.course.meta.kapitel.includes(file);
  const total = model.pages.reduce((sum, page) => sum + estimateMinutes(page.elements).minutes, 0) + (model.quiz ? model.quiz.data.questions.length * 0.4 : 0);
  const location = entry.location === 'archiv' ? 'archiviert' : isActive ? 'aktiv im Kurs' : 'inaktiv (nicht im Kurs)';

  const actions = el(
    'div',
    { class: 'canvas__actions' },
    el('button', { type: 'button', class: 'button button--small', onclick: () => operations.openInCourse(file) }, 'Im Kurs testen'),
    el('button', { type: 'button', class: 'button button--small', onclick: () => operations.renameFile(file) }, 'Dateiname an Titel anpassen'),
    el('button', { type: 'button', class: 'button button--small', onclick: () => operations.duplicateChapter(file) }, 'Duplizieren'),
    entry.location === 'kapitel'
      ? isActive
        ? el('button', { type: 'button', class: 'button button--small', onclick: () => operations.deactivate(file) }, 'Deaktivieren')
        : el('button', { type: 'button', class: 'button button--small', onclick: () => operations.activate(file) }, 'Aktivieren')
      : null,
    entry.location === 'kapitel'
      ? el('button', { type: 'button', class: 'button button--small', onclick: () => operations.archive(file) }, 'Archivieren')
      : el('button', { type: 'button', class: 'button button--small', onclick: () => operations.restore(file) }, 'Wiederherstellen'),
  );

  // Sicherheitskapitel: Feld „freigegeben" an-/abschalten und setzen.
  const safety = isSafetyChapter(model);
  const safetyToggle = el('input', { type: 'checkbox', id: `${model.id}-safety`, checked: safety });
  safetyToggle.addEventListener('change', () =>
    editor.commit(() => {
      if (safetyToggle.checked) model.meta.freigegeben = 'nein';
      else delete model.meta.freigegeben;
    }, { releaseField: true, chapter: file }),
  );
  const releaseSelect = el('select', { id: `${model.id}-release`, class: 'field__input' }, ['nein', 'ja'].map((value) => el('option', { value, selected: String(model.meta.freigegeben) === value }, value)));
  releaseSelect.addEventListener('change', () => editor.commit(() => { model.meta.freigegeben = releaseSelect.value; }, { releaseField: true, chapter: file, source: 'middle' }));

  const pages = el(
    'ol',
    { class: 'page-list' },
    model.pages.map((page, index) => {
      const item = el(
        'li',
        { class: 'page-list__item', draggable: 'true' },
        el('button', { type: 'button', class: 'page-list__open', onclick: () => editor.select({ kind: 'page', file, page: index }) }, `${index + 1}. ${page.title || '(ohne Titel)'}`),
        el('span', { class: 'page-list__meta' }, `${page.elements.length} Element(e) · ca. ${Math.max(1, Math.round(estimateMinutes(page.elements).minutes))} min`),
        el('span', { class: 'page-list__actions' },
          el('button', { type: 'button', class: 'button button--small', disabled: index === 0, 'aria-label': `Seite „${page.title}" nach oben`, onclick: () => movePage(editor, file, index, -1) }, '↑'),
          el('button', { type: 'button', class: 'button button--small', disabled: index === model.pages.length - 1, 'aria-label': `Seite „${page.title}" nach unten`, onclick: () => movePage(editor, file, index, 1) }, '↓'),
          el('button', { type: 'button', class: 'button button--small', 'aria-label': `Seite „${page.title}" duplizieren`, onclick: () => duplicatePage(editor, file, index) }, 'Duplizieren'),
          el('button', { type: 'button', class: 'button button--small', 'aria-label': `Seite „${page.title}" entfernen`, onclick: () => operations.removePage(file, index) }, 'Entfernen'),
        ),
      );
      addDrag(item, 'text/x-page', index, (from) => movePageTo(editor, file, from, index));
      return item;
    }),
  );

  return el(
    'section',
    { class: 'canvas stack' },
    el('h2', { class: 'editor-column__title', tabindex: -1 }, model.meta.titel || file),
    el('p', { class: 'canvas__info' }, `Datei: ${editor.chapterPath(entry)} · ${location}`),
    el('p', { class: `canvas__info${Math.abs(total - Number(model.meta.dauer)) > Number(model.meta.dauer) * 0.4 ? ' canvas__info--warn' : ''}` }, `Geschätzte Dauer: ca. ${Math.max(1, Math.round(total))} min · angegeben: ${model.meta.dauer ?? '–'} min`),
    actions,
    quizChanged(editor, entry) ? versionNotice(editor, entry) : null,
    el('h3', { class: 'canvas__heading' }, 'Kopfbereich'),
    el('div', { class: 'form-grid' }, renderFields(CHAPTER_FIELDS, model.meta, context)),
    el('div', { class: 'field field--inline' }, safetyToggle, el('label', { for: `${model.id}-safety` }, 'Enthält Sicherheitsinhalte (Freigabe durch die Werkstattleitung nötig)')),
    safety
      ? el('div', { class: 'field' }, el('label', { for: `${model.id}-release` }, 'Freigegeben'), el('p', { class: 'field__hint' }, 'Nur auf „ja" setzen, wenn die Werkstattleitung die aktuelle Fassung geprüft hat. Jede spätere Änderung setzt den Wert automatisch auf „nein".'), releaseSelect)
      : null,
    el('h3', { class: 'canvas__heading' }, `Seiten (${model.pages.length})`),
    pages,
    el('button', { type: 'button', class: 'button button--small', onclick: () => operations.addPage(file, model.pages.length - 1) }, '+ Seite hinzufügen'),
    el('h3', { class: 'canvas__heading' }, 'Quiz'),
    model.quiz
      ? el('button', { type: 'button', class: 'button button--small', onclick: () => editor.select({ kind: 'quiz', file }) }, `Quiz bearbeiten (${model.quiz.data.questions.length} Fragen)`)
      : el('button', { type: 'button', class: 'button button--small', onclick: () => operations.createQuiz(file) }, '+ Quiz anlegen'),
  );
}

function movePage(editor, file, index, delta) {
  editor.commit((doc) => {
    const pages = doc.chapters.find((entry) => entry.file === file).model.pages;
    [pages[index], pages[index + delta]] = [pages[index + delta], pages[index]];
  }, { chapter: file });
  editor.setStatus(`Seite ist jetzt an Position ${index + delta + 1}.`);
}

function movePageTo(editor, file, from, to) {
  if (from === to) return;
  editor.commit((doc) => {
    const pages = doc.chapters.find((entry) => entry.file === file).model.pages;
    const [page] = pages.splice(from, 1);
    pages.splice(to, 0, page);
  }, { chapter: file });
}

function duplicatePage(editor, file, index) {
  editor.commit((doc) => {
    const pages = doc.chapters.find((entry) => entry.file === file).model.pages;
    const copy = structuredClone(pages[index]);
    copy.title = `${copy.title} (Kopie)`;
    pages.splice(index + 1, 0, copy);
  }, { chapter: file });
  editor.select({ kind: 'page', file, page: index + 1 });
}

/* ───────────────────────────── Seite (Baukasten) ───────────────────────────── */

function renderPage(editor, entry, pageIndex) {
  const { state } = editor;
  const model = entry.model;
  const page = model.pages[pageIndex];
  const file = entry.file;
  const estimate = estimateMinutes(page.elements);

  const titleInput = el('input', { type: 'text', id: `page-title-${model.id}-${pageIndex}`, value: page.title, class: 'field__input' });
  titleInput.addEventListener('input', () => editor.commit(() => { page.title = titleInput.value; }, { source: 'middle', coalesce: titleInput.id, chapter: file }));

  const sourceToggle = el('button', { type: 'button', class: 'button button--small', 'aria-pressed': String(state.ui.sourceView) }, state.ui.sourceView ? 'Zurück zum Baukasten' : 'Quelltext anzeigen');

  let body;
  if (state.ui.sourceView) {
    const textarea = el('textarea', { id: 'page-source', class: 'field__input field__textarea canvas__source-input', rows: 24, spellcheck: 'false' }, pageSource(page));
    const problems = el('div', { role: 'status' });
    sourceToggle.addEventListener('click', () => {
      const result = applySource(editor, entry, pageIndex, textarea.value);
      if (!result.ok) {
        problems.replaceChildren(el('p', { class: 'notice notice--error' }, result.message));
        return;
      }
      state.ui.sourceView = false;
      editor.rerenderMiddle();
    });
    body = el('div', { class: 'field' }, el('label', { for: 'page-source' }, 'Kursdown-Quelltext dieser Seite'), el('p', { class: 'field__hint' }, 'Beim Zurückschalten wird der Text neu eingelesen. Nicht lesbare Abschnitte bleiben erhalten und erscheinen im Baukasten als „Nicht lesbarer Abschnitt".'), textarea, problems);
  } else {
    sourceToggle.addEventListener('click', () => {
      state.ui.sourceView = true;
      editor.rerenderMiddle();
      document.getElementById('page-source')?.focus();
    });
    const items = [];
    page.elements.forEach((element, index) => {
      items.push(insertButton(editor, entry, pageIndex, index));
      items.push(renderCard(editor, entry, pageIndex, index));
    });
    items.push(insertButton(editor, entry, pageIndex, page.elements.length));
    body = el('ol', { class: 'cards', 'aria-label': 'Elemente dieser Seite' }, items);
  }

  return el(
    'section',
    { class: 'canvas stack' },
    el('h2', { class: 'editor-column__title', tabindex: -1 }, `Seite ${pageIndex + 1} von ${model.pages.length} · ${model.meta.kurztitel || model.meta.titel}`),
    el('div', { class: 'field' }, el('label', { for: titleInput.id }, 'Seitentitel (## im Text)'), titleInput),
    el('p', { class: `canvas__info${estimate.words > 250 ? ' canvas__info--warn' : ''}` }, `ca. ${Math.max(1, Math.round(estimate.minutes))} min · ${estimate.words} Wörter${estimate.words > 250 ? ' – eher lang für eine Bildschirmseite' : ''}`),
    el(
      'div',
      { class: 'canvas__actions' },
      sourceToggle,
      el('button', { type: 'button', class: 'button button--small', onclick: () => duplicatePage(editor, file, pageIndex) }, 'Seite duplizieren'),
      el('button', { type: 'button', class: 'button button--small', onclick: () => editor.operations.removePage(file, pageIndex) }, 'Seite entfernen'),
      el('button', { type: 'button', class: 'button button--small', onclick: () => editor.operations.addPage(file, pageIndex) }, '+ Neue Seite danach'),
      el('button', { type: 'button', class: 'button button--small', onclick: () => editor.operations.openInCourse(file, pageIndex + 1) }, 'Im Kurs testen'),
    ),
    body,
  );
}

/** Kursdown-Text einer Seite (für die Quelltext-Ansicht). */
function pageSource(page) {
  return [`## ${page.title}`, ...page.elements.map(serializeElement)].join('\n\n');
}

/**
 * Liest bearbeiteten Quelltext ein und ersetzt die Seite (bzw. mehrere Seiten, falls weitere
 * „## "-Überschriften hinzugekommen sind).
 * @returns {{ok: boolean, message?: string}}
 */
function applySource(editor, entry, pageIndex, text) {
  const items = parseBody(text, 1, entry.model.path);
  if (items[0]?.type !== 'page') {
    return { ok: false, message: 'Der Quelltext muss mit einer Zeile „## Seitentitel" beginnen.' };
  }
  const pages = [];
  for (const item of items) {
    if (item.type === 'page') pages.push({ title: item.title, elements: [], line: 0 });
    else pages[pages.length - 1].elements.push(item);
  }
  editor.commit((doc) => {
    doc.chapters.find((candidate) => candidate.file === entry.file).model.pages.splice(pageIndex, 1, ...pages);
  }, { chapter: entry.file });
  const unreadable = pages.flatMap((page) => page.elements).filter((element) => element.type === 'raw').length;
  editor.setStatus(unreadable > 0 ? `Übernommen. ${unreadable} Abschnitt(e) sind nicht lesbar und als solche markiert.` : pages.length > 1 ? `Übernommen – daraus sind ${pages.length} Seiten geworden.` : 'Quelltext übernommen.');
  return { ok: true };
}

/** Knopf „+ Element einfügen" an einer Position. */
function insertButton(editor, entry, pageIndex, index) {
  return el(
    'li',
    { class: 'cards__insert' },
    el('button', { type: 'button', class: 'cards__insert-button', onclick: () => openPalette(editor, entry, pageIndex, index) }, '+ Element einfügen', el('span', { class: 'visually-hidden' }, ` an Position ${index + 1}`)),
  );
}

/** Eine Karte im Baukasten. */
function renderCard(editor, entry, pageIndex, index) {
  const { state } = editor;
  const page = entry.model.pages[pageIndex];
  const element = page.elements[index];
  const file = entry.file;
  const selected = state.selection.kind === 'page' && state.selection.page === pageIndex && state.selection.element === index;
  const key = `${file}:${pageIndex}:${index}`;
  const expanded = state.ui.expanded.has(key);
  const label = elementLabel(element);

  const move = (delta) => {
    editor.commit(() => {
      [page.elements[index], page.elements[index + delta]] = [page.elements[index + delta], page.elements[index]];
    }, { chapter: file });
    editor.select({ kind: 'page', file, page: pageIndex, element: index + delta });
    editor.setStatus(`„${label}" ist jetzt an Position ${index + delta + 1}.`);
  };
  const toggle = () => {
    if (expanded) state.ui.expanded.delete(key);
    else state.ui.expanded.add(key);
    editor.rerenderMiddle();
  };

  const card = el(
    'li',
    { class: `card${selected ? ' card--selected' : ''}${element.type === 'raw' ? ' card--raw' : ''}`, draggable: 'true' },
    el(
      'div',
      { class: 'card__head' },
      el('button', { type: 'button', class: 'card__select', 'aria-pressed': String(selected), onclick: () => editor.select({ kind: 'page', file, page: pageIndex, element: index }) },
        el('span', { class: 'card__type' }, label),
        el('span', { class: 'card__summary' }, summary(element, false)),
      ),
      el('span', { class: 'card__tools' },
        el('button', { type: 'button', class: 'card__tool', disabled: index === 0, 'aria-label': `„${label}" nach oben`, onclick: () => move(-1) }, '↑'),
        el('button', { type: 'button', class: 'card__tool', disabled: index === page.elements.length - 1, 'aria-label': `„${label}" nach unten`, onclick: () => move(1) }, '↓'),
        el('button', { type: 'button', class: 'card__tool', 'aria-label': `„${label}" duplizieren`, onclick: () => {
          editor.commit(() => page.elements.splice(index + 1, 0, structuredClone(element)), { chapter: file });
          editor.select({ kind: 'page', file, page: pageIndex, element: index + 1 });
        } }, '⧉'),
        el('button', { type: 'button', class: 'card__tool', 'aria-label': `„${label}" entfernen`, onclick: () => {
          editor.commit(() => page.elements.splice(index, 1), { chapter: file });
          editor.select({ kind: 'page', file, page: pageIndex });
          editor.setStatus(`„${label}" entfernt. Rückgängig mit Strg/Cmd+Z.`);
        } }, '✕'),
        el('button', { type: 'button', class: 'card__tool', 'aria-expanded': String(expanded), 'aria-label': `„${label}" ${expanded ? 'zuklappen' : 'aufklappen'}`, onclick: toggle }, expanded ? '▴' : '▾'),
      ),
    ),
    expanded ? el('div', { class: 'card__body' }, summary(element, true)) : null,
    element.type === 'raw'
      ? el('p', { class: 'card__problem' }, `Nicht lesbarer Abschnitt – im Quelltext bearbeiten. ${element.errors[0]?.message ?? ''}`)
      : null,
  );
  addDrag(card, 'text/x-element', index, (from) => {
    if (from === index) return;
    editor.commit(() => {
      const [moved] = page.elements.splice(from, 1);
      page.elements.splice(index, 0, moved);
    }, { chapter: file });
  });
  return card;
}

/** Name eines Elements (für Karte und Ansagen). */
function elementLabel(element) {
  if (element.type === 'text') return 'Textabschnitt';
  if (element.type === 'image') return 'Bild';
  if (element.type === 'raw') return 'Nicht lesbarer Abschnitt';
  return getBlock(element.name)?.editor.label ?? element.name;
}

/** Kurzbeschreibung (zugeklappt) bzw. vollständiger Inhalt (aufgeklappt). */
function summary(element, full) {
  const cut = (text) => (full || text.length <= 140 ? text : `${text.slice(0, 140)} …`);
  if (element.type === 'text') return full ? el('pre', { class: 'card__text' }, element.markdown) : cut(element.markdown.replace(/\s+/g, ' '));
  if (element.type === 'image') return `${element.src}${element.alt ? ` – ${element.alt}` : ' – Alternativtext fehlt!'}`;
  if (element.type === 'raw') return full ? el('pre', { class: 'card__text' }, element.text) : cut(element.text.split('\n')[0]);
  const data = element.data ?? {};
  const counts = Object.entries(data).filter(([, value]) => Array.isArray(value)).map(([, value]) => value.length);
  const title = data.title ? `„${data.title}"` : '';
  if (full) return el('pre', { class: 'card__text' }, serializeElement(element));
  return [title, counts.length ? `${counts.join(' / ')} Einträge` : '', !data.title && data.markdown ? cut(data.markdown.replace(/\s+/g, ' ')) : ''].filter(Boolean).join(' · ');
}

/**
 * Palette „Element einfügen" mit Suchfeld.
 */
async function openPalette(editor, entry, pageIndex, index) {
  const id = 'palette-title';
  const options = [
    { name: 'text', label: 'Textabschnitt', description: 'Absätze, Listen, Zwischenüberschriften, Tabellen.', icon: 'assets/icons/text.svg', create: () => ({ type: 'text', markdown: 'Neuer Text.', line: 0 }) },
    { name: 'image', label: 'Bild', description: 'Ein Bild mit Alternativtext und optionaler Bildunterschrift.', icon: 'assets/icons/bild.svg', create: () => ({ type: 'image', src: '', alt: '', caption: '', line: 0 }) },
    ...listBlocks()
      .filter((block) => block.name !== 'quiz')
      .map((block) => ({ name: block.name, label: block.editor.label, description: block.editor.description, icon: block.editor.icon, create: () => ({ type: 'block', name: block.name, data: block.editor.createDefault(), line: 0 }) })),
  ];
  const choice = await openDialog((close) => {
    const search = el('input', { type: 'search', id: 'palette-search', class: 'field__input', autocomplete: 'off', autofocus: true, 'aria-controls': 'palette-list' });
    const list = el(
      'ul',
      { class: 'palette', id: 'palette-list' },
      options.map((option) =>
        el('li', { 'data-search': `${option.label} ${option.description} ${option.name}`.toLowerCase() },
          el('button', { type: 'button', class: 'palette__option', onclick: () => close(option) },
            el('img', { src: option.icon, alt: '', class: 'palette__icon', width: 32, height: 32 }),
            el('span', {}, el('strong', {}, option.label), el('span', { class: 'palette__description' }, option.description)),
          ),
        ),
      ),
    );
    const count = el('p', { class: 'field__hint', role: 'status' }, `${options.length} Elemente`);
    search.addEventListener('input', () => {
      const query = search.value.trim().toLowerCase();
      let visible = 0;
      for (const item of list.children) {
        item.hidden = query !== '' && !item.dataset.search.includes(query);
        if (!item.hidden) visible += 1;
      }
      count.textContent = `${visible} Elemente`;
    });
    return [
      el('h2', { id }, 'Element einfügen'),
      el('div', { class: 'field' }, el('label', { for: 'palette-search' }, 'Suchen'), search, count),
      list,
      el('div', { class: 'dialog__actions' }, el('button', { type: 'button', class: 'button', onclick: () => close(null) }, 'Abbrechen')),
    ];
  }, id);
  if (!choice) return;
  editor.commit((doc) => {
    doc.chapters.find((candidate) => candidate.file === entry.file).model.pages[pageIndex].elements.splice(index, 0, choice.create());
  }, { chapter: entry.file });
  editor.select({ kind: 'page', file: entry.file, page: pageIndex, element: index });
  editor.setStatus(`„${choice.label}" eingefügt. Bearbeite es rechts unter „Eigenschaften".`);
}

/** Drag & Drop innerhalb einer Liste (zusätzlich zu den ↑/↓-Knöpfen). */
function addDrag(item, type, index, onDrop) {
  item.addEventListener('dragstart', (event) => {
    event.stopPropagation();
    event.dataTransfer.setData(type, String(index));
    event.dataTransfer.effectAllowed = 'move';
    item.classList.add('is-dragging');
  });
  item.addEventListener('dragend', () => item.classList.remove('is-dragging'));
  item.addEventListener('dragover', (event) => {
    if (!event.dataTransfer.types.includes(type)) return;
    event.preventDefault();
    item.classList.add('is-drop-target');
  });
  item.addEventListener('dragleave', () => item.classList.remove('is-drop-target'));
  item.addEventListener('drop', (event) => {
    if (!event.dataTransfer.types.includes(type)) return;
    event.preventDefault();
    item.classList.remove('is-drop-target');
    onDrop(Number(event.dataTransfer.getData(type)));
  });
}

/* ───────────────────────────── Rechte Spalte: Eigenschaften ───────────────────────────── */

/**
 * Formular des ausgewählten Elements.
 * @param {Object} editor
 * @returns {HTMLElement}
 */
export function renderProperties(editor) {
  const { state } = editor;
  const selection = state.selection;
  const empty = (text) => el('div', { class: 'stack' }, el('h2', { class: 'editor-column__title' }, 'Eigenschaften'), el('p', { class: 'canvas__info' }, text));
  if (!state.doc || selection.kind !== 'page' || selection.element === undefined) {
    return empty('Wähle in der Mitte ein Element aus, um es hier zu bearbeiten.');
  }
  const entry = editor.entryByFile(selection.file);
  const page = entry?.model?.pages[selection.page];
  const element = page?.elements[selection.element];
  if (!element) return empty('Dieses Element gibt es nicht mehr.');

  const file = entry.file;
  const idPrefix = `el-${entry.model.id}-${selection.page}-${selection.element}`;
  const context = {
    idPrefix,
    change: (mutate, options = {}) => editor.commit(mutate, { source: 'right', coalesce: options.key, structural: options.structural, chapter: file }),
    pickImage: editor.pickImage,
    pickGlossaryTerm: editor.pickGlossaryTerm,
    imageUrl: editor.imageUrl,
  };
  const heading = el('h2', { class: 'editor-column__title' }, `Eigenschaften: ${elementLabel(element)}`);

  if (element.type === 'text') {
    return el('div', { class: 'stack' }, heading, renderMarkdownField({
      id: `${idPrefix}-text`,
      label: el('label', { for: `${idPrefix}-text` }, 'Text'),
      hint: el('p', { class: 'field__hint', id: `${idPrefix}-text-hint` }, '„### " = Zwischenüberschrift, „- " = Liste. Mehr in docs/BAUSTEINE.md.'),
      hintId: `${idPrefix}-text-hint`,
      value: element.markdown,
      set: (value) => context.change(() => { element.markdown = value; }, { key: `${idPrefix}-text` }),
      context,
      warnPageSyntax: true,
    }));
  }
  if (element.type === 'image') {
    return el('div', { class: 'stack' }, heading, renderFields(IMAGE_FIELDS, element, context));
  }
  if (element.type === 'raw') return renderRawEditor(editor, entry, selection, element, heading);

  const definition = getBlock(element.name);
  if (definition.editor.customEditor === 'hotspot') {
    return el('div', { class: 'stack' }, heading, renderHotspotEditor(element.data, context, definition.editor.fields));
  }
  return el('div', { class: 'stack' }, heading, el('p', { class: 'field__hint' }, definition.editor.description), renderFields(definition.editor.fields, element.data, context));
}

/** Nicht lesbarer Abschnitt: Rohtext bearbeiten und neu einlesen. */
function renderRawEditor(editor, entry, selection, element, heading) {
  const id = `raw-${entry.model.id}-${selection.page}-${selection.element}`;
  const textarea = el('textarea', { id, class: 'field__input field__textarea', rows: 14, spellcheck: 'false' }, element.text);
  textarea.addEventListener('input', () => editor.commit(() => { element.text = textarea.value; }, { source: 'right', coalesce: id, chapter: entry.file }));
  const reparse = el('button', { type: 'button', class: 'button button--primary button--small' }, 'Erneut einlesen');
  reparse.addEventListener('click', () => {
    const items = parseBody(textarea.value, 1, entry.model.path).filter((item) => item.type !== 'page');
    const stillRaw = items.some((item) => item.type === 'raw');
    editor.commit(() => {
      entry.model.pages[selection.page].elements.splice(selection.element, 1, ...items);
    }, { chapter: entry.file });
    editor.select({ kind: 'page', file: entry.file, page: selection.page, element: selection.element });
    editor.setStatus(stillRaw ? 'Immer noch nicht lesbar – siehe Meldung.' : 'Abschnitt ist jetzt lesbar.');
  });
  return el(
    'div',
    { class: 'stack' },
    heading,
    el('div', { class: 'notice notice--error' }, el('p', {}, 'Der Editor versteht diesen Abschnitt nicht. Er bleibt unverändert erhalten.'), el('ul', {}, element.errors.map((error) => el('li', {}, `${error.message} ${error.fix ?? ''}`)))),
    el('div', { class: 'field' }, el('label', { for: id }, 'Quelltext des Abschnitts'), textarea),
    reparse,
  );
}
