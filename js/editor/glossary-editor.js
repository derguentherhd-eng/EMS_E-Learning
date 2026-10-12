/*
 * glossary-editor.js – Glossar bearbeiten
 *
 * Tabelle mit Begriff und Erklärung, Anlegen, Bearbeiten, Entfernen, alphabetisch sortieren.
 * Zu jedem Begriff steht, in welchen Kapiteln er als [[Begriff]] verwendet wird – so sieht
 * man vor dem Entfernen, wo er fehlen würde.
 *
 * Wenn du hier etwas ändern willst …
 *   – Format der Datei content/glossar.md: documents.js (parseGlossary) / serialize.js.
 */

import { el } from '../dom.js';
import { serializeChapter } from '../content/serialize.js';

/**
 * @param {Object} editor
 * @returns {HTMLElement}
 */
export function renderGlossaryEditor(editor) {
  const { doc } = editor.state;
  const change = (mutate, key = null, structural = false) => editor.commit(mutate, { source: 'middle', coalesce: key, structural });

  // Wo wird welcher Begriff verwendet? (Volltextsuche nach [[Begriff …]] in allen Kapiteln)
  const texts = doc.chapters
    .filter((entry) => entry.model)
    .map((entry) => ({ title: entry.model.meta.kurztitel || entry.model.meta.titel, text: serializeChapter(entry.model).toLocaleLowerCase('de') }));
  const usage = (term) => texts.filter((chapter) => chapter.text.includes(`[[${term.toLocaleLowerCase('de')}`)).map((chapter) => chapter.title);

  const rows = doc.glossary.map((entry, index) => {
    if (!('term' in entry)) {
      return el('tr', {}, el('td', { colspan: 4 }, el('p', { class: 'field__warning' }, `Nicht lesbare Zeile (bleibt erhalten): ${entry.raw}`)));
    }
    const id = `glossar-${index}`;
    const term = el('input', { type: 'text', id: `${id}-term`, value: entry.term, class: 'field__input', 'aria-label': `Begriff ${index + 1}` });
    term.addEventListener('input', () => change(() => { entry.term = term.value; }, term.id));
    const text = el('textarea', { id: `${id}-text`, rows: 2, class: 'field__input', 'aria-label': `Erklärung zu „${entry.term}"` }, entry.text);
    text.addEventListener('input', () => change(() => { entry.text = text.value.replace(/\n/g, ' '); }, text.id));
    const used = usage(entry.term);
    const remove = el('button', { type: 'button', class: 'button button--small', 'aria-label': `„${entry.term}" entfernen` }, 'Entfernen');
    remove.addEventListener('click', async () => {
      if (used.length > 0) {
        const ok = await editor.confirm({ title: 'Begriff wird verwendet', text: `„${entry.term}" kommt vor in: ${used.join(', ')}. Dort würde danach die Erklärung fehlen (die Prüfung meldet das). Trotzdem entfernen?`, confirmLabel: 'Entfernen', danger: true });
        if (!ok) return;
      }
      change(() => doc.glossary.splice(index, 1), null, true);
    });
    return el('tr', {}, el('td', {}, term), el('td', {}, text), el('td', { class: 'glossary-editor__usage' }, used.length ? used.join(', ') : el('span', { class: 'field__hint' }, 'nicht verwendet')), el('td', {}, remove));
  });

  const add = el('button', { type: 'button', class: 'button button--small' }, '+ Begriff hinzufügen');
  add.addEventListener('click', () => {
    change(() => doc.glossary.push({ term: '', text: '', line: 0 }), null, true);
    document.getElementById(`glossar-${doc.glossary.length - 1}-term`)?.focus();
  });
  const sort = el('button', { type: 'button', class: 'button button--small' }, 'Alphabetisch sortieren');
  sort.addEventListener('click', () => change(() => doc.glossary.sort((a, b) => String(a.term ?? a.raw).localeCompare(String(b.term ?? b.raw), 'de', { sensitivity: 'base' })), null, true));

  return el(
    'section',
    { class: 'canvas stack' },
    el('h2', { class: 'editor-column__title', tabindex: -1 }, `Glossar (${doc.glossary.length} Begriffe)`),
    el('p', { class: 'canvas__info' }, 'Datei: content/glossar.md · Eine Erklärung in ein bis zwei Sätzen. Im Text verweist [[Begriff]] darauf.'),
    el('div', { class: 'canvas__actions' }, add, sort),
    el(
      'div',
      { class: 'table-wrap', role: 'region', tabindex: 0, 'aria-label': 'Glossartabelle' },
      el('table', { class: 'glossary-editor' },
        el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Begriff'), el('th', { scope: 'col' }, 'Erklärung'), el('th', { scope: 'col' }, 'Verwendet in'), el('th', { scope: 'col' }, el('span', { class: 'visually-hidden' }, 'Aktionen')))),
        el('tbody', {}, rows),
      ),
    ),
  );
}
