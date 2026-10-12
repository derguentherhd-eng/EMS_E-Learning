/*
 * chapter.js – eine Seite eines Kapitels (#/kapitel/<id>/<n>)
 *
 * Aufbau einer Seite:
 *   Kopfzeile  „Sektor 3 · Unsere Subteams        Seite 2 von 7 · ca. 9 min"
 *   <h1>       Seitentitel (die „## "-Überschrift aus der Markdown-Datei)
 *   nur Seite 1: Freigabe-Hinweis (Sicherheitskapitel), Lernziele, „Direkt zum Quiz"
 *   Elemente   Text, Bilder, Bausteine
 *   Leiste     Zurück / Weiter (auf dem Handy unten fixiert)
 *
 * Fortschritt: Besuchte Seite und aktuelle Position werden gespeichert („Weiter, wo du
 * aufgehört hast" auf der Startseite).
 *
 * Wenn du hier etwas ändern willst …
 *   – Text des Freigabe-Hinweises: releaseNotice() unten.
 *   – Was auf Seite 1 zusätzlich erscheint: renderFirstPageIntro().
 */

import { el } from '../dom.js';
import { createBlockContext, renderElement } from '../render.js';
import { chapterHash } from '../router.js';
import { markVisited } from '../store.js';
import { isReleased, isSafetyChapter } from '../content/documents.js';
import { renderNotFound } from './not-found.js';

/**
 * @param {import('./view-types.js').ViewContext} context
 * @returns {import('./view-types.js').ViewResult}
 */
export function renderChapter({ route, course, store }) {
  const index = course.chapters.findIndex((chapter) => chapter.id === route.params.id);
  const chapter = course.chapters[index];
  if (!chapter) {
    return renderNotFound('Dieses Kapitel gibt es nicht (mehr). Vielleicht wurde es umbenannt oder deaktiviert.');
  }
  const pageNumber = Number(route.params.page);
  const page = chapter.pages[pageNumber - 1];
  if (!page) {
    return renderNotFound(`Das Kapitel „${chapter.meta.titel}" hat keine Seite ${pageNumber}.`);
  }

  store.update((state) => {
    markVisited(state, chapter.id, pageNumber);
    state.last = route.path;
  });

  const context = createBlockContext({ chapterId: chapter.id, store, glossary: course.glossary });
  const total = chapter.pages.length;
  const elements = pageNumber === 1 ? [...chapter.preamble, ...page.elements] : page.elements;

  const article = el(
    'article',
    { class: 'chapter stack' },
    el(
      'header',
      { class: 'chapter__header' },
      el(
        'div',
        { class: 'view-meta' },
        el('p', {}, `Sektor ${index + 1} · ${chapter.meta.kurztitel ?? chapter.meta.titel}`),
        el('p', {}, `Seite ${pageNumber} von ${total} · ca. ${chapter.meta.dauer} min`),
      ),
      el('h1', { class: 'view-title' }, page.title),
    ),
    pageNumber === 1 ? renderFirstPageIntro(chapter) : null,
    elements.map((element) => renderElement(element, context)),
  );

  return {
    title: `${page.title} · ${chapter.meta.kurztitel ?? chapter.meta.titel}`,
    chapterId: chapter.id,
    node: el('div', {}, article, renderPager(chapter, pageNumber, total)),
  };
}

/** Freigabe-Hinweis, Lernziele und „Direkt zum Quiz" auf Seite 1. */
function renderFirstPageIntro(chapter) {
  const goals = chapter.meta.lernziele ?? [];
  return el(
    'div',
    { class: 'stack' },
    isSafetyChapter(chapter) && !isReleased(chapter) ? releaseNotice() : null,
    goals.length > 0
      ? el(
        'section',
        { class: 'goals', 'aria-labelledby': `goals-${chapter.id}` },
        el('h2', { class: 'goals__title', id: `goals-${chapter.id}` }, 'Nach diesem Sektor …'),
        el('ul', { class: 'goals__list' }, goals.map((goal) => el('li', {}, goal))),
      )
      : null,
    chapter.quiz
      ? el(
        'p',
        { class: 'chapter__skip' },
        'Kennst du dich schon aus? ',
        el('a', { href: chapterHash(chapter.id, 'quiz') }, 'Direkt zum Quiz'),
      )
      : null,
  );
}

/**
 * Systemhinweis für Sicherheitskapitel, die noch nicht freigegeben sind. Er verschwindet
 * automatisch, sobald im Kopfbereich „freigegeben: ja" steht.
 */
function releaseNotice() {
  return el(
    'div',
    { class: 'callout callout--achtung', role: 'note' },
    el('p', { class: 'callout__label' }, 'Achtung'),
    el('p', { class: 'callout__title' }, 'Noch nicht freigegeben'),
    el(
      'div',
      { class: 'callout__body prose' },
      el('p', {}, 'Die Inhalte dieses Kapitels müssen vor der Veröffentlichung von der Werkstattleitung bzw. den Sicherheitsverantwortlichen des Teams geprüft und freigegeben werden.'),
    ),
  );
}

/** Zurück/Weiter-Leiste. */
function renderPager(chapter, pageNumber, total) {
  const previous = pageNumber > 1
    ? el('a', { class: 'button', href: chapterHash(chapter.id, pageNumber - 1) }, 'Zurück')
    : el('a', { class: 'button', href: '#/' }, 'Übersicht');
  let next;
  if (pageNumber < total) {
    next = el('a', { class: 'button button--primary', href: chapterHash(chapter.id, pageNumber + 1) }, 'Weiter');
  } else if (chapter.quiz) {
    next = el('a', { class: 'button button--primary', href: chapterHash(chapter.id, 'quiz') }, 'Zum Quiz');
  } else {
    next = el('a', { class: 'button button--primary', href: '#/' }, 'Zur Übersicht');
  }
  return el('nav', { class: 'pager', 'aria-label': 'Seitennavigation' }, previous, el('span', { class: 'pager__spacer' }), next);
}
