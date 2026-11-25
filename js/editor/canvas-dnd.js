/*
 * canvas-dnd.js – Verschieben von Seiten und Elementen (Knöpfe und Ziehen)
 *
 * Enthält die gemeinsame Drag-&-Drop-Logik für Listen (addDrag) und die
 * Seiten-Operationen Verschieben und Duplizieren. Die Elementkarten bekommen
 * ihr Ziehen ebenfalls über addDrag.
 *
 * Zusammenspiel: wird von canvas-elements.js (Karten) und page-canvas.js
 * (Seitenliste, Seitenansicht) benutzt. Schreibt nur über editor.commit().
 *
 * Wenn du hier etwas ändern willst …
 *   – Ziehen und Ablegen: addDrag. Das Aussehen steuern die CSS-Klassen
 *     is-dragging und is-drop-target.
 *   – Seiten verschieben/duplizieren: movePage, movePageTo, duplicatePage.
 */

(function () {
  "use strict";

  /**
   * Verschiebt eine Seite um eine Position nach oben (delta = −1) oder
   * unten (delta = 1).
   * @param {Object} editor Editor-Objekt (commit, setStatus).
   * @param {string} file Dateiname des Kapitels.
   * @param {number} index Aktuelle Position der Seite.
   * @param {number} delta −1 (nach oben) oder 1 (nach unten).
   * @returns {void}
   */
  function movePage(editor, file, index, delta) {
    editor.commit(
      (doc) => {
        const pages = doc.chapters.find((entry) => entry.file === file).model
          .pages;
        [pages[index], pages[index + delta]] = [
          pages[index + delta],
          pages[index],
        ];
      },
      { chapter: file },
    );
    editor.setStatus(`Seite ist jetzt an Position ${index + delta + 1}.`);
  }

  /**
   * Verschiebt eine Seite an eine beliebige Stelle (Ziehen und Ablegen).
   * @param {Object} editor Editor-Objekt.
   * @param {string} file Dateiname des Kapitels.
   * @param {number} from Ursprüngliche Position.
   * @param {number} to Zielposition.
   * @returns {void}
   */
  function movePageTo(editor, file, from, to) {
    if (from === to) {
      return;
    }
    editor.commit(
      (doc) => {
        const pages = doc.chapters.find((entry) => entry.file === file).model
          .pages;
        const [page] = pages.splice(from, 1);
        pages.splice(to, 0, page);
      },
      { chapter: file },
    );
  }

  /**
   * Fügt direkt hinter der Seite eine Kopie mit dem Zusatz „(Kopie)" ein
   * und wählt sie aus.
   * @param {Object} editor Editor-Objekt.
   * @param {string} file Dateiname des Kapitels.
   * @param {number} index Position der Original-Seite.
   * @returns {void}
   */
  function duplicatePage(editor, file, index) {
    editor.commit(
      (doc) => {
        const pages = doc.chapters.find((entry) => entry.file === file).model
          .pages;
        const copy = structuredClone(pages[index]);
        copy.title = `${copy.title} (Kopie)`;
        pages.splice(index + 1, 0, copy);
      },
      { chapter: file },
    );
    editor.select({ kind: "page", file, page: index + 1 });
  }

  /**
   * Drag & Drop innerhalb einer Liste (zusätzlich zu den ↑/↓-Knöpfen).
   * @param {HTMLElement} item Das ziehbare Listenelement.
   * @param {string} type MIME-artiger Schlüssel (trennt Seiten von Elementen).
   * @param {number} index Position des Elements in seiner Liste.
   * @param {function(number): void} onDrop Wird mit dem Ursprungsindex
   *   aufgerufen, wenn auf dieses Element abgelegt wird.
   * @returns {void}
   */
  function addDrag(item, type, index, onDrop) {
    item.addEventListener("dragstart", (event) => {
      event.stopPropagation();
      event.dataTransfer.setData(type, String(index));
      event.dataTransfer.effectAllowed = "move";
      item.classList.add("is-dragging");
    });
    item.addEventListener("dragend", () =>
      item.classList.remove("is-dragging"),
    );
    item.addEventListener("dragover", (event) => {
      if (!event.dataTransfer.types.includes(type)) {
        return;
      }
      event.preventDefault();
      item.classList.add("is-drop-target");
    });
    item.addEventListener("dragleave", () =>
      item.classList.remove("is-drop-target"),
    );
    item.addEventListener("drop", (event) => {
      if (!event.dataTransfer.types.includes(type)) {
        return;
      }
      event.preventDefault();
      item.classList.remove("is-drop-target");
      onDrop(Number(event.dataTransfer.getData(type)));
    });
  }

  EM.define("js/editor/canvas-dnd.js", {
    addDrag,
    movePage,
    movePageTo,
    duplicatePage,
  });
})();
