/*
 * quiz-view.js – Platzhalter (wird in einer späteren Phase ausgebaut)
 */

import { el } from '../dom.js';

/** @returns {import('./view-types.js').ViewResult} */
export function renderQuiz() {
  return { title: 'Kapitelquiz', node: el('div', { class: 'stack' }, el('h1', {}, 'Kapitelquiz'), el('p', {}, 'Folgt in einer späteren Phase.')) };
}
