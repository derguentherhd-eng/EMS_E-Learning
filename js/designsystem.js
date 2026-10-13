/*
 * designsystem.js – Logik der Übersichtsseite designsystem.html
 *
 * Setzt die Symbole in die Kacheln, die Werte der Beispiel-Statusbars, macht die Beispiel-
 * Schalter bedienbar und erzeugt die Baustein-Beispiele aus echtem Kursdown (gleicher Code wie
 * im Kurs, Fortschritt nur im Arbeitsspeicher).
 *
 * Wenn du hier etwas ändern willst …
 *   – Weitere Baustein-Beispiele: unten in SAMPLE ergänzen (Schreibweise wie in docs/BAUSTEINE.md).
 */

(function () {
  'use strict';

const { icon } = EM.require('js/ui/icons.js');
const { createStore } = EM.require('js/store.js');
const { setupThemeToggle } = EM.require('js/ui/theme.js');
const { parseChapter } = EM.require('js/content/documents.js');
const { createBlockContext, renderElement } = EM.require('js/render.js');
const { el } = EM.require('js/dom.js');

const SAMPLE = `---
titel: Beispiele
version: 1
---

## Bausteine

:::info Info-Kasten
Ruhiger Hinweis mit lila Akzentlinie.
:::

:::achtung Achtung-Kasten
Laut: gelb-schwarze Schraffur und gelber Rand.
:::

:::aufklappen Aufklappen mit Plus/Minus-Kachel
Der Inhalt erscheint nach dem Aufklappen.
:::

:::szenario Szenario
Wähle eine Antwort. Die gewählte Antwort erscheint „gedrückt".
- [x] Richtige Antwort > Rückmeldung zur richtigen Antwort.
- [ ] Falsche Antwort > Rückmeldung zur falschen Antwort.
:::

:::reihenfolge Reihenfolge mit Pfeil-Kacheln
Erster Schritt
Zweiter Schritt
Dritter Schritt
> Erklärung nach dem Prüfen.
:::

:::karten Lernkarten
Vorderseite || Rückseite der Karte.
Noch eine Karte || Umgedreht bekommt sie einen gelben Rand.
:::

:::checkliste Checkliste
- [ ] Leeres Kästchen
- [ ] Noch ein Eintrag
:::

:::zeitstrahl Zeitstrahl
Herbst | Konzept | Punkte wie der Knopf der Statusbar.
Frühjahr | Fertigung | Lila Linie.
:::
`;

const store = createStore();
const theme = /** @type {HTMLButtonElement} */ (document.querySelector('.theme-toggle'));
theme.prepend(el('span', { class: 'switch', 'aria-hidden': 'true' }));
setupThemeToggle(theme, store);

for (const button of document.querySelectorAll('[data-icon]')) {
  button.prepend(icon(/** @type {any} */ (button.getAttribute('data-icon')), 'icon-button__icon'));
}
for (const box of document.querySelectorAll('[data-feedback]')) {
  box.prepend(icon(/** @type {any} */ (box.getAttribute('data-feedback')), 'feedback__icon'));
}
for (const bar of document.querySelectorAll('.statusbar[data-value]')) {
  /** @type {HTMLElement} */ (bar).style.setProperty('--value', bar.getAttribute('data-value') ?? '0');
  bar.setAttribute('aria-hidden', 'true');
}
for (const button of document.querySelectorAll('[data-switch-demo]')) {
  button.addEventListener('click', () => {
    button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
  });
}

const demo = document.querySelector('[data-demo-blocks]');
if (demo) {
  const chapter = parseChapter(SAMPLE, 'beispiele.md');
  const context = createBlockContext({ chapterId: 'beispiele', store: createStore({ storage: null }), glossary: [] });
  demo.replaceChildren(...chapter.pages[0].elements.map((element) => renderElement(element, context)));
}

EM.define('js/designsystem.js', {});
})();
