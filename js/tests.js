/*
 * tests.js – Selbsttests (geladen von tests.html)
 *
 * Ohne Test-Framework: test('Name', () => { … }) registriert einen Test, assertEqual/assert
 * prüfen Erwartungen. Ein Test ist grün, wenn er ohne Ausnahme durchläuft.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neuer Baustein: in BLOCK_SAMPLES ein gültiges und ein ungültiges Beispiel ergänzen.
 *     Daraus entstehen automatisch Parser- und Round-Trip-Tests.
 *   – Neue Logik: einen test(...)-Block in der passenden Gruppe ergänzen.
 */

import { el } from './dom.js';
import { parseFrontmatter, serializeFrontmatter } from './content/frontmatter.js';
import { parseInline, parseMarkdown } from './content/markdown.js';
import { normalizeText, parseBlockHeader, parseBody, parseChapter, parseCourse, parseGlossary } from './content/documents.js';
import { serializeChapter, serializeCourse, serializeElement, serializeGlossary } from './content/serialize.js';
import { createFetchReader, loadCourse } from './content/loader.js';
import { validateChapter } from './content/validate.js';
import { getBlock, listBlocks } from './blocks/registry.js';
import { renderInline, renderMarkdown } from './render.js';
import { parseRoute } from './router.js';
import { drawQualifying, drawQuestions, isAnswerCorrect, scoreAttempt } from './quiz/quiz.js';
import {
  createEmptyState, createStore, getChapterStatus, isCertificateUnlocked, isQualifyingUnlocked,
  normalizeState, recordQualifying, recordQuizResult,
} from './store.js';
import { hashText } from './blocks/block-utils.js';
import { certificateFileName, createVerificationCode, formatGermanDate } from './certificate.js';

/* ───────────────────────────── Mini-Testrahmen ───────────────────────────── */

const tests = [];
let currentGroup = 'Allgemein';

/** Startet eine neue Gruppe (Überschrift in der Ergebnisliste). */
function group(name) {
  currentGroup = name;
}

/**
 * Registriert einen Test.
 * @param {string} name
 * @param {() => (void|Promise<void>)} fn
 */
function test(name, fn) {
  tests.push({ group: currentGroup, name, fn });
}

/** Wirft einen Fehler, wenn condition falsch ist. */
function assert(condition, message = 'Bedingung nicht erfüllt') {
  if (!condition) throw new Error(message);
}

/** Vergleicht zwei Werte inhaltlich (auch Objekte und Listen). */
function assertEqual(actual, expected, message = '') {
  const a = stableJson(actual);
  const b = stableJson(expected);
  if (a !== b) throw new Error(`${message ? `${message}: ` : ''}erwartet ${b}, erhalten ${a}`);
}

/** JSON mit sortierten Schlüsseln – damit {a,b} und {b,a} gleich sind. */
function stableJson(value) {
  return JSON.stringify(value, (key, inner) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(Object.keys(inner).sort().map((k) => [k, inner[k]]))
      : inner,
  );
}

/**
 * Entfernt Angaben, die sich beim Zurückschreiben ändern dürfen (Zeilennummern, Meldungen).
 * „Inhaltsgleich" heißt: nach dieser Bereinigung identisch.
 */
export function stripVolatile(value) {
  if (Array.isArray(value)) return value.map(stripVolatile);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !['line', 'refLine', 'warnings', 'errors', 'fatal', 'welcomeLine'].includes(key))
        .map(([key, inner]) => [key, stripVolatile(inner)]),
    );
  }
  return value;
}

/** Hilfsfunktion: Baustein-Text → Element (wie im Kapitel). */
function parseSingleElement(text) {
  const items = parseBody(text, 1, 'test.md').filter((item) => item.type !== 'page');
  assertEqual(items.length, 1, 'Anzahl Elemente');
  return items[0];
}

/** Hilfsfunktion: prüft parse(serialize(parse(text))) == parse(text) für ein Kapitel. */
function assertChapterRoundTrip(text, file = 'test.md') {
  const first = parseChapter(text, file);
  const second = parseChapter(serializeChapter(first), file);
  assertEqual(stripVolatile(second), stripVolatile(first), 'Round-Trip');
  // Zweimal geschrieben = identischer Text (kanonische Form ist stabil).
  assertEqual(serializeChapter(second), serializeChapter(first), 'Kanonische Form stabil');
}

/* ───────────────────────────── Kopfbereich ───────────────────────────── */

group('Kopfbereich (Frontmatter)');

