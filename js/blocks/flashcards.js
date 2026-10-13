/*
 * flashcards.js – Baustein „karten": Lernkarten zum Umdrehen
 *
 * Kursdown (eine Zeile pro Karte, Vorder- und Rückseite getrennt durch ||):
 *   :::karten Statisch oder dynamisch?
 *   Statische Disziplinen || Bewertet werden Konstruktion, Kosten und Businessplan.
 *   Dynamische Disziplinen || Das Auto beweist sich auf der Strecke.
 *   :::
 *
 * Bedienung: Jede Karte hat einen Knopf „Umdrehen". Die Rückseite wird in einem
 * aria-live-Bereich eingeblendet, damit Screenreader sie vorlesen. Die Drehung ist eine kurze
 * Animation (Web Animations API) und entfällt bei „Bewegung reduzieren".
 *
 * Didaktik: Gut für Begriffspaare und häufige Fragen. Die Vorderseite sollte zum Nachdenken
 * anregen („Was passiert beim Scrutineering?"), nicht schon die Antwort enthalten.
 *
 * Wenn du hier etwas ändern willst …
 *   – Aussehen: Abschnitt „karten" in css/blocks.css.
 */

(function () {
  'use strict';

const { el } = EM.require('js/dom.js');
const { blockError, blockSection, escapePipes, formatBlock, formatHeader, prefersReducedMotion, trimLines } = EM.require('js/blocks/block-utils.js');

/** @typedef {{title: string, cards: {front: string, back: string}[]}} FlashcardsData */

/** @type {import('./registry.js').BlockDefinition} */
const definition = {
  name: 'karten',
  interactive: true,

  parse(raw) {
    const errors = [];
    const cards = [];
    for (const { text, line } of trimLines(raw.lines)) {
      if (text.trim() === '') continue;
      const separator = text.indexOf('||');
      if (separator === -1) {
        errors.push(blockError(raw, line, `In dieser Zeile fehlt der Trenner ||: „${text.trim()}"`, 'Schreibe jede Karte als „Vorderseite || Rückseite".'));
        continue;
      }
      cards.push({ front: unescape(text.slice(0, separator)), back: unescape(text.slice(separator + 2)) });
    }
    return { data: { title: raw.title, cards }, errors };
  },

  validate(data, raw) {
    const errors = [];
    if (data.cards.length === 0) {
      errors.push(blockError(raw, raw.line, 'Es gibt keine Karten.', 'Füge Zeilen der Form „Vorderseite || Rückseite" hinzu.'));
    }
    data.cards.forEach((card, index) => {
      if (!card.front || !card.back) {
        errors.push(blockError(raw, raw.line, `Karte ${index + 1} hat eine leere Seite.`, 'Beide Seiten brauchen Text.'));
      }
    });
    return errors;
  },

  /**
   * @param {FlashcardsData} data
   * @param {import('./block-utils.js').BlockContext} context
   */
  render(data, context) {
    const { section } = blockSection('flashcards', data.title, context, 'Lernkarten');
    section.append(el('p', { class: 'block__hint' }, 'Überleg dir die Antwort, dann dreh die Karte um.'));
    const list = el('ul', { class: 'flashcards__list' });
    data.cards.forEach((card, index) => list.append(renderCard(card, index, data.cards.length, context)));
    section.append(list);
    return section;
  },

  /** @param {FlashcardsData} data */
  serialize(data) {
    const lines = data.cards.map((card) => `${escapeCard(card.front)} || ${escapeCard(card.back)}`);
    return formatBlock(formatHeader('karten', data.title), lines);
  },

  editor: {
    label: 'Lernkarten',
    description: 'Karten mit Frage oder Begriff vorne und Erklärung hinten zum Umdrehen.',
    icon: 'assets/icons/karten.svg',
    createDefault: () => ({
      title: '',
      cards: [
        { front: 'Begriff oder Frage', back: 'Erklärung oder Antwort' },
        { front: 'Zweite Karte', back: 'Rückseite der zweiten Karte' },
      ],
    }),
    fields: [
      { key: 'title', type: 'text', label: 'Überschrift (optional)' },
      {
        key: 'cards',
        type: 'list',
        label: 'Karten',
        itemLabel: 'Karte',
        min: 1,
        itemFields: [
          { key: 'front', type: 'text', label: 'Vorderseite', required: true },
          { key: 'back', type: 'text', label: 'Rückseite', required: true },
        ],
      },
    ],
  },
};

/** Eine Karte mit Umdrehen-Knopf. */
function renderCard(card, index, total, context) {
  const faceId = context.uid('karte');
  const front = el('p', { class: 'flashcard__front' }, context.renderInline(card.front));
  const back = el('p', { class: 'flashcard__back', hidden: true }, context.renderInline(card.back));
  const face = el('div', { class: 'flashcard__face', id: faceId, 'aria-live': 'polite' }, front, back);
  const button = el('button', { type: 'button', class: 'button button--small flashcard__turn', 'aria-controls': faceId }, 'Umdrehen');
  const item = el(
    'li',
    { class: 'flashcard' },
    el('p', { class: 'flashcard__count' }, `Karte ${index + 1} von ${total}`),
    face,
    button,
  );

  button.addEventListener('click', async () => {
    const showBack = back.hidden;
    if (!prefersReducedMotion() && face.animate) {
      await face.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(90deg)' }], { duration: 110, easing: 'ease-in' }).finished;
    }
    front.hidden = showBack;
    back.hidden = !showBack;
    item.classList.toggle('flashcard--turned', showBack);
    button.textContent = showBack ? 'Zurückdrehen' : 'Umdrehen';
    if (!prefersReducedMotion() && face.animate) {
      face.animate([{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(0deg)' }], { duration: 110, easing: 'ease-out' });
    }
  });
  return item;
}

/** „||" im Text würde die Zeile falsch trennen → als „\|\|" schreiben. */
function escapeCard(text) {
  return escapePipes(text);
}

function unescape(text) {
  return text.trim().replace(/\\\|/g, '|');
}

EM.define('js/blocks/flashcards.js', { default: definition });
})();
