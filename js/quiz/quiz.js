/*
 * quiz.js – Quiz- und Qualifying-Logik plus der Fragen-Ablauf auf dem Bildschirm
 *
 * Teil 1 – reine Logik (ohne DOM, getestet in tests.html):
 *   drawQuestions()    Fragen für ein Kapitelquiz ziehen: anzahl=N normale Fragen zufällig,
 *                      dazu IMMER alle Sicherheitsfragen (?!). Wer gerade durchgefallen ist,
 *                      bekommt bevorzugt andere Fragen als beim letzten Versuch.
 *   drawQualifying()   Fragen fürs Qualifying: erst je Kapitel eine, dann zufällig aus allen.
 *                      Keine Pflicht-Sicherheitsfragen (sie können aber gezogen werden).
 *   isAnswerCorrect()  Richtig nur, wenn GENAU die richtigen Antworten gewählt sind.
 *   scoreAttempt()     Prozent + bestanden? Bestanden = Grenze erreicht UND alle
 *                      Sicherheitsfragen richtig.
 *
 * Teil 2 – runQuiz(): zeigt eine Frage pro Bildschirm (Antwort wählen → „Antwort prüfen" →
 * Feedback mit Erklärung → „Weiter") und meldet am Ende alle Antworten zurück. Die Ansichten
 * js/views/quiz-view.js und js/views/qualifying.js bauen darauf auf.
 *
 * Wenn du hier etwas ändern willst …
 *   – Bewertungsregeln: scoreAttempt(); danach Tests in tests.html anpassen.
 */

import { el } from '../dom.js';
import { icon } from '../ui/icons.js';
import { renderInline } from '../render.js';
import { shuffle } from '../blocks/block-utils.js';

/**
 * Eine gezogene Frage mit Herkunft (für Ergebnisliste und Links zum Nachlesen).
 * @typedef {Object} DrawnQuestion
 * @property {import('../blocks/quiz-block.js').QuizQuestion} question
 * @property {Object} chapter        das Kapitel, aus dem die Frage stammt
 * @property {number} chapterIndex   Position des Kapitels (0 = Sektor 1)
 */

/**
 * Ergebnis einer beantworteten Frage.
 * @typedef {DrawnQuestion & {correct: boolean, selected: string[]}} AnsweredQuestion
 */

/* ─────────────────────────────── Teil 1: Logik ─────────────────────────────── */

/**
 * Zieht die Fragen für ein Kapitelquiz.
 * @param {import('../blocks/quiz-block.js').QuizData} quiz
 * @param {() => number} [random]
 * @param {Set<string>} [avoid]  Fragetexte des letzten Versuchs (werden möglichst vermieden)
 * @returns {import('../blocks/quiz-block.js').QuizQuestion[]}
 */
export function drawQuestions(quiz, random = Math.random, avoid = new Set()) {
  const critical = quiz.questions.filter((question) => question.critical);
  const normal = quiz.questions.filter((question) => !question.critical);
  const count = Math.min(quiz.count ?? normal.length, normal.length);
  const fresh = shuffle(normal.filter((question) => !avoid.has(question.text)), random);
  const repeated = shuffle(normal.filter((question) => avoid.has(question.text)), random);
  return shuffle([...critical, ...[...fresh, ...repeated].slice(0, count)], random);
}

/**
 * Zieht die Fragen fürs Qualifying: zuerst eine Frage je Kapitel (gemischtes Abfragen
 * festigt Wissen), dann zufällig aus allen übrigen, bis `count` erreicht ist.
 * @param {Object[]} chapters  aktive Kapitel mit Quiz
 * @param {number} count
 * @param {() => number} [random]
 * @returns {DrawnQuestion[]}
 */
export function drawQualifying(chapters, count, random = Math.random) {
  const pools = chapters
    .map((chapter, chapterIndex) => ({ chapter, chapterIndex, questions: shuffle(chapter.quiz?.data.questions ?? [], random) }))
    .filter((pool) => pool.questions.length > 0);
  const picked = [];
  for (const pool of shuffle(pools, random)) {
    if (picked.length >= count) break;
    picked.push({ question: pool.questions.shift(), chapter: pool.chapter, chapterIndex: pool.chapterIndex });
  }
  const rest = shuffle(
    pools.flatMap((pool) => pool.questions.map((question) => ({ question, chapter: pool.chapter, chapterIndex: pool.chapterIndex }))),
    random,
  );
  picked.push(...rest.slice(0, Math.max(0, count - picked.length)));
  return shuffle(picked, random);
}

/**
 * Ist eine Antwort richtig? Nur wenn genau die richtigen Antworten gewählt wurden.
 * @param {import('../blocks/quiz-block.js').QuizQuestion} question
 * @param {string[]} selected  Texte der gewählten Antworten
 * @returns {boolean}
 */
export function isAnswerCorrect(question, selected) {
  const correct = question.answers.filter((answer) => answer.correct).map((answer) => answer.text);
  return correct.length === selected.length && correct.every((text) => selected.includes(text));
}

/**
 * Bewertet einen Durchgang.
 * @param {{question: {critical: boolean}, correct: boolean}[]} answered
 * @param {number} threshold  Bestehensgrenze in Prozent
 * @returns {{correct: number, total: number, percent: number, passed: boolean, criticalFailed: number}}
 */
export function scoreAttempt(answered, threshold) {
  const total = answered.length;
  const correct = answered.filter((entry) => entry.correct).length;
  const criticalFailed = answered.filter((entry) => entry.question.critical && !entry.correct).length;
  const exact = total === 0 ? 0 : (correct / total) * 100;
  return {
    correct,
    total,
    percent: Math.floor(exact), // abrunden: 79,9 % wird nie als „80 %" angezeigt
    passed: total > 0 && exact >= threshold && criticalFailed === 0,
    criticalFailed,
  };
}

