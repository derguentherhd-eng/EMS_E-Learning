/*
 * quiz-block.js – Baustein „quiz": Fragenpool am Ende eines Kapitels
 *
 * Kursdown (eine Leerzeile trennt die Fragen):
 *   :::quiz anzahl=5
 *   ? Welche Disziplin gehört zu den statischen?
 *   - [x] Business Plan Presentation
 *   - [ ] Skidpad
 *   > Bei den statischen Disziplinen fährt das Auto nicht.
 *   ~ Der Wettbewerb in 60 Sekunden
 *
 *   ?! Darfst du ohne Freigabe am Hochvoltsystem arbeiten?
 *   - [ ] Ja, wenn jemand dabei ist
 *   - [x] Nein, nie
 *   > Arbeiten am HV-System nur mit Qualifikation und ausdrücklicher Freigabe.
 *   :::
 *
 * Zeilen:  ?  Frage · ?! sicherheitskritische Frage (muss immer richtig sein, wird immer
 *          gestellt) · - [x] richtige / - [ ] falsche Antwort · > Erklärung (Pflicht) ·
 *          ~ Seitentitel zum Nachlesen (optional)
 * anzahl=N: So viele normale Fragen werden zufällig gezogen. Kritische kommen immer dazu.
 *
 * Dieses Modul kümmert sich nur um Lesen, Prüfen und Schreiben. Den Ablauf (Fragen ziehen,
 * bewerten, Ergebnis) macht js/quiz/quiz.js.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Zeilenart: in parse() erkennen, in serialize() schreiben, im Quiz-Editor
 *     (js/editor/quiz-editor.js) ein Feld ergänzen, Round-Trip-Test in tests.html ergänzen.
 */

