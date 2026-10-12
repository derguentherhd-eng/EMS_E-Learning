/*
 * certificate-view.js – Platzhalter (wird in einer späteren Phase ausgebaut)
 */

import { el } from '../dom.js';

/** @returns {import('./view-types.js').ViewResult} */
export function renderCertificate() {
  return { title: 'Zertifikat', node: el('div', { class: 'stack' }, el('h1', {}, 'Zertifikat'), el('p', {}, 'Folgt in einer späteren Phase.')) };
}
