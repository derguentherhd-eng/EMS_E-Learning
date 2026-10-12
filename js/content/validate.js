/*
 * validate.js – Inhalte prüfen und verständliche Meldungen erzeugen
 *
 * Die Prüfung ist das wichtigste Wartungswerkzeug: Sie sagt in Klartext, was in welcher Datei
 * und Zeile nicht stimmt und was man tun kann. Benutzt wird sie von
 *   – pruefen.html   (vollständige Liste aller Meldungen),
 *   – dem Editor      (Live-Hinweise mit Sprung zum Element, zusätzlich didaktische Hinweise),
 *   – dem Kurs        (zeigt bei schweren Fehlern einen Hinweis statt abzustürzen).
 *
 * Schweregrade:
 *   fehler   – etwas funktioniert nicht (z. B. Quizfrage ohne richtige Antwort)
 *   warnung  – funktioniert, ist aber vermutlich nicht gewollt (z. B. nicht freigegeben)
 *   hinweis  – Verbesserungsvorschlag oder offener Platzhalter ({{TODO}}, kind: 'todo')
 *
 * Jede Meldung kann ein Sprungziel haben: ref = {chapterId, page, element}
 *   page: Seitenindex (ab 0), -1 = Text vor der ersten Seite, 'quiz' = Quiz
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Prüfregel: in validateChapter() oder validateCourse() ergänzen, in tests.html
 *     einen Testfall anlegen, in docs/PFLEGE.md („Prüfseite benutzen") die Meldung erklären.
 */

import { getBlock } from '../blocks/registry.js';
import { findGlossaryEntry, isReleased, isSafetyChapter } from './documents.js';
import { countWords, parseMarkdown, walkMarkdown } from './markdown.js';

