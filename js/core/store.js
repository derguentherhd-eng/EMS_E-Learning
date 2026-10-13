/*
 * store.js – Fortschritt speichern und auswerten
 *
 * Zweck:
 *   1. createStore(): Liest und schreibt den Lernfortschritt im localStorage des Browsers
 *      (ein Schlüssel: em-onboarding:v1, Inhalt: JSON). Klappt das nicht (privater Modus,
 *      Speicher voll, Vorschau im Editor), läuft alles im Arbeitsspeicher weiter – nur ohne
 *      Speichern. Der Kurs bricht nie wegen des Speichers ab.
 *   2. Reine Auswertungsfunktionen (ohne Seiteneffekte, deshalb gut testbar in tests.html):
 *      Welcher Sektor ist offen/bestanden/Bestzeit? Ist das Qualifying freigeschaltet?
 *
 * Datenschutz: Alles bleibt in diesem Browser auf diesem Gerät. Es gibt keinen Server.
 *
 * Zusammenspiel:
 *   – js/core/theme-init.js liest das Feld theme direkt (gleicher Schlüssel!).
 *   – Ansichten (js/views/*) und Bausteine (z. B. checklist.js) schreiben über store.update().
 *   – Die Sektoranzeige (js/ui/sector-bar.js) hört über store.subscribe() auf Änderungen.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neues Feld speichern: in createEmptyState() mit Startwert ergänzen und in
 *     normalizeState() den Typ absichern. Alte gespeicherte Daten bleiben so gültig.
 *   – Format grundlegend ändern: STORAGE_KEY auf ':v2' erhöhen (alter Fortschritt geht dann
 *     verloren – im CHANGELOG vermerken).
 */