test('liest Text, Zahlen und Listen', () => {
  const result = parseFrontmatter('---\ntitel: Was ist: FS?\ndauer: 8\nkursversion: 1.0\nlernziele:\n  - Eins\n  - Zwei\n---\nText');
  assertEqual(result.meta, { titel: 'Was ist: FS?', dauer: 8, kursversion: '1.0', lernziele: ['Eins', 'Zwei'] });
  assertEqual(result.body, 'Text');
  assertEqual(result.bodyStartLine, 9);
  assertEqual(result.errors, []);
});

test('meldet nicht geschlossenen Kopfbereich mit Zeile 1', () => {
  const result = parseFrontmatter('---\ntitel: X\n', 'a.md');
  assertEqual(result.errors.length, 1);
  assertEqual(result.errors[0].line, 1);
});

test('meldet ungültige Zeile mit richtiger Zeilennummer', () => {
  const result = parseFrontmatter('---\ntitel: X\ndas ist falsch\n---\n', 'a.md');
  assertEqual(result.errors.map((error) => error.line), [3]);
});

test('meldet doppelten Schlüssel und Listeneintrag ohne Schlüssel', () => {
  const result = parseFrontmatter('---\n  - lose\ntitel: A\ntitel: B\n---\n');
  assertEqual(result.errors.map((error) => error.line), [2, 4]);
});

test('Serializer: bevorzugte Reihenfolge, unbekannte Schlüssel bleiben', () => {
  const text = serializeFrontmatter({ extra: 'x', dauer: 8, titel: 'T', liste: [] }, ['titel', 'dauer']);
  assertEqual(text, '---\ntitel: T\ndauer: 8\nextra: x\nliste:\n---');
});

test('Round-Trip Kopfbereich', () => {
  const meta = { titel: 'Ä Ö Ü ß', dauer: 12, version: 3, kursversion: '1.0', lernziele: ['a', 'b: c'] };
  assertEqual(parseFrontmatter(`${serializeFrontmatter(meta)}\n`).meta, meta);
});

/* ───────────────────────────── Markdown ───────────────────────────── */

group('Markdown-Parser');

test('Inline: fett, kursiv, Code, Link, Glossar, Platzhalter', () => {
  const nodes = parseInline('A **f** *k* `c` [L](https://x.de) [[Begriff|Text]] {{TODO: Foto}}');
  assertEqual(
    nodes.map((node) => node.type),
    ['text', 'strong', 'text', 'em', 'text', 'code', 'text', 'link', 'text', 'glossary', 'text', 'todo'],
  );
  assertEqual(nodes[9], { type: 'glossary', term: 'Begriff', label: 'Text' });
  assertEqual(nodes[11], { type: 'todo', text: 'Foto' });
});

test('HTML in Inhalten bleibt Text (wird nicht interpretiert)', () => {
  const nodes = parseInline('<script>alert(1)</script><b>fett</b>');
  assertEqual(nodes, [{ type: 'text', value: '<script>alert(1)</script><b>fett</b>' }]);
  const blocks = parseMarkdown('<img src=x onerror=alert(1)>');
  assertEqual(blocks[0].children, [{ type: 'text', value: '<img src=x onerror=alert(1)>' }]);
});

test('„5 * 3 * 2" wird nicht kursiv', () => {
  assertEqual(parseInline('5 * 3 * 2'), [{ type: 'text', value: '5 * 3 * 2' }]);
});

test('Backslash hebt Sonderzeichen auf', () => {
  assertEqual(parseInline('\\*kein kursiv\\*'), [{ type: 'text', value: '*kein kursiv*' }]);
});

test('Blöcke: Überschrift, Listen (verschachtelt), Zitat, Tabelle, Bild, Platzhalter', () => {
  const text = [
    '### Zwischen',
    '',
    '- eins',
    '  - eins-a',
    '- zwei',
    '',
    '1. erstens',
    '2. zweitens',
    '',
    '> Zitat',
    '',
    '| A | B |',
    '|---|---|',
    '| 1 | 2 \\| 3 |',
    '',
    '![Alt](assets/x.svg "Unterschrift")',
    '',
    '{{TODO: Text folgt}}',
  ].join('\n');
  const blocks = parseMarkdown(text, 10);
  assertEqual(blocks.map((block) => block.type), ['heading', 'list', 'list', 'blockquote', 'table', 'figure', 'todo']);
  assertEqual(blocks[0].line, 10);
  assertEqual(blocks[1].items.length, 2);
  assert(blocks[1].items[0].sublist?.items.length === 1, 'Unterliste fehlt');
  assertEqual(blocks[2].ordered, true);
  assertEqual(blocks[4].rows[0][1], [{ type: 'text', value: '2 | 3' }]);
  assertEqual(blocks[5], { type: 'figure', alt: 'Alt', src: 'assets/x.svg', caption: 'Unterschrift', line: 25 });
});

