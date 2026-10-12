/*
 * view-types.js – gemeinsame Typbeschreibungen der Ansichten (nur Dokumentation, kein Code)
 *
 * Jede Ansicht in js/views/ ist eine Funktion: (ViewContext) → ViewResult.
 * main.js ruft sie bei jedem Seitenwechsel auf, setzt das Ergebnis in <main>, aktualisiert
 * document.title und legt den Fokus auf die neue <h1> (oder auf result.focus).
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue gemeinsame Eigenschaft: hier beschreiben und in main.js (showRoute) auswerten.
 */

/**
 * @typedef {Object} ViewContext
 * @property {import('../router.js').Route} route     aktuelle Adresse
 * @property {import('../content/loader.js').CourseModel} course
 * @property {import('../store.js').Store} store
 */

/**
 * @typedef {Object} ViewResult
 * @property {string} title            Für document.title (vor „– Kursname")
 * @property {Node} node               Inhalt für <main>
 * @property {boolean} [wide]          Breitere Inhaltsspalte (z. B. Glossar)
 * @property {string|null} [chapterId] Kapitel, das die Sektoranzeige hervorheben soll
 * @property {HTMLElement} [focus]     Fokusziel statt der <h1> (z. B. Glossarbegriff)
 * @property {() => void} [destroy]    Aufräumen beim Verlassen (Timer, Listener)
 */

export {};
