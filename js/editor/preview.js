/*
 * preview.js – Live-Vorschau im Editor
 *
 * Die Vorschau benutzt den ECHTEN Kurs: dieselben Ansichten (js/views/), denselben Renderer
 * und dieselben CSS-Dateien. Gerendert wird in ein <iframe>, damit die Media Queries des
 * Kurses greifen (Handybreite 375 px oder Desktop 1024 px, verkleinert dargestellt).
 *
 * Bausteine sind in der Vorschau bedienbar, speichern aber keinen Fortschritt (Speicher nur im
 * Arbeitsspeicher). Links innerhalb des Kurses springen im Editor zur jeweiligen Seite.
 *
 * Wenn du hier etwas ändern willst …
 *   – Breiten: WIDTHS. CSS-Dateien der Vorschau: COURSE_CSS (wie in index.html).
 */

(function () {
  'use strict';

const { el } = EM.require('js/dom.js');
const { createStore } = EM.require('js/store.js');
const { parseRoute } = EM.require('js/router.js');
const { renderChapter } = EM.require('js/views/chapter.js');
const { renderQuiz } = EM.require('js/views/quiz-view.js');
const { renderStart } = EM.require('js/views/start.js');
const { renderGlossaryPage } = EM.require('js/views/glossary-page.js');

const COURSE_CSS = ['reset', 'tokens', 'base', 'layout', 'components', 'blocks'];
const WIDTHS = { mobile: 375, desktop: 1024 };
const HEIGHT = 720;

/**
 * Baut die Vorschau in `container` (Reiter „Vorschau" der rechten Spalte).
 * @param {HTMLElement} container
 * @param {Object} editor
 * @returns {{update: (state: Object, courseModel: Function, entryByFile: Function) => void}}
 */
function createPreview(container, editor) {
  const store = createStore({ storage: null });
  const frame = el('iframe', { class: 'preview__frame', title: 'Vorschau der Kursseite', srcdoc: frameDocument() });
  const stage = el('div', { class: 'preview__stage' }, frame);
  let ready = false;
  let pending = null;

  const toggle = (label, current, values, onPick) =>
    el(
      'div',
      { class: 'preview__toggle', role: 'group', 'aria-label': label },
      values.map(([value, text]) =>
        el('button', { type: 'button', class: 'button button--small', 'aria-pressed': String(current() === value), onclick: (event) => {
          onPick(value);
          for (const button of event.currentTarget.parentElement.children) button.setAttribute('aria-pressed', String(button === event.currentTarget));
        } }, text),
      ),
    );

  container.replaceChildren(
    el('h2', { class: 'visually-hidden' }, 'Vorschau'),
    el(
      'div',
      { class: 'preview__controls' },
      toggle('Breite', () => editor.state.ui.previewWidth, [['mobile', 'Handy'], ['desktop', 'Desktop']], (value) => {
        editor.state.ui.previewWidth = value;
        layout();
      }),
      toggle('Farbschema', () => editor.state.ui.previewTheme, [['dark', 'Dunkel'], ['light', 'Hell']], (value) => {
        editor.state.ui.previewTheme = value;
        frame.contentDocument?.documentElement.setAttribute('data-theme', value);
      }),
    ),
    stage,
  );

  /** Skaliert das iframe auf die verfügbare Breite. */
  const layout = () => {
    const width = WIDTHS[editor.state.ui.previewWidth];
    const scale = Math.min(1, stage.clientWidth / width || 1);
    frame.style.setProperty('--preview-width', `${width}px`);
    frame.style.setProperty('--preview-height', `${HEIGHT}px`);
    frame.style.setProperty('--preview-scale', String(scale));
    stage.style.setProperty('--preview-stage-height', `${Math.round(HEIGHT * scale)}px`);
  };
  new ResizeObserver(layout).observe(stage);
  layout();

  frame.addEventListener('load', () => {
    ready = true;
    const doc = frame.contentDocument;
    // Links im Kurs: nicht im iframe navigieren, sondern im Editor zur Seite springen.
    doc.addEventListener('click', (event) => {
      const link = event.target.closest?.('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (/^https?:/i.test(href)) return; // externe Links öffnen ohnehin in neuem Tab
      event.preventDefault();
      const route = parseRoute(href.startsWith('#') ? href : '');
      const entry = route?.params.id ? editor.state.doc.chapters.find((candidate) => candidate.model?.id === route.params.id) : null;
      if (entry && route.name === 'chapter') editor.select({ kind: 'page', file: entry.file, page: route.params.page - 1 });
      if (entry && route.name === 'quiz') editor.select({ kind: 'quiz', file: entry.file });
    });
    if (pending) pending();
  });

  return {
    update(state, courseModel, entryByFile) {
      const run = () => {
        pending = null;
        const doc = frame.contentDocument;
        const main = doc?.getElementById('main');
        if (!main || !state.doc) return;
        doc.documentElement.setAttribute('data-theme', state.ui.previewTheme);
        main.replaceChildren(renderSelection(state, courseModel, entryByFile, store));
        // Bilder, die im Download-Modus noch nicht abgelegt sind, aus dem Arbeitsspeicher zeigen.
        for (const image of main.querySelectorAll('img')) {
          const asset = state.pendingAssets.get(image.getAttribute('src'));
          if (asset) image.src = asset.url;
        }
      };
      if (ready) run();
      else pending = run;
    },
  };
}

/** Rendert die passende Kursansicht zur aktuellen Auswahl im Editor. */
function renderSelection(state, courseModel, entryByFile, store) {
  const selection = state.selection;
  const entry = selection.file ? entryByFile(selection.file) : null;
  const course = courseModel(entry?.model ? entry : null);
  try {
    if (selection.kind === 'glossary') return renderGlossaryPage({ route: { params: {} }, course }).node;
    if (!entry?.model) return renderStart({ course, store }).node;
    const id = entry.model.id;
    if (selection.kind === 'quiz') return renderQuiz({ route: { name: 'quiz', params: { id }, path: '#/' }, course, store }).node;
    const page = selection.kind === 'page' ? selection.page + 1 : 1;
    if (entry.model.pages.length === 0) return el('p', {}, 'Dieses Kapitel hat noch keine Seite.');
    return renderChapter({ route: { name: 'chapter', params: { id, page }, path: '#/' }, course, store }).node;
  } catch (error) {
    return el('p', { class: 'notice notice--error' }, `Die Vorschau kann diese Seite gerade nicht anzeigen (${error.message}).`);
  }
}

/** Grundgerüst des iframes: Kurs-CSS und ein leeres <main>. */
function frameDocument() {
  const links = COURSE_CSS.map((name) => `<link rel="stylesheet" href="css/${name}.css">`).join('');
  return `<!DOCTYPE html><html lang="de" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Vorschau</title>${links}</head><body><main class="page" id="main"></main></body></html>`;
}

EM.define('js/editor/preview.js', { createPreview });
})();