/* ───────────────────────────── Darstellung ───────────────────────────── */

group('Darstellung (Renderer) und Router');

test('HTML aus Inhalten erscheint als Text, nie als Element', () => {
  const box = el('div', {}, renderMarkdown('<b>fett</b> <img src=x onerror=alert(1)>\n\n<script>alert(1)</script>'));
  assertEqual(box.querySelectorAll('b, img, script').length, 0, 'eingeschleuste Elemente');
  assert(box.textContent.includes('<script>alert(1)</script>'), 'Text fehlt');
});

test('javascript:-Links werden nicht zu Links', () => {
  const box = el('div', {}, renderInline('[klick](javascript:alert%281%29)'));
  assertEqual(box.querySelectorAll('a').length, 0);
  assertEqual(box.textContent, 'klick');
});

test('Externe Links öffnen im neuen Tab und sagen das', () => {
  const link = el('div', {}, renderInline('[FS](https://example.org)')).querySelector('a');
  assertEqual(link?.getAttribute('target'), '_blank');
  assert(link.getAttribute('rel').includes('noopener'), 'rel=noopener fehlt');
  assert(link.textContent.includes('neuem Tab'), 'Hinweis fehlt');
});

test('Überschriften: ### im Kapitel wird zu <h2>', () => {
  const box = el('div', {}, renderMarkdown('### Zwischen', { headingShift: -1 }));
  assertEqual(box.firstElementChild.tagName, 'H2');
});

test('Router: alle Routen', () => {
  assertEqual(parseRoute('').name, 'start');
  assertEqual(parseRoute('#/kapitel/01-a/3').params, { id: '01-a', page: 3 });
  assertEqual(parseRoute('#/kapitel/01-a').params.page, 1);
  assertEqual(parseRoute('#/kapitel/01-a/quiz').name, 'quiz');
  assertEqual(parseRoute('#/glossar/Endurance').params, { term: 'Endurance' });
  assertEqual(parseRoute('#/zertifikat').name, 'certificate');
  assertEqual(parseRoute('#/kapitel/01-a/0').name, 'notfound');
  assertEqual(parseRoute('#main'), null);
});

/* ───────────────────────────── Kapitelstruktur ───────────────────────────── */

group('Kapitelstruktur');

const SAMPLE_CHAPTER = `---
titel: Test
kurztitel: T
dauer: 5
version: 2
unbekannt: bleibt
lernziele:
  - Ziel
---

## Seite eins

Absatz eins.

Absatz zwei.

![Ein Bild](assets/bilder/a.svg)

:::info Titel
Hinweis
:::

## Seite zwei

:::quiz anzahl=1
? Frage
- [x] Ja
- [ ] Nein
> Weil.
~ Seite eins
:::
`;

test('Seiten, Elemente und Quiz werden erkannt', () => {
  const chapter = parseChapter(SAMPLE_CHAPTER, '07-test.md');
  assertEqual(chapter.id, '07-test');
  assertEqual(chapter.pages.map((page) => page.title), ['Seite eins', 'Seite zwei']);
  assertEqual(chapter.pages[0].elements.map((element) => element.type), ['text', 'image', 'block']);
  assertEqual(chapter.pages[0].elements[0].markdown, 'Absatz eins.\n\nAbsatz zwei.');
  assertEqual(chapter.pages[1].elements, []);
  assertEqual(chapter.quiz?.data.questions.length, 1);
  assertEqual(chapter.meta.unbekannt, 'bleibt');
});

test('Baustein-Kopfzeile: Titel und Attribute', () => {
  assertEqual(parseBlockHeader(' Unser Drive bild="a b.svg" x=1'), { title: 'Unser Drive', attrs: { bild: 'a b.svg', x: '1' } });
});

test('Windows-Zeilenenden und BOM werden vereinheitlicht', () => {
  assertEqual(normalizeText('﻿a\r\nb\rc'), 'a\nb\nc');
  assertChapterRoundTrip(SAMPLE_CHAPTER.replace(/\n/g, '\r\n'));
});

