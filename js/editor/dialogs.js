/*
 * dialogs.js – Bestätigungs- und Eingabedialoge für den Editor
 *
 * Alle Dialoge nutzen das native <dialog>-Element mit showModal(): Der Browser hält den Fokus
 * im Dialog, Escape schließt ihn, danach springt der Fokus zurück zum auslösenden Knopf.
 *
 * Wenn du hier etwas ändern willst …
 *   – Aussehen: .dialog in css/components.css (gleich wie im Kurs).
 */

import { el } from '../dom.js';

/**
 * Öffnet einen Dialog und wartet auf das Ergebnis.
 * @param {(close: (value: any) => void) => Node[]} build  baut den Inhalt; close(wert) schließt
 * @param {string} labelId  ID der Überschrift (für aria-labelledby)
 * @returns {Promise<any>}  Wert aus close(), bei Escape null
 */
export function openDialog(build, labelId) {
  const opener = document.activeElement;
  return new Promise((resolve) => {
    let result = null;
    const dialog = el('dialog', { class: 'dialog', 'aria-labelledby': labelId });
    const close = (value) => {
      result = value;
      dialog.close();
    };
    dialog.append(...build(close));
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
      resolve(result);
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

/**
 * Ja/Nein-Frage.
 * @param {Object} options
 * @param {string} options.title
 * @param {string|Node} options.text
 * @param {string} [options.confirmLabel]
 * @param {string} [options.cancelLabel]
 * @param {boolean} [options.danger]
 * @returns {Promise<boolean>}
 */
export async function confirmDialog({ title, text, confirmLabel = 'OK', cancelLabel = 'Abbrechen', danger = false }) {
  const id = `dialog-${Date.now()}`;
  const value = await openDialog(
    (close) => [
      el('h2', { id }, title),
      typeof text === 'string' ? el('p', {}, text) : text,
      el(
        'div',
        { class: 'dialog__actions' },
        el('button', { type: 'button', class: 'button', autofocus: true, onclick: () => close(false) }, cancelLabel),
        el('button', { type: 'button', class: `button ${danger ? 'button--danger' : 'button--primary'}`, onclick: () => close(true) }, confirmLabel),
      ),
    ],
    id,
  );
  return value === true;
}

/**
 * Fragt einen Text ab.
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.label
 * @param {string} [options.value]
 * @param {string} [options.hint]
 * @param {string} [options.confirmLabel]
 * @returns {Promise<string|null>}  null bei Abbruch
 */
export function promptDialog({ title, label, value = '', hint = '', confirmLabel = 'OK' }) {
  const id = `dialog-${Date.now()}`;
  return openDialog((close) => {
    const input = el('input', { type: 'text', id: `${id}-input`, value, class: 'field__input', autofocus: true, required: true });
    const form = el(
      'form',
      { class: 'stack', method: 'dialog' },
      el('div', { class: 'field' }, el('label', { for: `${id}-input` }, label), hint ? el('p', { class: 'field__hint' }, hint) : null, input),
      el(
        'div',
        { class: 'dialog__actions' },
        el('button', { type: 'button', class: 'button', onclick: () => close(null) }, 'Abbrechen'),
        el('button', { type: 'submit', class: 'button button--primary' }, confirmLabel),
      ),
    );
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (text) close(text);
      else input.focus();
    });
    return [el('h2', { id }, title), form];
  }, id);
}
