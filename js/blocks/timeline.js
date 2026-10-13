/*
 * timeline.js – Baustein „zeitstrahl": Abläufe über die Zeit (z. B. die Saison)
 *
 * Kursdown (eine Zeile pro Station: Zeitpunkt | Titel | Text):
 *   :::zeitstrahl Eine Saison bei uns
 *   Herbst | Konzept | Neue Ideen, Lastenheft, erste Simulationen.
 *   Winter | Konstruktion | CAD, Berechnung, Design Freeze.
 *   :::
 *
 * Darstellung: geordnete Liste (<ol>) mit senkrechter Linie – wie eine Rundenliste.
 * Kein interaktiver Baustein (zählt nicht für die Didaktik-Regel „zwei Interaktionen").
 *
 * Wenn du hier etwas ändern willst …
 *   – Aussehen: Abschnitt „zeitstrahl" in css/blocks.css.
 */

(function () {
  'use strict';

const { el } = EM.require('js/dom.js');
const { blockError, blockSection, escapePipes, formatBlock, formatHeader, splitPipes, trimLines } = EM.require('js/blocks/block-utils.js');

/**
 * @typedef {{when: string, title: string, text: string}} TimelineEntry
 * @typedef {{title: string, entries: TimelineEntry[]}} TimelineData
 */

/** @type {import('./registry.js').BlockDefinition} */
const definition = {
  name: 'zeitstrahl',
  interactive: false,

  parse(raw) {
    const errors = [];
    const entries = [];
    for (const { text, line } of trimLines(raw.lines)) {
      if (text.trim() === '') continue;
      const parts = splitPipes(text.trim());
      if (parts.length < 2) {
        errors.push(blockError(raw, line, `Diese Zeile hat keinen Trenner |: „${text.trim()}"`, 'Format: „Zeitpunkt | Titel | Text".'));
        continue;
      }
      const [when, title, ...rest] = parts;
      entries.push({ when, title, text: rest.join(' | ') });
    }
    return { data: { title: raw.title, entries }, errors };
  },

  validate(data, raw) {
    return data.entries.length === 0
      ? [blockError(raw, raw.line, 'Der Zeitstrahl ist leer.', 'Füge Zeilen der Form „Zeitpunkt | Titel | Text" hinzu.')]
      : [];
  },

  /**
   * @param {TimelineData} data
   * @param {import('./block-utils.js').BlockContext} context
   */
  render(data, context) {
    const { section } = blockSection('timeline', data.title, context, 'Zeitstrahl');
    section.append(
      el(
        'ol',
        { class: 'timeline__list' },
        data.entries.map((entry) =>
          el(
            'li',
            { class: 'timeline__entry' },
            el('p', { class: 'timeline__when' }, entry.when),
            el('p', { class: 'timeline__title' }, context.renderInline(entry.title)),
            entry.text ? el('p', { class: 'timeline__text' }, context.renderInline(entry.text)) : null,
          ),
        ),
      ),
    );
    return section;
  },

  /** @param {TimelineData} data */
  serialize(data) {
    const lines = data.entries.map((entry) => [entry.when, entry.title, entry.text].filter((part, index) => index < 2 || part).map(escapePipes).join(' | '));
    return formatBlock(formatHeader('zeitstrahl', data.title), lines);
  },

  editor: {
    label: 'Zeitstrahl',
    description: 'Stationen eines Ablaufs in zeitlicher Reihenfolge, z. B. die Saison.',
    icon: 'assets/icons/zeitstrahl.svg',
    createDefault: () => ({
      title: 'Ablauf',
      entries: [
        { when: 'Zeitpunkt 1', title: 'Erste Station', text: 'Was passiert hier?' },
        { when: 'Zeitpunkt 2', title: 'Zweite Station', text: 'Und dann?' },
      ],
    }),
    fields: [
      { key: 'title', type: 'text', label: 'Überschrift' },
      {
        key: 'entries',
        type: 'list',
        label: 'Stationen',
        itemLabel: 'Station',
        min: 1,
        itemFields: [
          { key: 'when', type: 'text', label: 'Zeitpunkt', required: true },
          { key: 'title', type: 'text', label: 'Titel', required: true },
          { key: 'text', type: 'text', label: 'Text' },
        ],
      },
    ],
  },
};

EM.define('js/blocks/timeline.js', { default: definition });
})();