const TODO_PATTERN = /\{\{\s*TODO:?\s*([\s\S]*?)\s*\}\}/gi;
const GLOSSARY_PATTERN = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
const SAFE_LINK = /^(https?:|mailto:|#|\.{0,2}\/|[^:]*$)/i;

/**
 * @typedef {Object} ValidateOptions
 * @property {boolean} [didactic]  zusätzlich didaktische Hinweise (Editor)
 * @property {Object<string,string>} [sources]  Originaltexte je Pfad: {{TODO}} wird dann mit
 *           exakter Zeilennummer aus dem Text gesucht (Prüfseite). Ohne: aus dem Datenmodell.
 */

/**
 * Prüft den ganzen Kurs.
 * @param {import('./loader.js').CourseModel} course
 * @param {ValidateOptions} [options]
 * @returns {import('./frontmatter.js').ValidationError[]}
 */
export function validateCourse(course, options = {}) {
  const errors = [...course.errors];
  const coursePath = 'content/kurs.md';
  const meta = course.meta;

  const requireText = (key, severity, fix) => {
    if (meta[key] === undefined || String(meta[key]).trim() === '') {
      errors.push({ file: coursePath, line: 0, severity, message: `In kurs.md fehlt der Eintrag „${key}".`, fix });
    }
  };
  requireText('titel', 'fehler', 'Ergänze z. B. „titel: Rookie-Onboarding".');
  requireText('kursversion', 'fehler', 'Ergänze z. B. „kursversion: 1.0".');
  requireText('zertifikat-titel', 'warnung', 'Ergänze z. B. „zertifikat-titel: Onboarding abgeschlossen".');
  requireText('zertifikat-unterschrift-name', 'warnung', 'Name der Person, die das Zertifikat „unterschreibt".');
  requireText('zertifikat-unterschrift-rolle', 'warnung', 'Rolle dieser Person, z. B. Teamleitung.');

  checkNumber(errors, coursePath, meta, 'bestehensgrenze', 1, 100, false);
  checkNumber(errors, coursePath, meta, 'qualifying-fragen', 1, 50, false);

  if (meta.kapitel.length === 0) {
    errors.push({ file: coursePath, line: 0, severity: 'fehler', message: 'Die Kapitelliste in kurs.md ist leer.', fix: 'Trage unter „kapitel:" mindestens eine Datei ein, z. B. „  - 01-formula-student.md".' });
  }

  // Qualifying braucht genug Fragen.
  const poolSize = course.chapters.reduce((sum, chapter) => sum + (chapter.quiz?.data.questions.length ?? 0), 0);
  const wanted = Number(meta['qualifying-fragen'] ?? 8);
  if (course.chapters.length > 0 && poolSize < wanted) {
    errors.push({ file: coursePath, line: 0, severity: 'warnung', message: `Das Qualifying soll ${wanted} Fragen stellen, alle Quizpools zusammen haben aber nur ${poolSize}.`, fix: 'Ergänze Quizfragen oder verringere „qualifying-fragen".' });
  }

  // Willkommenstext
  if (options.sources?.[coursePath]) {
    errors.push(...todosFromSource(coursePath, options.sources[coursePath]));
  } else {
    errors.push(...todosFromText(coursePath, `${Object.values(meta).flat().join('\n')}\n${course.welcome}`, 0, null));
  }
  errors.push(...checkMarkdown(course.welcome, course.welcomeLine ?? 1, coursePath, course.glossary, null, options.sources));

  // Glossar
  const terms = new Map();
  for (const entry of course.glossary) {
    if (!('term' in entry)) continue;
    const key = entry.term.toLocaleLowerCase('de');
    if (terms.has(key)) {
      errors.push({ file: 'content/glossar.md', line: entry.line ?? 0, severity: 'warnung', message: `Der Begriff „${entry.term}" steht doppelt im Glossar.`, fix: `Lösche einen der beiden Einträge (der andere steht in Zeile ${terms.get(key)}).` });
    } else {
      terms.set(key, entry.line ?? 0);
    }
  }
  if (options.sources?.['content/glossar.md']) {
    errors.push(...todosFromSource('content/glossar.md', options.sources['content/glossar.md']));
  }

  for (const chapter of course.chapters) {
    errors.push(...validateChapter(chapter, course, options));
  }
  return errors;
}

/**
 * Prüft ein einzelnes Kapitel.
 * @param {import('./documents.js').ChapterModel} chapter
 * @param {{glossary: Object[], meta: Object}} course
 * @param {ValidateOptions} [options]
 * @returns {import('./frontmatter.js').ValidationError[]}
 */
export function validateChapter(chapter, course, options = {}) {
  const errors = [...chapter.errors];
  const file = chapter.path;
  const meta = chapter.meta;
  const ref = (page, element) => ({ chapterId: chapter.id, page, element });

  // ── Kopfbereich ──
  for (const key of ['titel', 'kurztitel']) {
    if (meta[key] === undefined || String(meta[key]).trim() === '') {
      errors.push({ file, line: 1, severity: 'fehler', message: `Im Kopfbereich fehlt „${key}".`, fix: key === 'kurztitel' ? 'Der Kurztitel erscheint in der Sektoranzeige, z. B. „kurztitel: Formula Student".' : 'Ergänze z. B. „titel: Was ist Formula Student?".', ref: ref(null, null) });
    }
  }
  checkNumber(errors, file, meta, 'dauer', 1, 120, true, ref(null, null));
  checkNumber(errors, file, meta, 'version', 1, 9999, true, ref(null, null), true);
  checkNumber(errors, file, meta, 'bestehensgrenze', 1, 100, false, ref(null, null));
  if (meta.lernziele.length === 0) {
    errors.push({ file, line: 1, severity: 'hinweis', message: 'Das Kapitel hat keine Lernziele.', fix: 'Lernziele stehen auf der ersten Seite und sagen, was man nach dem Kapitel kann.', ref: ref(null, null) });
  }
  if (isSafetyChapter(chapter) && !isReleased(chapter)) {
    errors.push({ file, line: 1, severity: 'warnung', message: 'Dieses Sicherheitskapitel ist noch nicht freigegeben (freigegeben: nein).', fix: 'Inhalte von der Werkstattleitung bzw. den Sicherheitsverantwortlichen prüfen lassen und dann „freigegeben: ja" setzen. Siehe docs/PFLEGE.md, Abschnitt „Sicherheitskapitel".', ref: ref(null, null) });
  }

  // ── Seiten ──
  if (chapter.pages.length === 0) {
    errors.push({ file, line: 1, severity: 'fehler', message: 'Das Kapitel hat keine Seite.', fix: 'Jede Seite beginnt mit einer Zeile „## Seitentitel".' });
  }
  if (chapter.preamble.some((element) => element.type !== 'text' || element.markdown.trim() !== '')) {
    errors.push({ file, line: chapter.preamble[0]?.line ?? 1, severity: 'warnung', message: 'Vor der ersten Seite („## …") steht Inhalt.', fix: 'Dieser Inhalt erscheint oben auf Seite 1. Besser: eine eigene Seite mit „## Titel" davor setzen.', ref: ref(-1, 0) });
  }
  const titles = new Map();
  chapter.pages.forEach((page, pageIndex) => {
    if (page.title === '') {
      errors.push({ file, line: page.line, severity: 'fehler', message: `Seite ${pageIndex + 1} hat keinen Titel.`, fix: 'Schreibe den Titel hinter „## ".', ref: ref(pageIndex, null) });
    }
    const key = page.title.toLocaleLowerCase('de');
    if (titles.has(key)) {
      errors.push({ file, line: page.line, severity: 'warnung', message: `Der Seitentitel „${page.title}" kommt zweimal vor.`, fix: 'Gib jeder Seite einen eigenen Titel – Quizverweise (~) finden sonst nur die erste.', ref: ref(pageIndex, null) });
    }
    titles.set(key, pageIndex);
  });

  // ── Elemente ──
  let interactiveCount = 0;
  const sections = [{ index: -1, elements: chapter.preamble }, ...chapter.pages.map((page, index) => ({ index, elements: page.elements, page }))];
  for (const section of sections) {
    let pageInteractive = 0;
    let pageWords = 0;
    section.elements.forEach((element, elementIndex) => {
      const where = ref(section.index, elementIndex);
      if (element.type === 'raw') {
        errors.push(...element.errors.map((error) => ({ ...error, file, ref: where })));
        errors.push({ file, line: element.line, severity: 'fehler', message: 'Dieser Abschnitt kann nicht angezeigt werden (siehe Meldung davor). Im Kurs erscheint stattdessen ein Hinweiskasten.', fix: 'Im Editor: Element auswählen → „Im Quelltext bearbeiten". Von Hand: Abschnitt mit der Vorlage in docs/BAUSTEINE.md vergleichen.', ref: where });
        return;
      }
      if (element.type === 'text') {
        pageWords += countWords(element.markdown);
        errors.push(...checkMarkdown(element.markdown, element.line, file, course.glossary, where, options.sources));
        return;
      }
      if (element.type === 'image') {
        if (element.src.trim() === '') {
          errors.push({ file, line: element.line, severity: 'fehler', message: 'Ein Bild-Element hat noch keine Bilddatei.', fix: 'Im Editor „Bild wählen …" benutzen oder den Pfad eintragen, z. B. ![Beschreibung](assets/bilder/foto.webp).', ref: where });
        }
        if (element.alt.trim() === '') {
          errors.push({ file, line: element.line, severity: 'fehler', message: `Dem Bild „${element.src}" fehlt der Alternativtext.`, fix: 'Beschreibe in den eckigen Klammern, was auf dem Bild zu sehen ist: ![Beschreibung](pfad). Menschen mit Screenreader hören diesen Text.', ref: where });
        }
        return;
      }
      // Baustein
      const definition = getBlock(element.name);
      if (element.name === 'quiz') {
        errors.push({ file, line: element.line, severity: 'fehler', message: 'Dieses Kapitel enthält mehr als ein Quiz.', fix: 'Pro Kapitel gibt es genau ein Quiz am Ende. Führe die Fragen in einem :::quiz zusammen.', ref: where });
        return;
      }
      if (definition?.interactive) {
        interactiveCount += 1;
        pageInteractive += 1;
      }
      const rawLike = { name: element.name, file, line: element.line };
      errors.push(...(element.warnings ?? []).map((error) => ({ ...error, file, ref: where })));
      errors.push(...(definition?.validate?.(element.data, rawLike) ?? []).map((error) => ({ ...error, ref: where })));
      errors.push(...checkStrings(element.data, element.line, file, course.glossary, where, options.sources));
      pageWords += countWords(collectStrings(element.data).join(' '));
    });

    if (options.didactic && section.page) {
      if (pageInteractive === 0 && section.elements.length > 0) {
        errors.push({ file, line: section.page.line, severity: 'hinweis', message: `Seite „${section.page.title}" hat kein interaktives Element.`, fix: 'Nicht jede Seite braucht eins – aber Abwechslung hält die Aufmerksamkeit. Wie wäre eine Frage oder Zuordnung?', ref: ref(section.index, null) });
      }
      if (pageWords > 250) {
        errors.push({ file, line: section.page.line, severity: 'hinweis', message: `Seite „${section.page.title}" ist mit ca. ${pageWords} Wörtern lang.`, fix: 'Eine Idee pro Bildschirm: Teile die Seite auf oder kürze sie (Richtwert: höchstens 250 Wörter).', ref: ref(section.index, null) });
      }
    }
  }
  if (chapter.pages.length > 0 && interactiveCount < 2) {
    errors.push({ file, line: 1, severity: 'hinweis', message: `Das Kapitel hat nur ${interactiveCount} interaktive(n) Baustein(e).`, fix: 'Didaktische Regel: mindestens zwei Bausteine, die Denken verlangen (z. B. zuordnen, reihenfolge, szenario).', ref: ref(null, null) });
  }

  // ── Quiz ──
  if (!chapter.quiz) {
    errors.push({ file, line: 1, severity: 'fehler', message: 'Das Kapitel hat kein Quiz.', fix: 'Ohne Quiz kann das Kapitel nicht bestanden werden. Füge am Ende einen Baustein :::quiz ein (Vorlage: docs/BAUSTEINE.md).' });
  } else {
    const quiz = chapter.quiz;
    const where = ref('quiz', null);
    const rawLike = { name: 'quiz', file, line: quiz.line };
    errors.push(...getBlock('quiz').validate(quiz.data, rawLike).map((error) => ({ ...error, ref: where })));
    errors.push(...checkStrings(quiz.data, quiz.line, file, course.glossary, where, options.sources));
    for (const question of quiz.data.questions) {
      if (question.pageRef && !titles.has(question.pageRef.toLocaleLowerCase('de'))) {
        errors.push({ file, line: question.refLine ?? question.line ?? quiz.line, severity: 'fehler', message: `Der Verweis „~ ${question.pageRef}" zeigt auf eine Seite, die es in diesem Kapitel nicht gibt.`, fix: 'Schreibe den Seitentitel genau so, wie er hinter „## " steht.', ref: where });
      }
    }
    if (options.didactic) {
      const minimum = isSafetyChapter(chapter) ? 12 : 8;
      if (quiz.data.questions.length < minimum) {
        errors.push({ file, line: quiz.line, severity: 'hinweis', message: `Der Quizpool hat ${quiz.data.questions.length} Fragen (empfohlen: mindestens ${minimum}).`, fix: 'Ein großer Pool sorgt dafür, dass ein zweiter Versuch andere Fragen bringt.', ref: where });
      }
    }
  }

  // ── Platzhalter aus dem Originaltext (exakte Zeilen), sonst aus dem Modell ──
  if (options.sources?.[file]) {
    errors.push(...todosFromSource(file, options.sources[file]));
  } else {
    errors.push(...todosFromText(file, Object.values(meta).flat().join('\n'), 1, ref(null, null)));
  }
  return errors;
}

/**
 * Sammelt alle Bildpfade des Kurses (für die Prüfung, ob die Dateien existieren).
 * @param {import('./loader.js').CourseModel} course
 * @returns {{src:string, file:string, line:number, ref:Object|null}[]}
 */
export function collectImages(course) {
  const images = [];
  if (course.meta.logo) images.push({ src: String(course.meta.logo), file: 'content/kurs.md', line: 0, ref: null });
  for (const chapter of course.chapters) {
    const sections = [{ index: -1, elements: chapter.preamble }, ...chapter.pages.map((page, index) => ({ index, elements: page.elements }))];
    for (const section of sections) {
      section.elements.forEach((element, elementIndex) => {
        const ref = { chapterId: chapter.id, page: section.index, element: elementIndex };
        if (element.type === 'image' && element.src) images.push({ src: element.src, file: chapter.path, line: element.line, ref });
        if (element.type === 'text') {
          walkMarkdown(parseMarkdown(element.markdown, element.line), (node, line) => {
            if (node.type === 'figure' || node.type === 'image') images.push({ src: node.src, file: chapter.path, line, ref });
          });
        }
        if (element.type === 'block') {
          for (const src of getBlock(element.name)?.images?.(element.data) ?? []) {
            images.push({ src, file: chapter.path, line: element.line, ref });
          }
        }
      });
    }
  }
  return images.filter((image) => image.src && !/^(https?:|data:)/i.test(image.src));
}

/**
 * Zusammenfassung für die Kopfzeile der Prüfseite.
 * @param {import('./frontmatter.js').ValidationError[]} errors
 * @returns {{fehler:number, warnung:number, hinweis:number, todo:number}}
 */
export function summarize(errors) {
  const summary = { fehler: 0, warnung: 0, hinweis: 0, todo: 0 };
  for (const error of errors) {
    if (error.kind === 'todo') summary.todo += 1;
    else summary[error.severity] += 1;
  }
  return summary;
}

/* ───────────────────────────── Hilfsfunktionen ───────────────────────────── */

/** Prüft Markdown-Text: Bilder ohne Alternativtext, unsichere Links, Glossarbegriffe, # -Überschriften. */
function checkMarkdown(markdown, startLine, file, glossary, ref, sources) {
  const errors = [];
  if (!markdown) return errors;
  walkMarkdown(parseMarkdown(markdown, startLine), (node, line) => {
    if ((node.type === 'figure' || node.type === 'image') && node.alt.trim() === '') {
      errors.push({ file, line, severity: 'fehler', message: `Dem Bild „${node.src}" fehlt der Alternativtext.`, fix: 'Beschreibe in den eckigen Klammern, was auf dem Bild zu sehen ist.', ref });
    }
    if (node.type === 'link' && !SAFE_LINK.test(node.href)) {
      errors.push({ file, line, severity: 'fehler', message: `Der Link „${node.href}" ist nicht erlaubt.`, fix: 'Erlaubt sind Adressen mit https://, http://, mailto: und Pfade innerhalb des Kurses.', ref });
    }
    if (node.type === 'glossary' && !findGlossaryEntry(glossary, node.term)) {
      errors.push(missingTerm(file, line, node.term, ref));
    }
    if (node.type === 'heading' && node.level < 3 && file !== 'content/kurs.md') {
      errors.push({ file, line, severity: 'warnung', message: 'Überschriften mit nur einem # werden nicht unterstützt.', fix: '„## " beginnt eine neue Seite, „### " ist eine Zwischenüberschrift.', ref });
    }
    if (node.type === 'todo' && !sources) {
      errors.push(todoError(file, line, node.text, ref));
    }
  });
  return errors;
}

/** Prüft alle Texte in Baustein-Daten auf Glossarbegriffe (und Platzhalter, falls kein Originaltext). */
function checkStrings(data, line, file, glossary, ref, sources) {
  const errors = [];
  for (const text of collectStrings(data)) {
    for (const match of text.matchAll(GLOSSARY_PATTERN)) {
      if (!findGlossaryEntry(glossary, match[1])) errors.push(missingTerm(file, line, match[1].trim(), ref));
    }
    if (!sources) errors.push(...todosFromText(file, text, line, ref, true));
  }
  return errors;
}

/** Sammelt rekursiv alle Texte aus einem Datenobjekt. */
function collectStrings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
}

