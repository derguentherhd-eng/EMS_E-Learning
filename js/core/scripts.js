/*
 * scripts.js – lädt alle Skripte in der richtigen Reihenfolge (zentrale Liste)
 *
 * Jede HTML-Seite bindet nur js/core/em.js und diese Datei ein und sagt, welche Pakete sie braucht:
 *
 *   <script src="js/core/em.js"></script>
 *   <script src="js/core/scripts.js" defer data-pakete="kern kurs" data-start="js/pages/index.js"></script>
 *
 * Die Skripte werden nacheinander geladen und in genau der Reihenfolge der Listen unten
 * ausgeführt. Eine Datei darf nur benutzen, was weiter oben steht.
 *
 * Läuft die Seite ohne Server (Doppelklick, Adresse beginnt mit file://), wird zusätzlich
 * content/inhalte.js geladen: die Kursinhalte als Skript, weil der Browser dann keine .md-Dateien
 * nachladen darf. Diese Datei schreibt der Editor beim Speichern automatisch.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neuer Baustein: Datei in „kern" VOR js/blocks/registry.js eintragen.
 *   – Neue Ansicht: in „kurs" eintragen (vor den Ansichten, die sie benutzen).
 *   – Neue Editor-Datei: in „editor" eintragen.
 */
(function () {
  "use strict";

  const PAKETE = {
    /** Wird von allen Seiten gebraucht: Inhalte lesen, prüfen, darstellen. */
    kern: [
      "js/core/dom.js",
      "js/ui/icons.js",
      "js/ui/statusbar.js",
      "js/core/router.js",
      "js/core/store.js",
      "js/ui/theme.js",
      "js/blocks/block-utils.js",
      "js/blocks/callouts.js",
      "js/blocks/details.js",
      "js/blocks/flashcards.js",
      "js/blocks/matching.js",
      "js/blocks/ordering.js",
      "js/blocks/scenario.js",
      "js/blocks/hotspot.js",
      "js/blocks/file-tree.js",
      "js/blocks/teams.js",
      "js/blocks/timeline.js",
      "js/blocks/checklist.js",
      "js/blocks/quiz-block.js",
      "js/blocks/registry.js",
      "js/content/frontmatter.js",
      "js/content/markdown.js",
      "js/content/documents.js",
      "js/content/serialize.js",
      "js/content/mirror.js",
      "js/content/loader.js",
      "js/content/validate.js",
      "js/ui/glossary.js",
      "js/core/render.js",
    ],
    /** Die Kursoberfläche (auch für die Vorschau im Editor). */
    kurs: [
      "js/course/quiz.js",
      "js/course/certificate.js",
      "js/ui/sector-bar.js",
      "js/ui/start-lights.js",
      "js/views/not-found.js",
      "js/views/chapter.js",
      "js/views/quiz-view.js",
      "js/views/start.js",
      "js/views/glossary-page.js",
      "js/views/settings.js",
      "js/views/qualifying.js",
      "js/views/certificate-view.js",
    ],
    /** Nur für editor.html (und die Selbsttests). */
    editor: [
      "js/editor/names.js",
      "js/editor/history.js",
      "js/editor/workspace.js",
      "js/editor/dialogs.js",
      "js/editor/field-renderers.js",
      "js/editor/quiz-editor.js",
      "js/editor/glossary-editor.js",
      "js/editor/hotspot-editor.js",
      "js/editor/image-import.js",
      "js/editor/preview.js",
      "js/editor/course-tree.js",
      "js/editor/page-canvas.js",
    ],
  };

  const self = document.currentScript;
  const list = [];
  for (const name of (self.dataset.pakete ?? "kern").split(/\s+/)) {
    if (!PAKETE[name]) {
      throw new Error(`js/core/scripts.js: Unbekanntes Paket „${name}".`);
    }
    list.push(...PAKETE[name]);
  }
  // Ohne Server: Inhalte als Skript (siehe Dateikopf). Fehlt die Datei, merkt sich das der
  // Loader und zeigt eine verständliche Meldung.
  if (window.location.protocol === "file:") {
    list.push("content/inhalte.js");
  }
  if (self.dataset.start) {
    list.push(self.dataset.start);
  }

  for (const src of list) {
    const script = document.createElement("script");
    script.src = src;
    script.async = false; // Reihenfolge der Ausführung = Reihenfolge der Liste
    if (src === "content/inhalte.js") {
      script.addEventListener("error", () => {
        window.EM.inhalteFehlen = true;
      });
    }
    document.head.append(script);
  }
})();