test('Round-Trip Beispielkapitel', () => assertChapterRoundTrip(SAMPLE_CHAPTER));

test('Unbekannter Baustein bleibt als nicht lesbarer Abschnitt erhalten', () => {
  const text = '---\ntitel: X\n---\n\n## S\n\n:::gibtsnicht Titel\nInhalt bleibt\n:::\n';
  const chapter = parseChapter(text, 'x.md');
  const raw = chapter.pages[0].elements[0];
  assertEqual(raw.type, 'raw');
  assertEqual(raw.text, ':::gibtsnicht Titel\nInhalt bleibt\n:::');
  assert(serializeChapter(chapter).includes(':::gibtsnicht Titel\nInhalt bleibt\n:::'), 'Rohtext fehlt beim Speichern');
});

test('Nicht geschlossener Baustein: Meldung mit Zeile, Inhalt bleibt erhalten', () => {
  const text = '---\ntitel: X\n---\n\n## S\n\n:::info\nOffen\n\nNoch Text\n';
  const chapter = parseChapter(text, 'x.md');
  const raw = chapter.pages[0].elements[0];
  assertEqual(raw.type, 'raw');
  assertEqual(raw.errors[0].line, 7);
  assert(serializeChapter(chapter).includes(':::info\nOffen\n\nNoch Text'), 'Inhalt verloren');
});

/* ───────────────────────── Fehlerhafte Testdatei ───────────────────────── */

group('Prüfung einer absichtlich fehlerhaften Datei');

const BROKEN_CHAPTER = [
  '---', //                                   1
  'titel: Kaputt', //                         2
  'dauer: viel', //                           3  ← keine Zahl
  'version: 1', //                            4
  '---', //                                   5
  '', //                                      6
  '## Seite', //                              7
  '', //                                      8
  'Begriff [[Gibtsnicht]] und ![](assets/bilder/x.svg)', // 9 ← Glossar, Alternativtext
  '', //                                      10
  ':::karten', //                             11 ← (noch) unbekannt oder kaputt
  'ohne Trenner', //                          12
  ':::', //                                   13
  '', //                                      14
  ':::quiz anzahl=3', //                      15 ← Pool zu klein
  '? Frage ohne richtige Antwort', //         16
  '- [ ] A', //                               17
  '- [ ] B', //                               18
  '~ Gibt es nicht', //                       19 ← Verweis falsch, Erklärung fehlt
  ':::', //                                   20
].join('\n');

test('Meldungen haben Klartext und richtige Zeilennummern', () => {
  const chapter = parseChapter(BROKEN_CHAPTER, '99-kaputt.md');
  const errors = validateChapter(chapter, { glossary: [], meta: {} });
  const find = (part) => errors.find((error) => error.message.includes(part));
  assertEqual(find('kurztitel')?.severity, 'fehler', 'kurztitel fehlt');
  assertEqual(find('„dauer: viel"')?.line, 1, 'dauer ungültig');
  assertEqual(find('Gibtsnicht')?.line, 9, 'Glossar');
  assertEqual(find('Alternativtext')?.line, 9, 'Alternativtext');
  assertEqual(find('keine richtige Antwort')?.line, 16, 'richtige Antwort');
  assertEqual(find('keine Erklärung')?.line, 16, 'Erklärung');
  assertEqual(find('Gibt es nicht')?.line, 19, 'Seitenverweis');
  assertEqual(find('anzahl=3')?.line, 15, 'Pool');
  assert(errors.some((error) => error.line === 11 && error.severity === 'fehler'), 'Baustein Zeile 11');
  assert(errors.every((error) => error.fix !== undefined), 'Jede Meldung braucht einen Lösungsvorschlag');
});

/* ───────────────────────────── Bausteine ───────────────────────────── */

group('Bausteine: Parser und Round-Trip');

/**
 * Beispiele je Baustein: valid = gültiger Text (muss lesbar sein und den Round-Trip bestehen),
 * invalid = Text mit Syntaxfehler (muss als nicht lesbarer Abschnitt erhalten bleiben).
 * Bausteine ohne mögliche Syntaxfehler haben invalid: null.
 */
