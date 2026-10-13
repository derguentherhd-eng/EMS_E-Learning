/*
 * course-tree.js – linke Spalte des Editors: Kursstruktur
 *
 * Zeigt Kurseinstellungen, Glossar, die aktiven Kapitel (in Kursreihenfolge) mit ihren Seiten
 * und dem Quiz, darunter inaktive und archivierte Kapitel.
 *
 * Umsortieren: mit den Knöpfen ↑/↓ (Tastatur, Screenreader) – zusätzlich per Drag & Drop.
 * Drag & Drop ist nur eine Abkürzung; alles geht auch ohne Maus.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Aktion an einem Kapitel: Knopf hier, Logik in editor-main.js (operations).
 */

(function () {
  'use strict';

const { el } = EM.require('js/dom.js');

/**
 * Baut die Kursstruktur.
 * @param {Object} editor  Schnittstelle aus editor-main.js
 * @returns {HTMLElement}
 */
function renderTree(editor) {
  const { state } = editor;
  const selection = state.selection;
  const changedPaths = new Set(editor.collectChanges().map((change) => change.path));
  const errorFiles = new Set(state.validation.filter((item) => item.severity === 'fehler').map((item) => item.file));

  const link = (text, isCurrent, onClick, extra = {}) =>
    el('button', { type: 'button', class: 'tree__link', 'aria-current': isCurrent ? 'true' : null, onclick: onClick, ...extra }, text);

  const active = editor.activeEntries();
  const chapterItems = active.map((entry, index) => {
    const model = entry.model;
    const path = editor.chapterPath(entry);
    const expanded = state.ui.expanded.has(entry.file);
    const isSelected = selection.file === entry.file;
    const title = model ? model.meta.kurztitel || model.meta.titel : `${entry.file} (nicht lesbar)`;
    const toggle = el('button', { type: 'button', class: 'tree__toggle', 'aria-expanded': String(expanded), 'aria-label': `Seiten von „${title}" ${expanded ? 'zuklappen' : 'aufklappen'}` }, expanded ? '▾' : '▸');
    toggle.addEventListener('click', () => {
      if (expanded) state.ui.expanded.delete(entry.file);
      else state.ui.expanded.add(entry.file);
      editor.select(state.selection);
    });

    const badges = [
      changedPaths.has(path) ? el('span', { class: 'tree__badge tree__badge--dirty', title: 'Ungespeichert' }, '●', el('span', { class: 'visually-hidden' }, ' ungespeichert')) : null,
      errorFiles.has(path) ? el('span', { class: 'tree__badge tree__badge--error', title: 'Enthält Fehler' }, '!', el('span', { class: 'visually-hidden' }, ' enthält Fehler')) : null,
    ];

    const item = el(
      'li',
      { class: 'tree__chapter', draggable: 'true', 'data-file': entry.file },
      el(
        'div',
        { class: 'tree__row' },
        model ? toggle : el('span', { class: 'tree__toggle-spacer' }),
        link([el('span', { class: 'tree__number' }, `${index + 1}`), ' ', title], isSelected && selection.kind === 'chapter', () => editor.select({ kind: 'chapter', file: entry.file })),
        badges,
        el('span', { class: 'tree__order' },
          el('button', { type: 'button', class: 'tree__move', disabled: index === 0, 'aria-label': `„${title}" nach oben`, onclick: () => editor.operations.moveChapter(entry.file, -1) }, '↑'),
          el('button', { type: 'button', class: 'tree__move', disabled: index === active.length - 1, 'aria-label': `„${title}" nach unten`, onclick: () => editor.operations.moveChapter(entry.file, 1) }, '↓'),
        ),
      ),
      model && expanded
        ? el(
          'ul',
          { class: 'tree__pages' },
          model.pages.map((page, pageIndex) =>
            el('li', {}, link(`${pageIndex + 1} · ${page.title || '(ohne Titel)'}`, isSelected && selection.kind === 'page' && selection.page === pageIndex, () => editor.select({ kind: 'page', file: entry.file, page: pageIndex }))),
          ),
          el(
            'li',
            {},
            model.quiz
              ? link(`Quiz (${model.quiz.data.questions.length} / ${model.quiz.data.count ?? 'alle'})`, isSelected && selection.kind === 'quiz', () => editor.select({ kind: 'quiz', file: entry.file }))
              : el('button', { type: 'button', class: 'tree__link tree__link--add', onclick: () => editor.operations.createQuiz(entry.file) }, '+ Quiz anlegen'),
          ),
        )
        : null,
    );
    addDragAndDrop(item, entry.file, index, editor);
    return item;
  });

  const inactive = editor.inactiveEntries();
  const archived = editor.archivedEntries();
  const name = (entry) => entry.model?.meta.titel ?? entry.file;

  return el(
    'nav',
    { class: 'tree', 'aria-label': 'Kursstruktur' },
    el('h2', { class: 'editor-column__title' }, 'Kursstruktur'),
    el(
      'ul',
      { class: 'tree__top' },
      el('li', {}, link('Kurseinstellungen', selection.kind === 'course', () => editor.select({ kind: 'course' }))),
      el('li', {}, link(`Glossar (${state.doc.glossary.length})`, selection.kind === 'glossary', () => editor.select({ kind: 'glossary' }))),
    ),
    el('h3', { class: 'tree__heading' }, 'Kapitel im Kurs'),
    el('ol', { class: 'tree__chapters' }, chapterItems),
    el('button', { type: 'button', class: 'button button--small tree__add', onclick: () => editor.operations.newChapter() }, '+ Kapitel anlegen'),
    el(
      'details',
      { class: 'tree__group', open: inactive.some((entry) => entry.file === selection.file) },
      el('summary', {}, `Inaktiv (${inactive.length})`),
      inactive.length === 0
        ? el('p', { class: 'tree__empty' }, 'Keine inaktiven Kapitel.')
        : el(
          'ul',
          { class: 'tree__list' },
          inactive.map((entry) =>
            el(
              'li',
              { class: 'tree__inactive' },
              link(name(entry), selection.file === entry.file, () => editor.select({ kind: 'chapter', file: entry.file })),
              el('span', { class: 'tree__actions' },
                el('button', { type: 'button', class: 'button button--small', onclick: () => editor.operations.activate(entry.file) }, 'Aktivieren'),
                el('button', { type: 'button', class: 'button button--small', onclick: () => editor.operations.archive(entry.file) }, 'Archivieren'),
              ),
            ),
          ),
        ),
      state.workspace.canList ? null : el('p', { class: 'tree__empty' }, 'Ohne Ordnerzugriff sieht der Editor nur Kapitel, die in kurs.md stehen.'),
    ),
    el(
      'details',
      { class: 'tree__group' },
      el('summary', {}, `Archiv (${archived.length})`),
      archived.length === 0
        ? el('p', { class: 'tree__empty' }, state.workspace.canList ? 'Das Archiv ist leer.' : 'Ohne Ordnerzugriff kann der Editor das Archiv nicht lesen.')
        : el('ul', { class: 'tree__list' }, archived.map((entry) => el('li', { class: 'tree__inactive' }, el('span', {}, name(entry)), el('button', { type: 'button', class: 'button button--small', onclick: () => editor.operations.restore(entry.file) }, 'Wiederherstellen')))),
    ),
  );
}

/**
 * Drag & Drop für Kapitel (zusätzlich zu den ↑/↓-Knöpfen).
 */
function addDragAndDrop(item, file, index, editor) {
  item.addEventListener('dragstart', (event) => {
    event.dataTransfer.setData('text/x-chapter', file);
    event.dataTransfer.effectAllowed = 'move';
    item.classList.add('is-dragging');
  });
  item.addEventListener('dragend', () => item.classList.remove('is-dragging'));
  item.addEventListener('dragover', (event) => {
    if (!event.dataTransfer.types.includes('text/x-chapter')) return;
    event.preventDefault();
    item.classList.add('is-drop-target');
  });
  item.addEventListener('dragleave', () => item.classList.remove('is-drop-target'));
  item.addEventListener('drop', (event) => {
    event.preventDefault();
    item.classList.remove('is-drop-target');
    const dragged = event.dataTransfer.getData('text/x-chapter');
    if (dragged && dragged !== file) editor.operations.moveChapterTo(dragged, index);
  });
}

EM.define('js/editor/course-tree.js', { renderTree });
})();