(function () {
  "use strict";

  /** Name des Eintrags im localStorage. Auch in js/core/theme-init.js verwendet. */
  const STORAGE_KEY = "em-onboarding:v1";

  /**
   * @typedef {Object} ChapterResult
   * @property {number} version  Kapitelversion, mit der das Ergebnis erzielt wurde
   * @property {number} best     Bestes Ergebnis in Prozent (0–100, gerundet)
   * @property {boolean} passed  Bestanden (Grenze erreicht und alle Sicherheitsfragen richtig)
   * @property {string} date     Datum im Format JJJJ-MM-TT
   */

  /**
   * @typedef {Object} ProgressState
   * @property {number} schema                    Formatversion, aktuell 1
   * @property {string|null} last                 Letzte Position als Route, z. B. '#/kapitel/x/3'
   * @property {Object<string, number[]>} visited Besuchte Seiten (Seitennummern ab 1) je Kapitel
   * @property {Object<string, ChapterResult>} results  Bestes Quizergebnis je Kapitel-ID
   * @property {Object<string, Object<string, boolean>>} checklists  Haken je Kapitel und Eintrag
   * @property {'system'|'dark'|'light'} theme    Gewähltes Farbschema
   * @property {{passed:boolean, best:number, courseVersion:string, date:string}|null} qualifying
   * @property {string} name                      Name für das Zertifikat (erst dort eingegeben)
   */

  /**
   * Liefert einen leeren Fortschritt.
   * @returns {ProgressState}
   */
  function createEmptyState() {
    return {
      schema: 1,
      last: null,
      visited: {},
      results: {},
      checklists: {},
      theme: "system",
      qualifying: null,
      name: "",
    };
  }

  /**
   * Macht aus beliebigen (evtl. beschädigten oder veralteten) gespeicherten Daten einen
   * gültigen Fortschritt. Unbekannte Felder fallen weg, falsche Typen werden ersetzt.
   * @param {unknown} raw  Ergebnis von JSON.parse
   * @returns {ProgressState}
   */
  function normalizeState(raw) {
    const state = createEmptyState();
    if (!isPlainObject(raw)) {
      return state;
    }
    if (typeof raw.last === "string") {
      state.last = raw.last;
    }
    if (isPlainObject(raw.visited)) {
      state.visited = raw.visited;
    }
    if (isPlainObject(raw.results)) {
      state.results = raw.results;
    }
    if (isPlainObject(raw.checklists)) {
      state.checklists = raw.checklists;
    }
    if (["system", "dark", "light"].includes(raw.theme)) {
      state.theme = raw.theme;
    }
    if (isPlainObject(raw.qualifying)) {
      state.qualifying = raw.qualifying;
    }
    if (typeof raw.name === "string") {
      state.name = raw.name;
    }
    return state;
  }

  /**
   * @typedef {Object} Store
   * @property {() => ProgressState} get        Aktueller Zustand (Kopie – Änderungen daran wirken nicht)
   * @property {(mutator: (draft: ProgressState) => void) => void} update
   *           Ändert den Zustand: mutator bekommt eine Kopie, die er verändern darf.
   * @property {() => void} reset              Setzt allen Fortschritt zurück.
   * @property {() => boolean} isPersistent    true, wenn wirklich im Browser gespeichert wird
   * @property {(listener: (state: ProgressState) => void) => () => void} subscribe
   *           Meldet Änderungen; gibt eine Funktion zum Abmelden zurück.
   */

  /**
   * Erzeugt den Fortschrittsspeicher.
   *
   * @param {Object} [options]
   * @param {Storage|null} [options.storage]  Speicher-Objekt. Weggelassen = localStorage, falls
   *        verfügbar. null = nur Arbeitsspeicher (Editor-Vorschau, Tests).
   * @returns {Store}
   * @example
   *   const store = createStore();
   *   store.update((s) => { s.last = '#/glossar'; });
   */
  function createStore(options = {}) {
    let storage = "storage" in options ? options.storage : detectLocalStorage();
    let state = load(storage);
    const listeners = new Set();

    function save() {
      if (!storage) {
        return;
      }
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Speicher voll oder gesperrt: ab jetzt nur noch Arbeitsspeicher. Die Oberfläche
        // erfährt das über isPersistent() und zeigt einen Hinweis.
        storage = null;
      }
    }

    function notify() {
      for (const listener of listeners) {
        listener(structuredClone(state));
      }
    }

    return {
      get: () => structuredClone(state),
      update(mutator) {
        const draft = structuredClone(state);
        mutator(draft);
        state = draft;
        save();
        notify();
      },
      reset() {
        // Das Farbschema ist eine Einstellung, kein Lernfortschritt – es bleibt erhalten.
        const theme = state.theme;
        state = createEmptyState();
        state.theme = theme;
        save();
        notify();
      },
      isPersistent: () => storage !== null,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  }

  /**
   * Prüft, ob localStorage nutzbar ist. Manche Browser werfen schon beim Zugriff einen Fehler.
   * @returns {Storage|null}
   */
  function detectLocalStorage() {
    try {
      const testKey = `${STORAGE_KEY}:test`;
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    } catch {
      return null;
    }
  }

  /**
   * @param {Storage|null} storage
   * @returns {ProgressState}
   */
  function load(storage) {
    if (!storage) {
      return createEmptyState();
    }
    try {
      return normalizeState(JSON.parse(storage.getItem(STORAGE_KEY) ?? "null"));
    } catch {
      return createEmptyState();
    }
  }

  /**
   * Ist der Wert ein einfaches Objekt (kein Array, nicht null)? Für die Reparatur gespeicherter Daten.
   * @param {unknown} value
   * @returns {boolean}
   */
  function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  // ───────────────────────── Auswertung (reine Funktionen) ─────────────────────────

  /**
   * Heutiges Datum als JJJJ-MM-TT in der Zeitzone des Geräts.
   * @param {Date} [date]
   * @returns {string}
   */
  function isoDate(date = new Date()) {
    function pad(n) {
      return String(n).padStart(2, "0");
    }
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  /**
   * Ist Ergebnis a besser als Ergebnis b? Bestanden schlägt nicht bestanden, danach zählt der
   * Prozentwert. Grund: 90 % mit falscher Sicherheitsfrage ist NICHT bestanden und darf ein
   * bestandenes 80-%-Ergebnis nicht verdrängen.
   * @param {{passed:boolean, best:number}} a
   * @param {{passed:boolean, best:number}} b
   * @returns {boolean}
   */
  function isBetterResult(a, b) {
    if (a.passed !== b.passed) {
      return a.passed;
    }
    return a.best > b.best;
  }

  /**
   * Trägt ein Quizergebnis ein. Ein besseres Ergebnis überschreibt ein schlechteres, nie
   * umgekehrt. Ausnahme: Stammt das alte Ergebnis von einer anderen Kapitelversion, gilt
   * immer das neue (das Kapitel wurde ja geändert).
   *
   * @param {ProgressState} state  wird verändert (innerhalb von store.update aufrufen)
   * @param {string} chapterId
   * @param {number} version       aktuelle Kapitelversion
   * @param {number} percent       0–100
   * @param {boolean} passed
   * @param {string} [date]
   * @returns {boolean} true, wenn das neue Ergebnis gespeichert wurde
   */
  function recordQuizResult(
    state,
    chapterId,
    version,
    percent,
    passed,
    date = isoDate(),
  ) {
    const candidate = { version, best: Math.round(percent), passed, date };
    const old = state.results[chapterId];
    if (!old || old.version !== version || isBetterResult(candidate, old)) {
      state.results[chapterId] = candidate;
      return true;
    }
    return false;
  }

  /**
   * Zustand eines Kapitels für Sektoranzeige und Startseite.
   *   'offen'        noch nicht bestanden
   *   'bestanden'    bestanden (Sektor gelb)
   *   'bestzeit'     mit 100 % bestanden (Sektor lila)
   *   'aktualisiert' bestanden, aber mit älterer Kapitelversion → Quiz bitte neu machen
   *
   * @param {ProgressState} state
   * @param {{id:string, meta:{version:number}}} chapter
   * @returns {'offen'|'bestanden'|'bestzeit'|'aktualisiert'}
   */
  function getChapterStatus(state, chapter) {
    const result = state.results[chapter.id];
    if (!result) {
      return "offen";
    }
    if (result.version !== chapter.meta.version) {
      return result.passed ? "aktualisiert" : "offen";
    }
    if (!result.passed) {
      return "offen";
    }
    return result.best >= 100 ? "bestzeit" : "bestanden";
  }

  /**
   * Qualifying ist frei, wenn ALLE aktiven Kapitel in ihrer aktuellen Version bestanden sind.
   * Deaktivierte Kapitel stehen nicht in der Liste und blockieren deshalb nichts.
   * @param {ProgressState} state
   * @param {Array<{id:string, meta:{version:number}}>} chapters  aktive Kapitel
   * @returns {boolean}
   */
  function isQualifyingUnlocked(state, chapters) {
    return (
      chapters.length > 0 &&
      chapters.every((chapter) =>
        ["bestanden", "bestzeit"].includes(getChapterStatus(state, chapter)),
      )
    );
  }

  /**
   * Trägt ein Qualifying-Ergebnis ein (gleiche Regel: besser überschreibt schlechter; eine neue
   * Kursversion ersetzt immer).
   * @param {ProgressState} state
   * @param {string} courseVersion
   * @param {number} percent
   * @param {boolean} passed
   * @param {string} [date]
   */
  function recordQualifying(
    state,
    courseVersion,
    percent,
    passed,
    date = isoDate(),
  ) {
    const candidate = {
      courseVersion: String(courseVersion),
      best: Math.round(percent),
      passed,
      date,
    };
    const old = state.qualifying;
    if (
      !old ||
      old.courseVersion !== candidate.courseVersion ||
      isBetterResult(candidate, old)
    ) {
      state.qualifying = candidate;
    }
  }

  /**
   * Zertifikat ist frei, wenn das Qualifying mit der aktuellen Kursversion bestanden wurde.
   * @param {ProgressState} state
   * @param {string|number} courseVersion
   * @returns {boolean}
   */
  function isCertificateUnlocked(state, courseVersion) {
    return Boolean(
      state.qualifying?.passed &&
      state.qualifying.courseVersion === String(courseVersion),
    );
  }

  /**
   * Merkt sich eine besuchte Seite.
   * @param {ProgressState} state
   * @param {string} chapterId
   * @param {number} pageNumber  ab 1
   */
  function markVisited(state, chapterId, pageNumber) {
    const pages = state.visited[chapterId] ?? [];
    if (!pages.includes(pageNumber)) {
      pages.push(pageNumber);
      pages.sort((a, b) => a - b);
    }
    state.visited[chapterId] = pages;
  }

  EM.define("js/core/store.js", {
    createEmptyState,
    normalizeState,
    createStore,
    isoDate,
    isBetterResult,
    recordQuizResult,
    getChapterStatus,
    isQualifyingUnlocked,
    recordQualifying,
    isCertificateUnlocked,
    markVisited,
    STORAGE_KEY,
  });
})();
