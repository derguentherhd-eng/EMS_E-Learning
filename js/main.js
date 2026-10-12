/*
 * main.js – Einstiegspunkt der Kurs-Anwendung (wird von index.html geladen)
 *
 * Ablauf:
 *   1. Fortschrittsspeicher anlegen (js/store.js), Theme-Knopf und Menü verbinden.
 *   2. Router starten (js/router.js). Bei jeder Adressänderung wird die passende Ansicht
 *      gerendert, der Seitentitel gesetzt und der Fokus auf die neue Überschrift gelegt.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Ansicht: Route in router.js ergänzen und hier in VIEWS eintragen.
 */

import { startRouter } from './router.js';
import { createStore } from './store.js';
import { setupThemeToggle } from './ui/theme.js';
import { icon } from './ui/icons.js';
import { el } from './dom.js';

/**
 * @typedef {Object} ViewResult
 * @property {string} title            Für document.title
 * @property {Node} node               Inhalt für <main>
 * @property {boolean} [wide]          Breitere Spalte (z. B. Glossar)
 * @property {() => void} [destroy]    Aufräumen beim Verlassen (Timer, Listener)
 */

const store = createStore();
const main = /** @type {HTMLElement} */ (document.querySelector('#main'));

/** Platzhalter für Phase 1 – werden in Phase 3 durch echte Ansichten ersetzt. */
const placeholder = (title) => () => ({
  title,
  node: el('div', { class: 'stack' }, el('h1', {}, title), el('p', {}, 'Platzhalteransicht.')),
});

/** Zuordnung Routenname → Ansichtsfunktion. */
const VIEWS = {
  start: placeholder('Startseite'),
  chapter: placeholder('Kapitelseite'),
  quiz: placeholder('Kapitelquiz'),
  glossary: placeholder('Glossar'),
  qualifying: placeholder('Qualifying'),
  certificate: placeholder('Zertifikat'),
  settings: placeholder('Einstellungen'),
  notfound: placeholder('Seite nicht gefunden'),
};

let currentView = null;

/**
 * Zeigt die Ansicht zu einer Route.
 * @param {import('./router.js').Route} route
 */
function showRoute(route) {
  currentView?.destroy?.();
  currentView = VIEWS[route.name]({ route, store });
  main.classList.toggle('page--wide', Boolean(currentView.wide));
  main.replaceChildren(currentView.node);
  document.title = `${currentView.title} – Rookie-Onboarding`;
  updateNavigation(route);
  closeMenu();
  focusHeading();
}

/**
 * Setzt nach einem Seitenwechsel den Fokus auf die neue Hauptüberschrift. So erfahren
 * Screenreader-Nutzende sofort, wo sie sind, und Tastatur-Nutzende starten oben.
 */
function focusHeading() {
  const heading = main.querySelector('h1');
  const target = heading ?? main;
  target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

/** Markiert den aktiven Link in der Kopfleiste mit aria-current. */
function updateNavigation(route) {
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === route.name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

/* ── Menü auf schmalen Bildschirmen (Aufklapp-Muster mit aria-expanded) ── */
const menuToggle = /** @type {HTMLButtonElement} */ (document.querySelector('.masthead__menu-toggle'));
const nav = /** @type {HTMLElement} */ (document.querySelector('#site-nav'));

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

/* ── Skip-Link: springt zum Inhalt, ohne die Adresse (#/…) zu verändern ── */
document.querySelector('.skip-link')?.addEventListener('click', (event) => {
  event.preventDefault();
  focusHeading();
});

/* ── Start ── */
const themeButton = /** @type {HTMLButtonElement} */ (document.querySelector('.theme-toggle'));
themeButton.prepend(icon('sun', 'button__icon'));
setupThemeToggle(themeButton, store);
setupMenu();
if (!store.isPersistent()) {
  document.querySelector('[data-storage-warning]')?.removeAttribute('hidden');
}
startRouter(showRoute);