/* ─────────────────────────── Teil 2: Ablauf am Bildschirm ─────────────────────────── */

/**
 * Zeigt Fragen nacheinander in `container`.
 *
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {DrawnQuestion[]} options.questions
 * @param {(entry: DrawnQuestion) => string} options.label  Kopfzeile links, z. B. „Sektor 1 · Quiz"
 * @param {Object[]} options.glossary
 * @param {() => number} [options.random]
 * @param {(answered: AnsweredQuestion[]) => void} options.onFinish
 */
export function runQuiz(container, { questions, label, glossary, random = Math.random, onFinish }) {
  const answered = [];

  const showQuestion = (index) => {
    const entry = questions[index];
    const { question } = entry;
    const multiple = question.answers.filter((answer) => answer.correct).length > 1;
    const name = `frage-${index}-${Math.floor(random() * 1e6)}`;
    const feedback = el('div', { class: 'quiz__feedback', 'aria-live': 'polite' });
    const answers = shuffle(question.answers, random);
    const inputs = answers.map((answer, answerIndex) => {
      const id = `${name}-${answerIndex}`;
      const input = el('input', { type: multiple ? 'checkbox' : 'radio', name, id, value: answer.text, class: 'quiz__input' });
      const mark = el('span', { class: 'quiz__mark' });
      const option = el('label', { class: 'quiz__option', for: id }, input, el('span', { class: 'quiz__answer' }, renderInline(answer.text, { plainGlossary: true })), mark);
      return { answer, input, option, mark };
    });

    const checkButton = el('button', { type: 'submit', class: 'button button--primary' }, 'Antwort prüfen');
    const form = el(
      'form',
      { class: 'quiz__form', novalidate: true },
      el(
        'fieldset',
        { class: 'quiz__fieldset' },
        el('legend', { class: 'quiz__legend' }, el('h1', { class: 'quiz__question', tabindex: -1 }, renderInline(question.text, { plainGlossary: true }))),
        el('p', { class: 'quiz__hint' }, multiple ? 'Mehrere Antworten sind richtig.' : 'Eine Antwort ist richtig.'),
        el('div', { class: 'quiz__options' }, inputs.map((entry) => entry.option)),
      ),
      el('div', { class: 'block__actions' }, checkButton),
    );

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const selected = inputs.filter((entry) => entry.input.checked).map((entry) => entry.answer.text);
      if (selected.length === 0) {
        feedback.replaceChildren(el('p', { class: 'feedback feedback--hint' }, multiple ? 'Wähle mindestens eine Antwort.' : 'Wähle eine Antwort.'));
        return;
      }
      const correct = isAnswerCorrect(question, selected);
      answered.push({ ...entry, correct, selected });

      // Antworten sperren und markieren: richtige mit ✓, falsch gewählte mit ✕ (+ Text).
      for (const { answer, input, option, mark } of inputs) {
        input.disabled = true;
        if (answer.correct) {
          option.classList.add('is-correct');
          mark.replaceChildren(icon('check', 'quiz__mark-icon'), 'richtig');
        } else if (input.checked) {
          option.classList.add('is-wrong');
          mark.replaceChildren(icon('cross', 'quiz__mark-icon'), 'deine Wahl');
        }
      }
      const last = index === questions.length - 1;
      const next = el('button', { type: 'button', class: 'button button--primary' }, last ? 'Ergebnis ansehen' : 'Weiter');
      next.addEventListener('click', () => (last ? onFinish(answered) : showQuestion(index + 1)));
      checkButton.replaceWith(next);
      feedback.replaceChildren(
        el(
          'div',
          { class: `feedback feedback--${correct ? 'correct' : 'wrong'}` },
          el('p', {}, icon(correct ? 'check' : 'cross', 'feedback__icon'), el('strong', {}, correct ? 'Richtig.' : 'Nicht ganz.')),
          el('p', {}, renderInline(question.explanation, { glossary })),
        ),
      );
      next.focus();
    });

    container.replaceChildren(
      el(
        'div',
        { class: 'quiz stack' },
        el('div', { class: 'view-meta' }, el('p', {}, label(entry)), el('p', {}, `Frage ${index + 1} von ${questions.length}`)),
        question.critical
          ? el('p', { class: 'quiz__critical' }, icon('warning', 'quiz__critical-icon'), 'Sicherheitsfrage – muss richtig beantwortet werden')
          : null,
        form,
        feedback,
      ),
    );
    if (index > 0) {
      // Neue Frage: Fokus auf den Fragetext, damit Screenreader ihn sofort vorlesen.
      container.querySelector('h1')?.focus();
      window.scrollTo({ top: 0 });
    }
  };

  showQuestion(0);
}

/**
 * Ergebnis-Streifen wie ein Zeitenmonitor: ein Feld pro Frage, richtig/falsch.
 * Für Screenreader als Liste mit Text („Frage 1: richtig").
 * @param {AnsweredQuestion[]} answered
 * @returns {HTMLElement}
 */
export function renderResultStrip(answered) {
  return el(
    'ol',
    { class: 'result-strip', 'aria-label': 'Deine Antworten' },
    answered.map((entry, index) =>
      el(
        'li',
        { class: `result-strip__cell result-strip__cell--${entry.correct ? 'correct' : 'wrong'}` },
        icon(entry.correct ? 'check' : 'cross', 'result-strip__icon'),
        el('span', { class: 'visually-hidden' }, `Frage ${index + 1}: ${entry.correct ? 'richtig' : 'falsch'}${entry.question.critical ? ' (Sicherheitsfrage)' : ''}`),
      ),
    ),
  );
}
