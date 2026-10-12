/*
 * router.js – Hash-Routing: welche Ansicht gehört zu welcher Adresse?
 *
 * Warum Hash-Routing (#/kapitel/…)?
 *   Der Teil nach dem # wird nie an den Server geschickt. Deshalb funktioniert der Kurs auf
 *   jedem statischen Webspace – auch in einem Unterordner – ohne Server-Konfiguration, und
 *   der Zurück-Button des Browsers funktioniert trotzdem.
 *
 * Routen (vollständige Liste, auch in docs/ENTWICKLER.md):
 *   #/                          Startseite
 *   #/kapitel/<id>              = Seite 1 des Kapitels
 *   #/kapitel/<id>/<n>          Seite n (ab 1); <id> = Dateiname ohne .md
 *   #/kapitel/<id>/quiz         Kapitelquiz
 *   #/glossar                   Glossar
 *   #/glossar/<begriff>         Glossar, zu einem Begriff gesprungen
 *   #/qualifying                Abschlussrunde
 *   #/zertifikat                Zertifikat
 *   #/einstellungen             Einstellungen
 *
 * Zusammenspiel: main.js ruft startRouter() auf und entscheidet anhand von route.name, welche
 * Ansicht aus js/views/ gezeigt wird.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Route: in parseRoute() ergänzen, in main.js eine Ansicht zuordnen, tests.html
 *     um einen Testfall erweitern, Liste oben und docs/ENTWICKLER.md aktualisieren.
 */

/**
 * @typedef {Object} Route
 * @property {'start'|'chapter'|'quiz'|'glossary'|'qualifying'|'certificate'|'settings'|'notfound'} name
 * @property {Object<string, string|number>} params
 * @property {string} path  normalisierter Hash, z. B. '#/kapitel/01-formula-student/2'
 */

/**
 * Wandelt einen Hash in eine Route um.
 * Hashes, die nicht mit '#/' beginnen (z. B. '#main' vom Skip-Link), gehören nicht zum
 * Routing; dann kommt null zurück und die aktuelle Ansicht bleibt stehen.
 *
 * @param {string} hash  z. B. location.hash
 * @returns {Route|null}
 * @example
 *   parseRoute('#/kapitel/01-formula-student/3')
 *   // → { name: 'chapter', params: { id: '01-formula-student', page: 3 }, path: … }
 */
export function parseRoute(hash) {
  if (hash === '' || hash === '#' || hash === '#/') {
    return { name: 'start', params: {}, path: '#/' };
  }
  if (!hash.startsWith('#/')) {
    return null;
  }
  const parts = hash
    .slice(2)
    .split('/')
    .filter((part) => part !== '')
    .map(safeDecode);
  const path = hash;
  const [first, second, third, ...rest] = parts;

  if (first === 'kapitel' && second && rest.length === 0) {
    if (third === undefined) return { name: 'chapter', params: { id: second, page: 1 }, path };
    if (third === 'quiz') return { name: 'quiz', params: { id: second }, path };
    if (/^[1-9]\d*$/.test(third)) {
      return { name: 'chapter', params: { id: second, page: Number(third) }, path };
    }
  }
  if (first === 'glossar' && parts.length <= 2) {
    return { name: 'glossary', params: second ? { term: second } : {}, path };
  }
  if (parts.length === 1) {
    const simple = { qualifying: 'qualifying', zertifikat: 'certificate', einstellungen: 'settings' };
    if (first in simple) return { name: simple[first], params: {}, path };
  }
  return { name: 'notfound', params: {}, path };
}

/**
 * Baut den Hash zu einer Kapitelseite.
 * @param {string} chapterId
 * @param {number|'quiz'} page
 * @returns {string}
 */
export function chapterHash(chapterId, page = 1) {
  return `#/kapitel/${encodeURIComponent(chapterId)}/${page}`;
}

/**
 * Baut den Hash zu einem Glossarbegriff.
 * @param {string} term
 * @returns {string}
 */
export function glossaryHash(term) {
  return `#/glossar/${encodeURIComponent(term)}`;
}

/**
 * Startet das Routing: ruft onRoute sofort für die aktuelle Adresse auf und danach bei
 * jeder Änderung (Links, Zurück-Button, navigate()).
 * @param {(route: Route) => void} onRoute
 */
export function startRouter(onRoute) {
  const handle = () => {
    const route = parseRoute(window.location.hash);
    if (route) onRoute(route);
  };
  window.addEventListener('hashchange', handle);
  // Beim ersten Laden ist ein Hash wie '#main' sinnlos → wie Startseite behandeln.
  onRoute(parseRoute(window.location.hash) ?? parseRoute('#/'));
}

/**
 * Wechselt zu einer Adresse (erzeugt einen Eintrag im Browserverlauf).
 * @param {string} hash  z. B. '#/glossar'
 */
export function navigate(hash) {
  if (window.location.hash === hash) {
    // Gleiche Adresse: hashchange feuert nicht, also selbst auslösen (z. B. „Nochmal").
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = hash;
  }
}

function safeDecode(part) {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}