(function () {
  'use strict';

const { el } = EM.require('js/dom.js');
const { blockError, formatBlock, formatHeader, oneLine } = EM.require('js/blocks/block-utils.js');

/**
 * @typedef {Object} QuizAnswer
 * @property {string} text
 * @property {boolean} correct
 */

/**
 * @typedef {Object} QuizQuestion
 * @property {string} text          Fragetext
 * @property {boolean} critical     true bei ?! (sicherheitskritisch)
 * @property {QuizAnswer[]} answers
 * @property {string} explanation   Erklärung, warum die Antwort richtig ist
 * @property {string} pageRef       Titel der Seite zum Nachlesen ('' = keiner)
 * @property {number} [line]        Zeile der Frage in der Datei (nur für Meldungen)
 * @property {number} [refLine]     Zeile des Seitenverweises (nur für Meldungen)
 */

/**
 * @typedef {Object} QuizData
 * @property {string} title
 * @property {number|null} count    anzahl=… (null = alle normalen Fragen)
 * @property {QuizQuestion[]} questions
 */

/** @type {import('./registry.js').BlockDefinition} */
const definition = {
  name: 'quiz',
  interactive: false, // zählt didaktisch nicht als Interaktion der Inhaltsseiten

  parse(raw) {
    const errors = [];
    const questions = [];
    let current = null;

    for (const { text, line } of raw.lines) {
      const trimmed = text.trim();
      if (trimmed === '') {
        current = null; // Leerzeile beendet die Frage
        continue;
      }
      const question = trimmed.match(/^\?(!?)\s*(.*)$/);
      if (question) {
        current = {
          text: question[2].trim(),
          critical: question[1] === '!',
          answers: [],
          explanation: '',
          pageRef: '',
          line,
        };
        questions.push(current);
        continue;
      }
      if (!current) {
        errors.push(
          blockError(raw, line, `Diese Zeile gehört zu keiner Frage: „${trimmed}"`, 'Jede Frage beginnt mit einer Zeile „? Fragetext" (oder „?! …" für Sicherheitsfragen). Zwischen Fragen steht eine Leerzeile.'),
        );
        continue;
      }
      const answer = trimmed.match(/^-\s*\[([ xX])\]\s*(.*)$/);
      if (answer) {
        current.answers.push({ text: answer[2].trim(), correct: answer[1].toLowerCase() === 'x' });
      } else if (trimmed.startsWith('>')) {
        const part = trimmed.replace(/^>\s?/, '').trim();
        current.explanation = current.explanation ? `${current.explanation} ${part}` : part;
      } else if (trimmed.startsWith('~')) {
        current.pageRef = trimmed.replace(/^~\s*/, '').trim();
        current.refLine = line;
      } else {
        errors.push(
          blockError(raw, line, `Diese Zeile verstehe ich nicht: „${trimmed}"`, 'Antworten beginnen mit „- [x]" (richtig) oder „- [ ]" (falsch), Erklärungen mit „>", Seitenverweise mit „~".'),
        );
      }
    }

    let count = null;
    if (raw.attrs.anzahl !== undefined) {
      count = Number(raw.attrs.anzahl);
      if (!Number.isInteger(count) || count < 1) {
        errors.push(blockError(raw, raw.line, `„anzahl=${raw.attrs.anzahl}" ist keine gültige Zahl.`, 'Schreibe z. B. anzahl=5.'));
        count = null;
      }
    }
    return { data: { title: raw.title, count, questions }, errors };
  },

  /**
   * Inhaltliche Prüfung (nicht tödlich: das Quiz bleibt im Editor bearbeitbar).
   * Der Seitenverweis (~) wird in validate.js geprüft, weil dafür das Kapitel nötig ist.
   * @param {QuizData} data
   */
  validate(data, raw) {
    const errors = [];
    if (data.questions.length === 0) {
      errors.push(blockError(raw, raw.line, 'Das Quiz enthält keine Fragen.', 'Füge mindestens eine Frage hinzu.'));
    }
    for (const question of data.questions) {
      const line = question.line ?? raw.line;
      const short = question.text.length > 50 ? `${question.text.slice(0, 50)} …` : question.text;
      if (question.text === '') {
        errors.push(blockError(raw, line, 'Eine Frage hat keinen Fragetext.', 'Schreibe den Text direkt hinter das Fragezeichen.'));
      }
      if (question.answers.length < 2) {
        errors.push(blockError(raw, line, `Die Frage „${short}" hat weniger als zwei Antworten.`, 'Ergänze Antworten mit „- [ ] Text".'));
      }
      if (!question.answers.some((answer) => answer.correct)) {
        errors.push(blockError(raw, line, `Die Frage „${short}" hat keine richtige Antwort.`, 'Markiere die richtige Antwort mit [x] statt [ ].'));
      }
      if (question.explanation === '') {
        errors.push(blockError(raw, line, `Die Frage „${short}" hat keine Erklärung.`, 'Ergänze eine Zeile „> Darum ist das richtig: …". Die Erklärung ist Pflicht, weil man aus ihr lernt.'));
      }
    }
    const normal = data.questions.filter((question) => !question.critical).length;
    if (data.count !== null && data.count > normal) {
      errors.push(
        blockError(raw, raw.line, `anzahl=${data.count}, aber der Pool hat nur ${normal} normale Fragen.`, `Ergänze Fragen oder setze anzahl auf höchstens ${normal}. Sicherheitsfragen (?!) zählen nicht zum Pool, sie werden immer zusätzlich gestellt.`),
      );
    }
    return errors;
  },

  /**
   * Im Kurs übernimmt js/views/quiz-view.js die Darstellung. Diese Fassung dient als
   * Zusammenfassung (z. B. wenn ein Quiz versehentlich mitten im Kapitel steht).
   * @param {QuizData} data
   */
  render(data) {
    return el('p', { class: 'notice' }, `Quiz mit ${data.questions.length} Fragen – es erscheint am Ende des Kapitels.`);
  },

  /** @param {QuizData} data */
  serialize(data) {
    const body = [];
    data.questions.forEach((question, index) => {
      if (index > 0) body.push('');
      body.push(`${question.critical ? '?!' : '?'} ${oneLine(question.text)}`);
      for (const answer of question.answers) {
        body.push(`- [${answer.correct ? 'x' : ' '}] ${oneLine(answer.text)}`);
      }
      if (question.explanation) body.push(`> ${oneLine(question.explanation)}`);
      if (question.pageRef) body.push(`~ ${oneLine(question.pageRef)}`);
    });
    return formatBlock(formatHeader('quiz', data.title, [['anzahl', data.count]]), body);
  },

  editor: {
    label: 'Quiz',
    description: 'Fragenpool am Kapitelende mit Erklärung zu jeder Antwort.',
    icon: 'assets/icons/quiz.svg',
    customEditor: 'quiz',
    createDefault: () => ({
      title: '',
      count: 5,
      questions: [
        {
          text: 'Neue Frage',
          critical: false,
          answers: [
            { text: 'Richtige Antwort', correct: true },
            { text: 'Falsche Antwort', correct: false },
          ],
          explanation: 'Erklärung, warum die Antwort richtig ist.',
          pageRef: '',
        },
      ],
    }),
    fields: [
      { key: 'count', type: 'number', label: 'Anzahl gezogener Fragen', min: 1, help: 'Sicherheitsfragen (?!) werden immer zusätzlich gestellt.' },
    ],
  },
};

EM.define('js/blocks/quiz-block.js', { default: definition });
})();
