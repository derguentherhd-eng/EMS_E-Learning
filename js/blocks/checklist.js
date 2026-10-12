/*
 * checklist.js – Baustein „checkliste": persönliche Abhakliste
 *
 * Kursdown:
 *   :::checkliste Deine ersten zwei Wochen
 *   - [ ] Zum ersten Teammeeting kommen
 *   - [ ] Zugang zum Drive beantragen
 *   :::
 *
 * Die Haken setzt jede Person für sich; sie werden im Browser gespeichert (Fortschritt,
 * Feld checklists). Der Haken hängt am TEXT des Eintrags (kurzer Hash): Umsortieren behält
 * die Haken, eine Umformulierung setzt nur diesen einen Eintrag zurück.
 * In der Editor-Vorschau funktionieren die Haken, werden aber nicht gespeichert.
 *
 * Wenn du hier etwas ändern willst …
 *   – Aussehen: Abschnitt „checkliste" in css/blocks.css.
 */

import { el } from '../dom.js';
import { blockError, blockSection, formatBlock, formatHeader, hashText, oneLine, trimLines } from './block-utils.js';

/** @typedef {{title: string, items: string[]}} ChecklistData */

/** @type {import('./registry.js').BlockDefinition} */
export default {
  name: 'checkliste',
  interactive: true,

  parse(raw) {
    const errors = [];
    const items = [];
    for (const { text, line } of trimLines(raw.lines)) {
      const trimmed = text.trim();
      if (trimmed === '') continue;
      const match = trimmed.match(/^-\s*\[([ xX])\]\s*(.+)$/);
      if (!match) {
        errors.push(blockError(raw, line, `Diese Zeile verstehe ich nicht: „${trimmed}"`, 'Jeder Eintrag ist eine Zeile „- [ ] Aufgabe".'));
        continue;
      }
      if (match[1] !== ' ') {
        errors.push(blockError(raw, line, 'Ein Eintrag ist mit [x] vorab abgehakt – das wird ignoriert.', 'Abhaken kann nur jede Person selbst. Schreibe „- [ ]".', 'hinweis'));
      }
      items.push(match[2].trim());
    }
    return { data: { title: raw.title, items }, errors };
  },

  validate(data, raw) {
    return data.items.length === 0 ? [blockError(raw, raw.line, 'Die Checkliste ist leer.', 'Füge Zeilen „- [ ] Aufgabe" hinzu.')] : [];
  },

  /**
   * @param {ChecklistData} data
   * @param {import('./block-utils.js').BlockContext} context
   */
  render(data, context) {
    const { section } = blockSection('checklist', data.title, context, 'Checkliste');
    const status = el('p', { class: 'checklist__status', 'aria-live': 'polite' });
    const stored = () => context.store.get().checklists[context.chapterId] ?? {};
    const update = () => {
      const done = data.items.filter((item) => stored()[hashText(item)]).length;
      status.textContent = `${done} von ${data.items.length} erledigt`;
    };

    const list = el(
      'ul',
      { class: 'checklist__list' },
      data.items.map((item) => {
        const id = context.uid('check');
        const key = hashText(item);
        const input = el('input', { type: 'checkbox', id, class: 'checklist__input', checked: Boolean(stored()[key]) });
        input.addEventListener('change', () => {
          context.store.update((state) => {
            state.checklists[context.chapterId] = { ...(state.checklists[context.chapterId] ?? {}), [key]: input.checked };
          });
          update();
        });
        return el('li', { class: 'checklist__item' }, input, el('label', { for: id }, context.renderInline(item, { plainGlossary: true })));
      }),
    );
    update();
    section.append(list, status);
    return section;
  },

  /** @param {ChecklistData} data */
  serialize(data) {
    return formatBlock(formatHeader('checkliste', data.title), data.items.map((item) => `- [ ] ${oneLine(item)}`));
  },

  editor: {
    label: 'Checkliste',
    description: 'Persönliche Abhakliste; die Haken bleiben im Browser gespeichert.',
    icon: 'assets/icons/checkliste.svg',
    createDefault: () => ({ title: 'Deine nächsten Schritte', items: ['Erster Schritt', 'Zweiter Schritt'] }),
    fields: [
      { key: 'title', type: 'text', label: 'Überschrift' },
      { key: 'items', type: 'list', label: 'Einträge', itemLabel: 'Eintrag', min: 1, itemFields: [{ key: 'value', type: 'text', label: 'Aufgabe', required: true }] },
    ],
  },
};
