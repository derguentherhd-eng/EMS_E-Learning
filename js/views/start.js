/*
 * start.js – Startseite (#/)
 *
 * Inhalt: Kurstitel, Willkommenstext aus kurs.md, „Weiter, wo du aufgehört hast" und die
 * Sektorliste im Stil eines Zeitenmonitors (Nummer, Titel, Dauer, Status). Darunter
 * Qualifying und Zertifikat mit ihrem Freischaltzustand.
 *
 * Wenn du hier etwas ändern willst …
 *   – Willkommenstext: content/kurs.md (nicht hier!).
 *   – Aussehen der Liste: Abschnitt „Zeitenmonitor" in css/components.css.
 */

import { el } from '../dom.js';
import { icon } from '../ui/icons.js';
import { renderMarkdown } from '../render.js';
import { chapterHash, parseRoute } from '../router.js';
import { getChapterStatus, isCertificateUnlocked, isQualifyingUnlocked } from '../store.js';

/**
 * @param {import('./view-types.js').ViewContext} context
 * @returns {import('./view-types.js').ViewResult}
 */
export function renderStart({ course, store }) {
  const state = store.get();
  const chapters = course.chapters;
  const severeErrors = course.errors.filter((error) => error.severity === 'fehler').length;

  return {
    title: 'Start',
    node: el(
      'div',
      { class: 'stack stack--loose' },
      el(
        'section',
        { class: 'stack', 'aria-labelledby': 'start-title' },
        el('h1', { id: 'start-title' }, course.meta.titel ?? 'Onboarding'),
        el('div', { class: 'prose lead' }, renderMarkdown(course.welcome, { glossary: course.glossary })),
        continueAction(course, state),
      ),
      severeErrors > 0
        ? el('p', { class: 'notice notice--error' }, `Beim Laden der Inhalte gab es ${severeErrors} Fehler. Einige Kapitel fehlen vielleicht. Für das Media-Team: `, el('a', { href: 'pruefen.html' }, 'Prüfseite öffnen'), '.')
        : null,
      el(
        'section',
        { class: 'stack', 'aria-labelledby': 'sectors-title' },
        el('h2', { id: 'sectors-title' }, 'Deine Sektoren'),
        el(
          'ol',
          { class: 'timing-list' },
          chapters.map((chapter, index) => sectorRow(chapter, index, state)),
          finishRows(course, state),
        ),
      ),
    ),
  };
}

/** Primärer Knopf: weitermachen oder anfangen. */
function continueAction(course, state) {
  const first = course.chapters[0];
  if (!first) return el('p', { class: 'notice' }, 'Es sind noch keine Kapitel freigeschaltet.');
  const route = state.last ? parseRoute(state.last) : null;
  const chapterIndex = route ? course.chapters.findIndex((chapter) => chapter.id === route.params.id) : -1;

  if (route && chapterIndex !== -1) {
    const chapter = course.chapters[chapterIndex];
    const where = route.name === 'quiz'
      ? 'Quiz'
      : `Seite ${Math.min(route.params.page, chapter.pages.length)} von ${chapter.pages.length}`;
    return el(
      'div',
      { class: 'start-continue' },
      el('a', { class: 'button button--primary button--large', href: state.last }, 'Weiter, wo du aufgehört hast'),
      el('p', { class: 'start-continue__where' }, `Sektor ${chapterIndex + 1} · ${chapter.meta.kurztitel ?? chapter.meta.titel} · ${where}`),
    );
  }
  return el(
    'div',
    { class: 'start-continue' },
    el('a', { class: 'button button--primary button--large', href: chapterHash(first.id, 1) }, 'Mit Sektor 1 starten'),
  );
}

/** Eine Zeile im Zeitenmonitor. */
function sectorRow(chapter, index, state) {
  const status = getChapterStatus(state, chapter);
  const result = state.results[chapter.id];
  const visited = state.visited[chapter.id] ?? [];
  const statusText = {
    offen: visited.length > 0 ? `Seite ${Math.max(...visited)} von ${chapter.pages.length}` : 'Offen',
    bestanden: `Bestanden · ${result?.best ?? ''} %`,
    bestzeit: `Bestzeit · ${result?.best ?? 100} %`,
    aktualisiert: 'Aktualisiert – Quiz neu machen',
  }[status];
  const statusIcon = { bestanden: 'check', bestzeit: 'star', aktualisiert: 'refresh' }[status];

  return el(
    'li',
    { class: 'timing-list__item' },
    el(
      'a',
      { class: `timing-list__row timing-list__row--${status}`, href: chapterHash(chapter.id, 1) },
      el('span', { class: 'timing-list__pos' }, `S${index + 1}`),
      el('span', { class: 'timing-list__title' }, chapter.meta.titel),
      el('span', { class: 'timing-list__time' }, `${chapter.meta.dauer} min`),
      el('span', { class: `timing-list__status timing-list__status--${status}` }, statusIcon ? icon(statusIcon, 'timing-list__icon') : null, statusText),
    ),
  );
}

/** Qualifying und Zertifikat am Ende der Liste. */
function finishRows(course, state) {
  const qualifyingOpen = isQualifyingUnlocked(state, course.chapters);
  const certificateOpen = isCertificateUnlocked(state, course.meta.kursversion);
  const questions = course.meta['qualifying-fragen'] ?? 8;

  const row = (pos, title, open, href, openText, lockedText) =>
    el(
      'li',
      { class: 'timing-list__item timing-list__item--finish' },
      open
        ? el(
          'a',
          { class: 'timing-list__row', href },
          el('span', { class: 'timing-list__pos' }, pos),
          el('span', { class: 'timing-list__title' }, title),
          el('span', { class: 'timing-list__time' }, ''),
          el('span', { class: 'timing-list__status timing-list__status--ready' }, icon('flag', 'timing-list__icon'), openText),
        )
        : el(
          'div',
          { class: 'timing-list__row timing-list__row--locked' },
          el('span', { class: 'timing-list__pos' }, pos),
          el('span', { class: 'timing-list__title' }, title),
          el('span', { class: 'timing-list__time' }, ''),
          el('span', { class: 'timing-list__status' }, icon('lock', 'timing-list__icon'), lockedText),
        ),
    );

  return [
    row('Q', `Qualifying · ${questions} Fragen`, qualifyingOpen, '#/qualifying', state.qualifying?.passed ? `Bestanden · ${state.qualifying.best} %` : 'Bereit', 'Gesperrt bis alle Sektoren bestanden sind'),
    row('Ziel', 'Zertifikat', certificateOpen, '#/zertifikat', 'Bereit zum Herunterladen', 'Gesperrt bis zum bestandenen Qualifying'),
  ];
}
