/*
 * qualifying.js – Platzhalter (wird in einer späteren Phase ausgebaut)
 */

import { el } from '../dom.js';

/** @returns {import('./view-types.js').ViewResult} */
export function renderQualifying() {
  return { title: 'Qualifying', node: el('div', { class: 'stack' }, el('h1', {}, 'Qualifying'), el('p', {}, 'Folgt in einer späteren Phase.')) };
}