function todosFromSource(file, source) {
  return todosFromText(file, source, 1, null);
}

/**
 * Findet {{TODO: …}} in einem Text.
 * @param {boolean} [sameLine]  true: alle Treffer bekommen startLine (Baustein-Daten)
 */
function todosFromText(file, text, startLine, ref, sameLine = false) {
  const errors = [];
  for (const match of text.matchAll(TODO_PATTERN)) {
    const offset = sameLine ? 0 : text.slice(0, match.index).split('\n').length - 1;
    errors.push(todoError(file, startLine + offset, match[1], ref));
  }
  return errors;
}

function todoError(file, line, text, ref) {
  return { file, line, severity: 'hinweis', kind: 'todo', message: `Offener Platzhalter: ${text || '(ohne Beschreibung)'}`, fix: 'Echten Inhalt einsetzen und den Platzhalter {{TODO: …}} löschen.', ref };
}

function missingTerm(file, line, term, ref) {
  return { file, line, severity: 'fehler', message: `Der Glossarbegriff „${term}" ist nicht im Glossar definiert.`, fix: `Lege ihn in content/glossar.md an („${term}: Erklärung.") oder korrigiere die Schreibweise.`, ref };
}

/** Prüft ein Zahlenfeld im Kopfbereich. */
function checkNumber(errors, file, meta, key, min, max, required, ref = null, integer = false) {
  const value = meta[key];
  if (value === undefined || value === '') {
    if (required) errors.push({ file, line: 1, severity: 'fehler', message: `Im Kopfbereich fehlt „${key}".`, fix: `Ergänze z. B. „${key}: ${key === 'version' ? 1 : 8}".`, ref });
    return;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) {
    errors.push({ file, line: 1, severity: 'fehler', message: `„${key}: ${value}" ist ungültig.`, fix: `Erlaubt ist eine ${integer ? 'ganze ' : ''}Zahl von ${min} bis ${max}.`, ref });
  }
}