const BLOCK_SAMPLES = {
  info: { valid: ':::info Titel\nText mit **fett** und [[Begriff]].\n\n- Liste\n:::', invalid: null },
  tipp: { valid: ':::tipp\nEin Tipp.\n:::', invalid: null },
  achtung: { valid: ':::achtung Hochvolt\nNie ohne Freigabe.\n:::', invalid: null },
  aufklappen: { valid: ':::aufklappen Mehr dazu\nVertiefung.\n:::', invalid: null },
  karten: {
    valid: ':::karten Titel\nVorne || Hinten mit **fett**\nA \\| B || C\n:::',
    invalid: ':::karten\nohne Trenner\n:::',
  },
  zuordnen: {
    valid: ':::zuordnen Statisch oder dynamisch?\nSkidpad => Dynamisch | Das Auto fährt.\nCost => Statisch\n:::',
    invalid: ':::zuordnen\nSkidpad ohne Pfeil\n:::',
  },
  reihenfolge: { valid: ':::reihenfolge Frage\nEins\nZwei\nDrei\n> Weil.\n:::', invalid: null },
  szenario: {
    valid: ':::szenario Öl am Boden\nDu siehst Öl.\n\nWas nun?\n- [ ] Ignorieren > Gefährlich.\n- [x] Absichern > Richtig, weil > sicher.\n:::',
    invalid: ':::szenario X\nSituation\n- [x] A > a\nText nach den Optionen\n:::',
  },
  hotspot: {
    valid: ':::hotspot Auto bild="assets/bilder/auto.svg" alt="Ein Auto"\n18% 62% | Vorderachse | Lenkung vorn.\n72.5% 40% | Akku\n:::',
    invalid: ':::hotspot bild="a.svg" alt="x"\nlinks oben | Titel\n:::',
  },
  ordner: {
    valid: ':::ordner Drive\n- 📁 01 Organisation | Protokolle\n  - 📁 Protokolle\n    - 📄 2026-10-01 Teamsitzung\n- 02 Technik\n  - Chassis\n? Wo liegen Protokolle? => 01 Organisation/Protokolle\n:::',
    invalid: ':::ordner\nkein Listeneintrag\n:::',
  },
  teams: {
    valid: ':::teams Unsere Teams\n# Chassis\nbereich: Technik\nkurz: Rahmen.\nunbekannt: bleibt\n\n# Marketing\nbereich: Organisation\nkurz: Sichtbarkeit.\n:::',
    invalid: ':::teams\nkurz: ohne Teamname\n:::',
  },
  zeitstrahl: { valid: ':::zeitstrahl Saison\nHerbst | Konzept | Ideen.\nWinter | Konstruktion\n:::', invalid: ':::zeitstrahl\nOhne Trenner\n:::' },
  checkliste: { valid: ':::checkliste Start\n- [ ] Eins\n- [ ] Zwei\n:::', invalid: ':::checkliste\nEins\n:::' },
  quiz: {
    valid: ':::quiz anzahl=1\n? Frage | mit Pipe\n- [x] Ja\n- [ ] Nein\n> Erklärung\n> zweite Zeile\n~ Seite\n\n?! Kritisch\n- [ ] A\n- [x] B\n- [x] C\n> Weil\n:::',
    invalid: ':::quiz anzahl=1\n- [x] Antwort ohne Frage\n:::',
  },
};

for (const block of listBlocks()) {
  const sample = BLOCK_SAMPLES[block.name];
  test(`${block.name}: Beispiel vorhanden`, () => assert(sample, `In BLOCK_SAMPLES fehlt ein Beispiel für „${block.name}"`));
  if (!sample) continue;

  test(`${block.name}: gültiges Beispiel wird gelesen`, () => {
    const element = parseSingleElement(sample.valid);
    assertEqual(element.type, 'block', `Fehler: ${JSON.stringify(element.errors ?? [])}`);
  });

  test(`${block.name}: Round-Trip`, () => {
    const element = parseSingleElement(sample.valid);
    const again = parseSingleElement(serializeElement(element));
    assertEqual(stripVolatile(again), stripVolatile(element));
  });

  test(`${block.name}: Round-Trip der Startdaten aus dem Editor`, () => {
    const data = block.editor.createDefault();
    const element = parseSingleElement(getBlock(block.name).serialize(data));
    assertEqual(stripVolatile(element.data), stripVolatile(data));
  });

  if (sample.invalid) {
    test(`${block.name}: ungültiges Beispiel → nicht lesbarer Abschnitt mit Zeile`, () => {
      const element = parseSingleElement(sample.invalid);
      assertEqual(element.type, 'raw');
      assert(element.errors.length > 0 && element.errors[0].line > 0, 'Meldung mit Zeilennummer fehlt');
      assertEqual(element.text, sample.invalid);
    });
  }

  test(`${block.name}: Editor-Schema vollständig`, () => {
    const schema = block.editor;
    assert(schema.label && schema.description && schema.icon, 'label, description und icon sind Pflicht');
    assert(Array.isArray(schema.fields), 'fields fehlt');
    assert(typeof schema.createDefault === 'function', 'createDefault fehlt');
  });
}

