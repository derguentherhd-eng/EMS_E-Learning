/*
 * mirror.js – die Offline-Datei content/inhalte.js erzeugen und lesen
 *
 * Warum gibt es content/inhalte.js?
 *   Öffnet man index.html per Doppelklick (file://), verbietet der Browser das Nachladen der
 *   .md-Dateien. Skripte darf er aber laden. content/inhalte.js enthält deshalb eine Kopie aller
 *   Inhaltsdateien als JavaScript (EM.inhalte = { … }).
 *
 * Wichtig: Die .md-Dateien bleiben die EINZIGE Quelle. content/inhalte.js wird nie von Hand
 * bearbeitet, sondern vom Editor erzeugt – bei jedem Speichern und beim Öffnen des Projekt-
 * ordners, falls sich die .md-Dateien inzwischen (z. B. von Hand) geändert haben.
 * Auf einem Webserver liest der Kurs direkt die .md-Dateien; dort wird die Datei nicht benutzt.
 *
 * Inhalt der Datei: kurs.md, glossar.md, die Kapitelvorlage, alle Dateien aus content/kapitel/
 * (auch nicht eingetragene, damit die Prüfseite sie findet) und das Logo als SVG-Text (für das
 * PDF-Zertifikat, weil ein Bild von der Festplatte dort sonst nicht verwendet werden darf).
 *
 * Wenn du hier etwas ändern willst …
 *   – Weitere Datei offline verfügbar machen: in collectMirrorPaths() ergänzen.
 */

(function () {
  "use strict";

  /**
   * @typedef {Object} MirrorData
   * @property {string} erzeugt               Zeitpunkt der Erzeugung (ISO)
   * @property {string[]} kapitelOrdner       Dateinamen in content/kapitel/
   * @property {Object<string, string>} dateien  Pfad ab Projektordner → Dateiinhalt
   */

  /**
   * Welche Dateien gehören in die Offline-Datei?
   * @param {string[]} chapterFiles  Dateinamen in content/kapitel/
   * @param {string} [logoPath]      Pfad des Logos aus kurs.md
   * @returns {string[]}
   */
  function collectMirrorPaths(chapterFiles, logoPath = "") {
    const paths = [
      "content/kurs.md",
      "content/glossar.md",
      "content/_vorlage-kapitel.md",
    ];
    for (const file of chapterFiles) {
      paths.push(`content/kapitel/${file}`);
    }
    if (/\.svg$/i.test(logoPath)) {
      paths.push(logoPath);
    }
    return paths;
  }

  /**
   * Baut den Text von content/inhalte.js.
   * @param {Object<string, string>} files  Pfad → Inhalt
   * @param {string[]} chapterFiles
   * @param {Date} [date]
   * @returns {string}
   */
  function buildMirrorScript(files, chapterFiles, date = new Date()) {
    /** @type {MirrorData} */
    const data = {
      erzeugt: date.toISOString(),
      kapitelOrdner: [...chapterFiles].sort(),
      dateien: files,
    };
    return [
      "/*",
      " * content/inhalte.js – AUTOMATISCH ERZEUGT vom Editor. Bitte nicht von Hand bearbeiten.",
      " *",
      " * Kopie aller Inhaltsdateien, damit der Kurs auch per Doppelklick auf index.html (ohne",
      " * Server) funktioniert. Die eigentlichen Inhalte stehen in den .md-Dateien. Nach Änderungen",
      " * von Hand: editor.html öffnen und den Projektordner wählen – die Datei wird dann erneuert.",
      " */",
      `EM.inhalte = ${JSON.stringify(data, null, 2)};`,
      "",
    ].join("\n");
  }

  /**
   * Liest den Text einer content/inhalte.js wieder ein (für Editor und Tests).
   * @param {string} text
   * @returns {MirrorData|null}
   */
  function parseMirrorScript(text) {
    const match = text.match(/EM\.inhalte = ([\s\S]*);\s*$/);
    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }

  /**
   * Lesefunktion (wie createFetchReader in loader.js), die aus der Offline-Datei liest.
   * @param {MirrorData} data
   * @returns {import("./loader.js").ReadText}
   */
  function createMirrorReader(data) {
    return async (path) => data.dateien[path] ?? null;
  }

  EM.define("js/content/mirror.js", {
    collectMirrorPaths,
    buildMirrorScript,
    parseMirrorScript,
    createMirrorReader,
  });
})();
