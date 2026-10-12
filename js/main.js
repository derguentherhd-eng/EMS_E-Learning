/*
 * main.js – Einstiegspunkt der Kurs-Anwendung (wird von index.html geladen)
 *
 * Ablauf:
 *   1. Fortschrittsspeicher anlegen (js/store.js), Theme-Knopf und Menü verbinden.
 *   2. Kurs laden (js/content/loader.js). Klappt das nicht, erscheint eine verständliche
 *      Fehlermeldung statt einer leeren Seite.
 *   3. Sektoranzeige bauen und Router starten. Bei jeder Adressänderung wird die passende
 *      Ansicht aus js/views/ gerendert, der Seitentitel gesetzt und der Fokus auf die neue
 *      Überschrift gelegt (wichtig für Screenreader und Tastatur).
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Ansicht: Route in router.js ergänzen, Ansicht in js/views/ anlegen, hier in VIEWS
 *     eintragen.
 */

import { startRouter } from './router.js';
import { createStore } from './store.js';
import { setupThemeToggle } from './ui/theme.js';
import { icon } from './ui/icons.js';
import { createSectorBar } from './ui/sector-bar.js';
import { el } from './dom.js';
import { loadCourse } from './content/loader.js';
import { renderStart } from './views/start.js';
import { renderChapter } from './views/chapter.js';
import { renderGlossaryPage } from './views/glossary-page.js';
import { renderSettings } from './views/settings.js';
import { renderQuiz } from './views/quiz-view.js';
import { renderQualifying } from './views/qualifying.js';
import { renderCertificate } from './views/certificate-view.js';
import { renderNotFound } from './views/not-found.js';

/** Zuordnung Routenname → Ansicht. */
const VIEWS = {
  start: renderStart,
  chapter: renderChapter,
  quiz: renderQuiz,
  glossary: renderGlossaryPage,
  qualifying: renderQualifying,
  certificate: renderCertificate,
  settings: renderSettings,
  notfound: () => renderNotFound(),
};

const store = createStore();
const main = /** @type {HTMLElement} */ (document.querySelector('#main'));
const menuToggle = /** @type {HTMLButtonElement} */ (document.querySelector('.masthead__menu-toggle'));
const nav = /** @type {HTMLElement} */ (document.querySelector('#site-nav'));

let course = null;
let sectorBar = null;
let currentView = null;
let courseTitle = 'Rookie-Onboarding';

/**
 * Zeigt die Ansicht zu einer Route.
 * @param {import('./router.js').Route} route
 */
function showRoute(route) {
  currentView?.destroy?.();
  currentView = VIEWS[route.name]({ route, course, store });
  main.classList.toggle('page--wide', Boolean(currentView.wide));
  main.replaceChildren(currentView.node);
  document.title = `${currentView.title} – ${courseTitle}`;
  sectorBar?.setCurrent(currentView.chapterId ?? null);
  updateNavigation(route);
  closeMenu();
  focusHeading(currentView.focus);
}

/**
 * Setzt nach einem Seitenwechsel den Fokus auf die neue Hauptüberschrift. So erfahren
 * Screenreader-Nutzende sofort, wo sie sind, und Tastatur-Nutzende starten oben.
 * @param {HTMLElement} [preferred]  anderes Fokusziel (z. B. ein Glossarbegriff)
 */
function focusHeading(preferred) {
  const target = preferred ?? main.querySelector('h1') ?? main;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  if (preferred) {
    preferred.scrollIntoView({ block: 'center' });
  } else {
    window.scrollTo({ top: 0 });
  }
}

/** Markiert den aktiven Link in der Kopfleiste mit aria-current. */
function updateNavigation(route) {
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === route.name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

/* ── Menü auf schmalen Bildschirmen (Aufklapp-Muster mit aria-expanded) ── */
function setupMenu() {
  document.querySelector('.masthead')?.classList.add('masthead--collapsible');
  menuToggle.hidden = false;
  menuToggle.prepend(icon('menu', 'button__icon'));
  menuToggle.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') !== 'true';
    menuToggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('masthead__nav--open', open);
  });
}

function closeMenu() {
  menuToggle.setAttribute('aria-expanded', 'false');
  nav.classList.remove('masthead__nav--open');
}

/**
 * Zeigt eine verständliche Meldung, wenn der Kurs nicht geladen werden kann.
 * @param {Error} error
 */
function showLoadError(error) {
  const viaFile = window.location.protocol === 'file:';
  main.replaceChildren(
    el(
      'div',
      { class: 'stack' },
      el('h1', {}, 'Der Kurs konnte nicht geladen werden'),
      viaFile
        ? el('p', { class: 'lead' }, 'Du hast die Datei direkt geöffnet (Doppelklick auf index.html). Browser erlauben dann kein Nachladen der Inhalte. Starte den Kurs bitte über das Startskript im Ordner: starten.command (Mac), starten.bat (Windows) oder starten.sh (Linux).')
        : el('p', { class: 'lead' }, `Grund: ${error.message}`),
      viaFile ? null : el('p', {}, 'Prüfe, ob der Ordner content/ vollständig hochgeladen wurde. Für das Media-Team: ', el('a', { href: 'pruefen.html' }, 'Prüfseite öffnen'), '.'),
    ),
  );
  document.title = 'Fehler beim Laden – Rookie-Onboarding';
}

/* ── Skip-Link: springt zum Inhalt, ohne die Adresse (#/…) zu verändern ── */
document.querySelector('.skip-link')?.addEventListener('click', (event) => {
  event.preventDefault();
  focusHeading();
});

/* ── Start ── */
async function init() {
  const themeButton = /** @type {HTMLButtonElement} */ (document.querySelector('.theme-toggle'));
  themeButton.prepend(icon('sun', 'button__icon'));
  setupThemeToggle(themeButton, store);
  setupMenu();
  if (!store.isPersistent()) {
    document.querySelector('[data-storage-warning]')?.removeAttribute('hidden');
  }

  try {
    course = await loadCourse();
  } catch (error) {
    showLoadError(error);
    return;
  }
  courseTitle = course.meta.titel ?? courseTitle;
  for (const target of document.querySelectorAll('[data-course-title]')) target.textContent = courseTitle;
  sectorBar = createSectorBar(/** @type {HTMLElement} */ (document.querySelector('.sector-bar')), course, store);
  startRouter(showRoute);
}

init();
