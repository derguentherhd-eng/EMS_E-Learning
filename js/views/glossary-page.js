/*
 * glossary-page.js – das Gesamtglossar (#/glossar und #/glossar/<begriff>)
 *
 * Alle Begriffe aus content/glossar.md, alphabetisch, mit Suchfeld. Über #/glossar/<begriff>
 * (z. B. aus dem Popover „Im Glossar ansehen") wird direkt zum Begriff gesprungen.
 *
 * Wenn du hier etwas ändern willst …
 *   – Begriffe selbst: content/glossar.md.
 */

import { el } from '../dom.js';
import { renderInline } from '../render.js';

/**
 * Macht aus einem Begriff eine gültige HTML-ID (für Sprungziele).
 * @param {string} term
 * @returns {string}
 */
export function termId(term) {
  return `begriff-${term.toLocaleLowerCase('de').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-')}`;
}

/**
 * @param {import('./view-types.js').ViewContext} context
 * @returns {import('./view-types.js').ViewResult}
 */
export function renderGlossaryPage({ route, course }) {
  const entries = course.glossary
    .filter((entry) => 'term' in entry)
    .sort((a, b) => a.term.localeCompare(b.term, 'de', { sensitivity: 'base' }));

  const rows = entries.map((entry) => ({
    entry,
    term: el('dt', { class: 'glossary-list__term', id: termId(entry.term), tabindex: -1 }, entry.term),
    text: el('dd', { class: 'glossary-list__text' }, renderInline(entry.text, { plainGlossary: true })),
  }));

  const count = el('p', { class: 'glossary-search__count', 'aria-live': 'polite' }, `${entries.length} Begriffe`);
  const input = el('input', { type: 'search', id: 'glossary-search', class: 'glossary-search__input', autocomplete: 'off', 'aria-describedby': 'glossary-search-count' });
  count.id = 'glossary-search-count';

  // Filtert die Liste beim Tippen (Begriff oder Erklärung enthält den Suchtext).
  input.addEventListener('input', () => {
    const query = input.value.trim().toLocaleLowerCase('de');
    let visible = 0;
    for (const row of rows) {
      const match = query === '' || `${row.entry.term} ${row.entry.text}`.toLocaleLowerCase('de').includes(query);
      row.term.hidden = !match;
      row.text.hidden = !match;
      if (match) visible += 1;
    }
    count.textContent = visible === 1 ? '1 Begriff' : `${visible} Begriffe`;
  });

  const target = route.params.term ? rows.find((row) => row.entry.term.toLocaleLowerCase('de') === String(route.params.term).toLocaleLowerCase('de')) : null;
  if (target) target.term.classList.add('glossary-list__term--target');

  return {
    title: 'Glossar',
    wide: false,
    focus: target?.term,
    node: el(
      'div',
      { class: 'stack' },
      el('h1', {}, 'Glossar'),
      el('p', { class: 'lead' }, 'Alle Fachbegriffe aus dem Kurs. Im Text erkennst du sie an der gepunkteten Unterstreichung.'),
      el('div', { class: 'glossary-search' }, el('label', { for: 'glossary-search' }, 'Begriff suchen'), input, count),
      entries.length > 0
        ? el('dl', { class: 'glossary-list' }, rows.map((row) => [row.term, row.text]))
        : el('p', { class: 'notice' }, 'Das Glossar ist noch leer.'),
    ),
  };
}