/* ───────────────────────────── Quiz ───────────────────────────── */

group('Quiz-Bewertung');

/** Vorhersagbarer Zufall für Tests (immer gleiche Folge). */
function seededRandom(seed = 42) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

const POOL = {
  count: 3,
  questions: [
    ...Array.from({ length: 6 }, (_, index) => ({ text: `N${index}`, critical: false, answers: [{ text: 'a', correct: true }, { text: 'b', correct: false }], explanation: 'x', pageRef: '' })),
    { text: 'K1', critical: true, answers: [{ text: 'a', correct: true }, { text: 'b', correct: false }], explanation: 'x', pageRef: '' },
    { text: 'K2', critical: true, answers: [{ text: 'a', correct: true }, { text: 'b', correct: false }], explanation: 'x', pageRef: '' },
  ],
};

test('anzahl=3 zieht 3 normale + alle kritischen Fragen', () => {
  const drawn = drawQuestions(POOL, seededRandom());
  assertEqual(drawn.length, 5);
  assertEqual(drawn.filter((question) => question.critical).length, 2);
});

test('Neuer Versuch bevorzugt andere Fragen', () => {
  const first = drawQuestions(POOL, seededRandom(1));
  const avoid = new Set(first.map((question) => question.text));
  const second = drawQuestions(POOL, seededRandom(2), avoid).filter((question) => !question.critical);
  assert(second.every((question) => !avoid.has(question.text)), 'Wiederholte Frage, obwohl genug neue da sind');
});

test('Mehrfachauswahl: nur exakt richtige Auswahl zählt', () => {
  const question = { answers: [{ text: 'a', correct: true }, { text: 'b', correct: true }, { text: 'c', correct: false }] };
  assert(isAnswerCorrect(question, ['b', 'a']), 'a+b sollte richtig sein');
  assert(!isAnswerCorrect(question, ['a']), 'nur a ist unvollständig');
  assert(!isAnswerCorrect(question, ['a', 'b', 'c']), 'c ist zu viel');
});

test('Bestehen: Grenze erreicht und alle Sicherheitsfragen richtig', () => {
  const normal = (correct) => ({ question: { critical: false }, correct });
  const critical = (correct) => ({ question: { critical: true }, correct });
  assertEqual(scoreAttempt([normal(true), normal(true), normal(true), normal(true), normal(false)], 80).passed, true, '4/5 = 80 %');
  assertEqual(scoreAttempt([normal(true), normal(true), normal(true), normal(false)], 80).passed, false, '75 %');
  const withCritical = scoreAttempt([normal(true), normal(true), normal(true), normal(true), normal(true), normal(true), normal(true), normal(true), normal(true), critical(false)], 80);
  assertEqual([withCritical.percent, withCritical.passed, withCritical.criticalFailed], [90, false, 1], '90 %, aber Sicherheitsfrage falsch');
});

test('Prozent wird abgerundet (79,9 % ist nie „80 %")', () => {
  const answered = Array.from({ length: 1000 }, (_, index) => ({ question: { critical: false }, correct: index < 799 }));
  assertEqual(scoreAttempt(answered, 80), { correct: 799, total: 1000, percent: 79, passed: false, criticalFailed: 0 });
});

test('Qualifying: je Kapitel mindestens eine Frage, Gesamtzahl stimmt', () => {
  const chapters = ['a', 'b', 'c'].map((id) => ({ id, quiz: { data: { questions: POOL.questions.map((question) => ({ ...question, text: `${id}-${question.text}` })) } } }));
  const drawn = drawQualifying(chapters, 8, seededRandom(7));
  assertEqual(drawn.length, 8);
  assertEqual(new Set(drawn.map((entry) => entry.chapter.id)).size, 3);
  assertEqual(new Set(drawn.map((entry) => entry.question.text)).size, 8, 'keine doppelten Fragen');
});

/* ───────────────────────────── Fortschritt ───────────────────────────── */

group('Fortschritt und Speicher');

const chapterA = { id: 'a', meta: { version: 1 } };
const chapterB = { id: 'b', meta: { version: 2 } };

