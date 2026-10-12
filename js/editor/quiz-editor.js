/*
 * quiz-editor.js – Spezialeditor für das Kapitelquiz
 *
 * Fragenliste mit: Fragetext · Schalter „sicherheitskritisch" · Antworten (hinzufügen,
 * entfernen, umsortieren; richtige per Häkchen) · Erklärung (Pflicht) · Seitenverweis als
 * Auswahlliste aus den Seitentiteln des Kapitels. Oben: „Pool: 9 Fragen, gezeigt werden 5".
 *
 * Wird das Quiz geändert, schlägt der Editor vor, die Kapitelversion zu erhöhen (siehe
 * quizChanged / versionNotice).
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Eigenschaft einer Frage: hier ein Feld, in js/blocks/quiz-block.js lesen/schreiben.
 */

import { el } from '../dom.js';
import { serializeElement } from '../content/serialize.js';

/**
 * Wurde das Quiz seit dem Laden geändert, ohne dass die Version erhöht wurde?
 * @param {Object} editor
 * @param {Object} entry
 * @returns {boolean}
 */
export function quizChanged(editor, entry) {
  const baseline = editor.state.baseline[entry.file];
  const model = entry.model;
  if (!baseline || !model?.quiz || entry.origin === null) return false;
  return serializeElement(model.quiz) !== baseline.quiz && Number(model.meta.version) <= Number(baseline.version);
}

/**
 * Hinweis „Version erhöhen", wenn das Quiz geändert wurde.
 * @returns {HTMLElement}
 */
export function versionNotice(editor, entry) {
  const model = entry.model;
  const next = Number(model.meta.version || 1) + 1;
  return el(
    'div',
    { class: 'notice' },
    el('p', {}, el('strong', {}, 'Das Quiz wurde geändert. '), 'Erhöhe die Version, damit alle, die das Kapitel schon bestanden haben, das Quiz mit den neuen Fragen noch einmal machen.'),
    el('button', { type: 'button', class: 'button button--small', onclick: () => editor.commit(() => { model.meta.version = next; }, { chapter: entry.file }) }, `Version auf ${next} erhöhen`),
  );
}

/**
 * @param {Object} editor
 * @param {Object} entry
 * @returns {HTMLElement}
 */
