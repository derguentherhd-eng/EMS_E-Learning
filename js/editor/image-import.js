/*
 * image-import.js – Bilder in assets/bilder/ übernehmen
 *
 * Ablauf: Datei auswählen → Dateiname wird bereinigt (Kleinbuchstaben, keine Umlaute oder
 * Leerzeichen, siehe names.js) → bei mehr als 500 KB eine Warnung mit Tipp zum Verkleinern →
 *   Direktmodus: Datei wird sofort nach assets/bilder/ geschrieben (neue Datei, nichts geht
 *                verloren).
 *   Download-Modus: Bild wird vorgemerkt und beim Speichern zum Herunterladen angeboten.
 * Der Alternativtext ist Pflicht und wird im Formular des Bildes abgefragt.
 *
 * Datenschutz (steht auch in docs/PFLEGE.md): keine erkennbaren Personen ohne Einverständnis,
 * keine Screenshots mit internen Drive-Inhalten.
 *
 * Wenn du hier etwas ändern willst …
 *   – Größengrenze für die Warnung: SIZE_WARNING.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { IMAGE_TYPES, imageFileName } = EM.require("js/editor/names.js");

  const SIZE_WARNING = 500 * 1024;

  /**
   * Lässt ein Bild auswählen und übernimmt es.
   * @param {Object} editor
   * @returns {Promise<{path: string, blob?: Blob}|null>}
   */
  async function importImage(editor) {
    const file = await chooseFile();
    if (!file) {
      return null;
    }
    const { state } = editor;
    const existing = [
      ...state.imageNames,
      ...[...state.pendingAssets.keys()].map((path) => path.split("/").pop()),
    ];
    const name = imageFileName(file.name, existing);
    if (!name) {
      editor.setStatus(
        `„${file.name}" ist kein erlaubtes Bildformat. Erlaubt: ${Object.keys(IMAGE_TYPES).join(", ")}.`,
      );
      return null;
    }
    if (file.size > SIZE_WARNING) {
      const ok = await editor.confirm({
        title: "Großes Bild",
        text: el(
          "div",
          { class: "stack--tight" },
          el(
            "p",
            {},
            `„${file.name}" ist ${Math.round(file.size / 1024)} KB groß. Auf dem Handy lädt das lange.`,
          ),
          el(
            "p",
            {},
            "Tipp: Vorher auf höchstens 1600 Pixel Breite verkleinern und als WebP speichern – dann sind es meist unter 200 KB.",
          ),
        ),
        confirmLabel: "Trotzdem übernehmen",
        cancelLabel: "Abbrechen",
      });
      if (!ok) {
        return null;
      }
    }
    const path = `assets/bilder/${name}`;
    if (state.workspace.mode === "direkt") {
      await state.workspace.writeBlob(path, file);
      editor.setStatus(
        `Bild gespeichert als ${path}. Denk an den Alternativtext.`,
      );
      return { path };
    }
    editor.setStatus(
      `Bild vorgemerkt als ${path}. Es wird beim Speichern zum Herunterladen angeboten.`,
    );
    return { path, blob: file };
  }

  /** Öffnet die Dateiauswahl des Betriebssystems. */
  function chooseFile() {
    return new Promise((resolve) => {
      const input = el("input", {
        type: "file",
        accept: Object.values(IMAGE_TYPES).join(","),
        hidden: true,
      });
      input.addEventListener("change", () => {
        resolve(input.files?.[0] ?? null);
        input.remove();
      });
      input.addEventListener("cancel", () => {
        resolve(null);
        input.remove();
      });
      document.body.append(input);
      input.click();
    });
  }

  EM.define("js/editor/image-import.js", { importImage });
})();