test('Besseres Ergebnis bleibt, schlechteres überschreibt nicht', () => {
  const state = createEmptyState();
  recordQuizResult(state, 'a', 1, 80, true);
  recordQuizResult(state, 'a', 1, 60, false);
  assertEqual(state.results.a.best, 80);
  recordQuizResult(state, 'a', 1, 100, true);
  assertEqual(getChapterStatus(state, chapterA), 'bestzeit');
  recordQuizResult(state, 'a', 1, 90, false); // 90 %, aber Sicherheitsfrage falsch
  assertEqual(state.results.a.best, 100);
});

test('Bestanden schlägt höhere, aber nicht bestandene Prozentzahl', () => {
  const state = createEmptyState();
  recordQuizResult(state, 'a', 1, 90, false);
  recordQuizResult(state, 'a', 1, 80, true);
  assertEqual(getChapterStatus(state, chapterA), 'bestanden');
});

test('Höhere Kapitelversion → „aktualisiert", Qualifying wieder gesperrt', () => {
  const state = createEmptyState();
  recordQuizResult(state, 'a', 1, 100, true);
  recordQuizResult(state, 'b', 1, 80, true);
  assertEqual(getChapterStatus(state, chapterB), 'aktualisiert');
  assertEqual(isQualifyingUnlocked(state, [chapterA, chapterB]), false);
});

test('Deaktivierte Kapitel blockieren das Qualifying nicht, Fortschritt bleibt erhalten', () => {
  const state = createEmptyState();
  recordQuizResult(state, 'a', 1, 80, true);
  recordQuizResult(state, 'alt', 1, 0, false); // Kapitel „alt" steht nicht mehr in kurs.md
  assertEqual(isQualifyingUnlocked(state, [chapterA]), true);
  assert(state.results.alt, 'Fortschritt des deaktivierten Kapitels wurde gelöscht');
});

test('Zertifikat hängt an Qualifying und Kursversion', () => {
  const state = createEmptyState();
  recordQualifying(state, '1.0', 88, true);
  assertEqual(isCertificateUnlocked(state, '1.0'), true);
  assertEqual(isCertificateUnlocked(state, '1.1'), false);
});

test('Beschädigte gespeicherte Daten werden repariert', () => {
  assertEqual(normalizeState('kaputt'), createEmptyState());
  assertEqual(normalizeState({ theme: 'lila', results: [] }).theme, 'system');
});

test('Ohne localStorage läuft alles im Arbeitsspeicher', () => {
  const store = createStore({ storage: null });
  store.update((state) => recordQuizResult(state, 'a', 1, 80, true));
  assertEqual(store.isPersistent(), false);
  assertEqual(store.get().results.a.best, 80);
});

test('Speicher, der beim Schreiben scheitert, legt den Kurs nicht lahm', () => {
  const broken = { getItem: () => null, setItem: () => { throw new Error('voll'); }, removeItem: () => {} };
  const store = createStore({ storage: broken });
  store.update((state) => { state.last = '#/glossar'; });
  assertEqual(store.get().last, '#/glossar');
  assertEqual(store.isPersistent(), false);
});

test('Checklisten-Schlüssel hängt am Text', () => {
  assertEqual(hashText('Drive-Zugang beantragen'), hashText('Drive-Zugang beantragen'));
  assert(hashText('A') !== hashText('B'), 'verschiedene Texte, gleicher Schlüssel');
});

/* ───────────────────────────── Zertifikat ───────────────────────────── */

group('Zertifikat');

test('Prüfcode: deterministisch, Format XXXX-XXXX, ändert sich mit den Eingaben', () => {
  const code = createVerificationCode('Jürgen Weiß-Özdemir', '2026-10-13', '1.0');
  assert(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(code), `Format: ${code}`);
  assertEqual(createVerificationCode('  jürgen   weiß-özdemir ', '2026-10-13', '1.0'), code, 'Groß-/Kleinschreibung und Leerzeichen egal');
  assert(createVerificationCode('Jürgen Weiß-Özdemir', '2026-10-14', '1.0') !== code, 'Datum fließt ein');
  assert(createVerificationCode('Jürgen Weiß-Özdemir', '2026-10-13', '1.1') !== code, 'Version fließt ein');
});

test('Dateiname ist dateisystemsicher', () => {
  assertEqual(certificateFileName('Jürgen Weiß-Özdemir'), 'Onboarding-Zertifikat-Juergen-Weiss-Oezdemir.pdf');
  assertEqual(certificateFileName('  Anna / Bé <3 '), 'Onboarding-Zertifikat-Anna-Be-3.pdf');
  assertEqual(certificateFileName('***'), 'Onboarding-Zertifikat-Teilnehmende.pdf');
});