export function renderQuizEditor(editor, entry) {
  const model = entry.model;
  const quiz = model.quiz;
  const data = quiz.data;
  const file = entry.file;
  const prefix = `quiz-${model.id}`;

  /** Änderung melden. structural = Liste neu zeichnen (Frage/Antwort hinzugefügt, verschoben …). */
  const change = (mutate, key = null, structural = false) =>
    editor.commit(mutate, { source: 'middle', coalesce: key, structural, chapter: file });

  const critical = data.questions.filter((question) => question.critical).length;
  const normal = data.questions.length - critical;
  const shown = Math.min(data.count ?? normal, normal) + critical;

  const countInput = el('input', { type: 'number', id: `${prefix}-count`, min: 1, max: Math.max(1, normal), value: data.count ?? '', class: 'field__input field__input--number' });
  countInput.addEventListener('input', () => change(() => { data.count = countInput.value === '' ? null : Number(countInput.value); }, countInput.id));

  const pageTitles = model.pages.map((page) => page.title);

  const questions = data.questions.map((question, q) => {
    const id = `${prefix}-${q}`;
    const text = el('input', { type: 'text', id: `${id}-text`, value: question.text, class: 'field__input', required: true });
    text.addEventListener('input', () => change(() => { question.text = text.value; }, text.id));

    const criticalBox = el('input', { type: 'checkbox', id: `${id}-critical`, checked: question.critical });
    criticalBox.addEventListener('change', () => change(() => { question.critical = criticalBox.checked; }, null, true));

    const answers = question.answers.map((answer, a) => {
      const answerText = el('input', { type: 'text', id: `${id}-answer-${a}`, value: answer.text, class: 'field__input' });
      answerText.addEventListener('input', () => change(() => { answer.text = answerText.value; }, answerText.id));
      const correct = el('input', { type: 'checkbox', id: `${id}-correct-${a}`, checked: answer.correct });
      correct.addEventListener('change', () => change(() => { answer.correct = correct.checked; }, null));
      const moveAnswer = (delta) => change(() => {
        const list = question.answers;
        [list[a], list[a + delta]] = [list[a + delta], list[a]];
      }, null, true);
      return el(
        'li',
        { class: 'quiz-editor__answer' },
        el('span', { class: 'quiz-editor__correct' }, correct, el('label', { for: correct.id }, 'richtig')),
        el('label', { for: answerText.id, class: 'visually-hidden' }, `Antwort ${a + 1}`),
        answerText,
        el('span', { class: 'quiz-editor__tools' },
          el('button', { type: 'button', class: 'card__tool', disabled: a === 0, 'aria-label': `Antwort ${a + 1} nach oben`, onclick: () => moveAnswer(-1) }, '↑'),
          el('button', { type: 'button', class: 'card__tool', disabled: a === question.answers.length - 1, 'aria-label': `Antwort ${a + 1} nach unten`, onclick: () => moveAnswer(1) }, '↓'),
          el('button', { type: 'button', class: 'card__tool', 'aria-label': `Antwort ${a + 1} entfernen`, onclick: () => change(() => question.answers.splice(a, 1), null, true) }, '✕'),
        ),
      );
    });

    const explanation = el('textarea', { id: `${id}-explanation`, rows: 3, class: 'field__input', required: true }, question.explanation);
    explanation.addEventListener('input', () => change(() => { question.explanation = explanation.value; }, explanation.id));

    const known = question.pageRef === '' || pageTitles.includes(question.pageRef);
    const pageRef = el(
      'select',
      { id: `${id}-ref`, class: 'field__input' },
      el('option', { value: '' }, '(kein Verweis)'),
      pageTitles.map((title) => el('option', { value: title, selected: title === question.pageRef }, title)),
      known ? null : el('option', { value: question.pageRef, selected: true }, `Nicht gefunden: ${question.pageRef}`),
    );
    pageRef.addEventListener('change', () => change(() => { question.pageRef = pageRef.value; }, null));

    const moveQuestion = (delta) => change(() => {
      const list = data.questions;
      [list[q], list[q + delta]] = [list[q + delta], list[q]];
    }, null, true);

    return el(
      'li',
      { class: 'quiz-editor__question' },
      el(
        'fieldset',
        { class: 'field-list__fieldset' },
        el('legend', {}, `Frage ${q + 1}`, question.critical ? el('span', { class: 'quiz-editor__badge' }, 'Sicherheitsfrage') : null),
        el('div', { class: 'field' }, el('label', { for: text.id }, 'Fragetext'), text),
        el('div', { class: 'field field--inline' }, criticalBox, el('label', { for: criticalBox.id }, 'Sicherheitskritisch: wird immer gestellt und muss richtig sein')),
        el('fieldset', { class: 'quiz-editor__answers' }, el('legend', {}, 'Antworten (mehrere richtige möglich)'), el('ul', { class: 'quiz-editor__answer-list' }, answers),
          el('button', { type: 'button', class: 'button button--small', onclick: () => change(() => question.answers.push({ text: '', correct: false }), null, true) }, '+ Antwort')),
        el('div', { class: 'field' }, el('label', { for: explanation.id }, 'Erklärung (Pflicht)'), el('p', { class: 'field__hint' }, 'Erscheint nach dem Antworten: Warum ist die richtige Antwort richtig?'), explanation),
        el('div', { class: 'field' }, el('label', { for: pageRef.id }, 'Seite zum Nachlesen'), pageRef),
        el('div', { class: 'field-list__actions' },
          el('button', { type: 'button', class: 'button button--small', disabled: q === 0, 'aria-label': `Frage ${q + 1} nach oben`, onclick: () => moveQuestion(-1) }, '↑'),
          el('button', { type: 'button', class: 'button button--small', disabled: q === data.questions.length - 1, 'aria-label': `Frage ${q + 1} nach unten`, onclick: () => moveQuestion(1) }, '↓'),
          el('button', { type: 'button', class: 'button button--small', onclick: () => change(() => data.questions.splice(q + 1, 0, structuredClone(question)), null, true) }, 'Duplizieren'),
          el('button', { type: 'button', class: 'button button--small', onclick: () => change(() => data.questions.splice(q, 1), null, true) }, 'Entfernen'),
        ),
      ),
    );
  });

  const addQuestion = el('button', { type: 'button', class: 'button button--small' }, '+ Frage hinzufügen');
  addQuestion.addEventListener('click', () => {
    change(() => data.questions.push({ text: '', critical: false, answers: [{ text: '', correct: true }, { text: '', correct: false }], explanation: '', pageRef: '' }), null, true);
    document.getElementById(`${prefix}-${data.questions.length - 1}-text`)?.focus();
  });

  return el(
    'section',
    { class: 'canvas stack' },
    el('h2', { class: 'editor-column__title', tabindex: -1 }, `Quiz · ${model.meta.kurztitel || model.meta.titel}`),
    quizChanged(editor, entry) ? versionNotice(editor, entry) : null,
    el('p', { class: 'quiz-editor__pool' }, `Pool: ${data.questions.length} Fragen (davon ${critical} Sicherheitsfragen) · gezeigt werden ${shown}`),
    el('div', { class: 'field' }, el('label', { for: countInput.id }, 'Anzahl gezogener normaler Fragen (anzahl=)'), el('p', { class: 'field__hint' }, 'Sicherheitsfragen kommen immer zusätzlich dazu. Empfohlen: Pool mindestens 8 Fragen (Sicherheitskapitel 12).'), countInput),
    el('ol', { class: 'quiz-editor__list' }, questions),
    addQuestion,
  );
}
