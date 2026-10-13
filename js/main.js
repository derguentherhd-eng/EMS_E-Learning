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

(function () {
  'use strict';

const { startRouter } = EM.require('js/router.js');
const { createStore } = EM.require('js/store.js');
const { setupThemeToggle } = EM.require('js/ui/theme.js');
const { icon } = EM.require('js/ui/icons.js');
const { createSectorBar } = EM.require('js/ui/sector-bar.js');
const { el } = EM.require('js/dom.js');
const { loadCourse } = EM.require('js/content/loader.js');
const { renderStart } = EM.require('js/views/start.js');
const { renderChapter } = EM.require('js/views/chapter.js');
const { renderGlossaryPage } = EM.require('js/views/glossary-page.js');
const { renderSettings } = EM.require('js/views/settings.js');
const { renderQuiz } = EM.require('js/views/quiz-view.js');
const { renderQualifying } = EM.require('js/views/qualifying.js');
const { renderCertificate } = EM.require('js/views/certificate-view.js');
const { renderNotFound } = EM.require('js/views/not-found.js');

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

/* ── Menü auf schmalen Bildschirmen (Aufklapp-Muster mit aria-expanded) ──
 * Der Knopf ist eine Symbol-Kachel aus dem Designsystem: Hamburgermenü, geöffnet ein Kreuz. */
function setupMenu() {
  document.querySelector('.masthead')?.classList.add('masthead--collapsible');
  menuToggle.hidden = false;
  setMenuState(false);
  menuToggle.addEventListener('click', () => {
    setMenuState(menuToggle.getAttribute('aria-expanded') !== 'true');
  });
}

/** @param {boolean} open */
function setMenuState(open) {
  menuToggle.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('masthead__nav--open', open);
  menuToggle.querySelector('svg')?.remove();
  menuToggle.prepend(icon(open ? 'cross' : 'menu', 'icon-button__icon'));
}

function closeMenu() {
  setMenuState(false);
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
      el('p', { class: 'lead' }, `Grund: ${error.message}`),
      viaFile
        ? el('p', {}, 'Ohne Server liest der Kurs seine Inhalte aus content/inhalte.js. Für das Media-Team: ', el('a', { href: 'editor.html' }, 'Editor öffnen'), ' und den Projektordner wählen – dann wird die Datei neu erzeugt.')
        : el('p', {}, 'Prüfe, ob der Ordner content/ vollständig hochgeladen wurde. Für das Media-Team: ', el('a', { href: 'pruefen.html' }, 'Prüfseite öffnen'), '.'),
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
  themeButton.prepend(el('span', { class: 'switch', 'aria-hidden': 'true' }));
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
})();