test('Datum auf Deutsch', () => assertEqual(formatGermanDate('2026-03-01'), '1. März 2026'));

/* ───────────────────────────── Kurs und Glossar ───────────────────────────── */

group('Kursdatei und Glossar');

test('kurs.md: Round-Trip', () => {
  const text = '---\ntitel: K\nkursversion: 1.0\nkapitel:\n  - a.md\n  - b.md\n---\n\nWillkommen **hier**.\n';
  const first = parseCourse(text);
  assertEqual(first.meta.kapitel, ['a.md', 'b.md']);
  assertEqual(stripVolatile(parseCourse(serializeCourse(first))), stripVolatile(first));
});

test('Glossar: Einträge, ungültige Zeilen bleiben erhalten', () => {
  const { entries, errors } = parseGlossary('A: Erklärung: mit Doppelpunkt\nkaputt\nB: Zwei');
  assertEqual(entries.length, 3);
  assertEqual(entries[0], { term: 'A', text: 'Erklärung: mit Doppelpunkt', line: 1 });
  assertEqual(errors[0].line, 2);
  assertEqual(serializeGlossary(entries), 'A: Erklärung: mit Doppelpunkt\nkaputt\nB: Zwei\n');
});

/* ───────────────────────── Alle echten Inhaltsdateien ───────────────────────── */

group('Round-Trip aller Dateien in content/');

const contentTests = (async () => {
  const read = createFetchReader();
  const course = await loadCourse(read);
  test('content/kurs.md', () => {
    const first = parseCourse(course.sources['content/kurs.md']);
    assertEqual(stripVolatile(parseCourse(serializeCourse(first))), stripVolatile(first));
  });
  test('content/glossar.md', () => {
    const first = parseGlossary(course.sources['content/glossar.md']).entries;
    assertEqual(stripVolatile(parseGlossary(serializeGlossary(first)).entries), stripVolatile(first));
  });
  const template = await read('content/_vorlage-kapitel.md');
  if (template !== null) {
    test('content/_vorlage-kapitel.md', () => assertChapterRoundTrip(template, '_vorlage-kapitel.md'));
  }
  for (const [path, text] of Object.entries(course.sources)) {
    if (!path.startsWith('content/kapitel/')) continue;
    test(path, () => assertChapterRoundTrip(text, path.split('/').pop()));
  }
})();

/* ───────────────────────────── Ausführen und anzeigen ───────────────────────────── */

async function runAll() {
  await contentTests.catch((error) => {
    test('Inhaltsdateien laden', () => {
      throw error;
    });
  });
  const outcomes = [];
  for (const entry of tests) {
    try {
      await entry.fn();
      outcomes.push({ ...entry, ok: true });
    } catch (error) {
      outcomes.push({ ...entry, ok: false, message: error.message });
    }
  }
  render(outcomes);
}

function render(outcomes) {
  const failed = outcomes.filter((outcome) => !outcome.ok);
  const summary = document.querySelector('[data-test-summary]');
  summary.textContent = failed.length === 0
    ? `Alle ${outcomes.length} Tests grün.`
    : `${failed.length} von ${outcomes.length} Tests fehlgeschlagen.`;
  summary.classList.add(failed.length === 0 ? 'check-summary__ok' : 'check-summary__count--error');

  const groups = new Map();
  for (const outcome of outcomes) {
    if (!groups.has(outcome.group)) groups.set(outcome.group, []);
    groups.get(outcome.group).push(outcome);
  }
  document.querySelector('[data-test-results]').replaceChildren(
    ...[...groups].map(([name, items]) =>
      el(
        'section',
        { class: 'check-file' },
        el('div', { class: 'check-file__head' }, el('h2', { class: 'check-file__title' }, name)),
        el(
          'ol',
          { class: 'check-list' },
          items.map((item) =>
            el(
              'li',
              { class: `check-item check-item--${item.ok ? 'hinweis' : 'fehler'}`, 'data-test-ok': String(item.ok) },
              el('p', { class: 'check-item__message' }, `${item.ok ? '✓ grün' : '✕ rot'} – ${item.name}`),
              item.ok ? null : el('p', { class: 'check-item__fix' }, item.message),
            ),
          ),
        ),
      ),
    ),
  );
}

runAll();
