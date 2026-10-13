/*
 * loader.js – alle Inhaltsdateien laden und zu einem Kursmodell zusammensetzen
 *
 * Ablauf:
 *   1. content/kurs.md laden → Einstellungen + Kapitelliste
 *   2. content/glossar.md laden
 *   3. jede Datei aus der Kapitelliste aus content/kapitel/ laden (parallel)
 * Fehlt eine Datei oder ist sie fehlerhaft, bricht der Kurs NICHT ab: Das Problem landet in
 * course.errors, das Kapitel fehlt, der Rest läuft. Nur ohne kurs.md geht gar nichts.
 *
 * Woher die Dateien kommen, entscheidet eine „Lesefunktion":
 *   – createDefaultReader(): automatisch die passende der folgenden
 *   – createWebReader(): per HTTP vom Webserver (die .md-Dateien direkt). Fehlt dort eine
 *     .md-Datei, liest sie aus content/inhalte.js – so läuft der Kurs auch, wenn GitHub Pages
 *     die .md-Dateien umgewandelt hat (fehlende Datei .nojekyll, siehe docs/PFLEGE.md)
 *   – createFetchReader(): nur HTTP, ohne Ausweichen (für Editor und Selbsttests)
 *   – Offline-Datei content/inhalte.js (mirror.js), wenn die Seite per Doppelklick (file://)
 *     geöffnet wurde – dann darf der Browser keine .md-Dateien nachladen
 *   – der Editor liefert eigene Lesefunktionen (Ordnerzugriff bzw. eingelesener Ordner)
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Inhaltsdatei (z. B. content/faq.md): hier laden, in documents.js zerlegen.
 */

(function () {
  "use strict";

  const { normalizeText, parseChapter, parseCourse, parseGlossary } =
    EM.require("js/content/documents.js");
  const { createMirrorReader } = EM.require("js/content/mirror.js");

  /** Ordner der Inhalte, relativ zur HTML-Seite. */
  const CONTENT_DIR = "content";
  const CHAPTER_DIR = `${CONTENT_DIR}/kapitel`;

  /**
   * @callback ReadText
   * @param {string} path  Pfad ab Projektordner, z. B. 'content/kurs.md'
   * @returns {Promise<string|null>}  Dateiinhalt oder null, wenn die Datei nicht existiert
   */

  /**
   * Lesefunktion über HTTP. cache: 'no-cache' sorgt dafür, dass der Browser immer beim Server
   * nachfragt – sonst sähe man nach dem Speichern im Editor evtl. noch die alte Fassung.
   * @param {string} [base]  Präfix, z. B. '' (gleicher Ordner wie die HTML-Seite)
   * @returns {ReadText}
   */
  function createFetchReader(base = "") {
    return async (path) => {
      const response = await fetch(`${base}${path}`, { cache: "no-cache" });
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`${path}: Server antwortet mit ${response.status}`);
      }
      return response.text();
    };
  }

  /**
   * Lädt content/inhalte.js nach (nur einmal) und liefert die Daten oder null.
   * Ein <script> funktioniert auch dort, wo .md-Dateien fehlen.
   * @returns {Promise<import("./mirror.js").MirrorData|null>}
   */
  function loadMirror() {
    if (window.EM.inhalte) {
      return Promise.resolve(window.EM.inhalte);
    }
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = `${CONTENT_DIR}/inhalte.js`;
      script.addEventListener("load", () => resolve(window.EM.inhalte ?? null));
      script.addEventListener("error", () => resolve(null));
      document.head.append(script);
    });
  }

  /**
   * Lesefunktion für den Webspace: zuerst die .md-Datei, fehlt sie, die Kopie in
   * content/inhalte.js. Grund: GitHub Pages wandelt .md-Dateien in HTML um, wenn die Datei
   * .nojekyll fehlt (z. B. nach dem Hochladen über die GitHub-Webseite, die Dateien mit Punkt
   * am Anfang weglässt). Der Kurs läuft dann trotzdem; die Konsole nennt die Ursache.
   * @returns {ReadText}
   */
  function createWebReader() {
    const fromServer = createFetchReader();
    let mirror = null;
    let warned = false;
    return async (path) => {
      const text = await fromServer(path);
      if (text !== null || !path.endsWith(".md")) {
        return text;
      }
      mirror ??= loadMirror();
      const data = await mirror;
      if (data && !warned) {
        warned = true;
        console.warn(
          `${path} fehlt auf dem Server – der Kurs liest die Kopie in content/inhalte.js. Auf GitHub Pages fehlt vermutlich die Datei .nojekyll (siehe docs/PFLEGE.md, Abschnitt 12).`,
        );
      }
      return data ? createMirrorReader(data)(path) : null;
    };
  }

  /**
   * Wählt die passende Lesefunktion: über einen Webserver die .md-Dateien (mit Ausweichen auf
   * content/inhalte.js), ohne Server (file://) direkt die Offline-Datei.
   * @returns {ReadText}
   * @throws {Error} ohne Server, wenn content/inhalte.js fehlt
   */
  function createDefaultReader() {
    if (window.location.protocol !== "file:") {
      return createWebReader();
    }
    if (!window.EM.inhalte) {
      throw new Error(
        "Die Datei content/inhalte.js fehlt. Sie wird vom Editor erzeugt: editor.html öffnen und den Projektordner wählen.",
      );
    }
    return createMirrorReader(window.EM.inhalte);
  }

  /**
   * Lesefunktion für einen über <input type="file" webkitdirectory> eingelesenen Ordner.
   * Funktioniert in allen Browsern und ohne Server – aber nur lesend.
   *
   * Die Pfade im FileList beginnen mit dem gewählten Ordnernamen (z. B. „onboarding/content/…");
   * dieser erste Teil wird abgeschnitten.
   *
   * @param {FileList|File[]} fileList
   * @returns {{readText: ReadText, files: Map<string, File>, list: (dir: string) => string[]}}
   */
  function createFileListReader(fileList) {
    const files = new Map();
    for (const file of fileList) {
      const path = (file.webkitRelativePath || file.name)
        .split("/")
        .slice(1)
        .join("/");
      files.set(path, file);
    }
    return {
      files,
      readText: async (path) =>
        files.has(path) ? normalizeText(await files.get(path).text()) : null,
      list: (dir) =>
        [...files.keys()]
          .filter(
            (path) =>
              path.startsWith(`${dir}/`) &&
              !path.slice(dir.length + 1).includes("/"),
          )
          .map((path) => path.slice(dir.length + 1))
          .sort(),
    };
  }

  /**
   * @typedef {Object} CourseModel
   * @property {Object} meta          Einstellungen aus kurs.md (meta.kapitel = Kapitelliste)
   * @property {string} welcome       Willkommenstext
   * @property {import("./documents.js").ChapterModel[]} chapters  geladene, aktive Kapitel in Kursreihenfolge
   * @property {import("./documents.js").GlossaryEntry[]} glossary
   * @property {Object[]} errors      Lade- und Lesefehler aller Dateien
   * @property {Object<string, string>} sources  Originaltext je Pfad (für Prüfseite und Tests)
   */

  /**
   * Lädt den kompletten Kurs.
   *
   * @param {ReadText} [readText]
   * @returns {Promise<CourseModel>}
   * @throws {Error} nur wenn kurs.md fehlt oder nicht geladen werden kann
   */
  async function loadCourse(readText = createDefaultReader()) {
    const sources = {};
    const coursePath = `${CONTENT_DIR}/kurs.md`;
    const courseText = await readText(coursePath);
    if (courseText === null) {
      throw new Error("Die Datei content/kurs.md wurde nicht gefunden.");
    }
    sources[coursePath] = normalizeText(courseText);
    const courseFile = parseCourse(courseText, coursePath);
    const errors = [...courseFile.errors];

    const glossaryPath = `${CONTENT_DIR}/glossar.md`;
    let glossary = [];
    const glossaryText = await readText(glossaryPath).catch(() => null);
    if (glossaryText === null) {
      errors.push({
        file: glossaryPath,
        line: 0,
        severity: "warnung",
        message: "Die Datei glossar.md fehlt.",
        fix: 'Lege content/glossar.md an (eine Zeile pro Begriff: „Begriff: Erklärung").',
      });
    } else {
      sources[glossaryPath] = normalizeText(glossaryText);
      const parsed = parseGlossary(glossaryText, glossaryPath);
      glossary = parsed.entries;
      errors.push(...parsed.errors);
    }

    const seen = new Set();
    const files = courseFile.meta.kapitel.filter((file) => {
      if (seen.has(file)) {
        errors.push({
          file: coursePath,
          line: 0,
          severity: "fehler",
          message: `Das Kapitel „${file}" steht doppelt in der Kapitelliste.`,
          fix: 'Lösche einen der beiden Einträge unter „kapitel:".',
        });
        return false;
      }
      seen.add(file);
      return true;
    });

    const loaded = await Promise.all(
      files.map(async (file) => {
        const path = `${CHAPTER_DIR}/${file}`;
        try {
          const text = await readText(path);
          if (text === null) {
            errors.push({
              file: coursePath,
              line: 0,
              severity: "fehler",
              message: `Das Kapitel „${file}" steht in der Kapitelliste, die Datei gibt es aber nicht.`,
              fix: `Lege content/kapitel/${file} an oder entferne den Eintrag aus kurs.md. Prüfe auch die Schreibweise (Groß-/Kleinschreibung, .md am Ende).`,
            });
            return null;
          }
          sources[path] = normalizeText(text);
          const chapter = parseChapter(text, file, CHAPTER_DIR);
          errors.push(...chapter.errors);
          return chapter;
        } catch (error) {
          errors.push({
            file: path,
            line: 0,
            severity: "fehler",
            message: `Die Datei konnte nicht geladen werden (${error.message}).`,
            fix: "Ohne Server: Ist content/inhalte.js aktuell? (editor.html öffnen, Projektordner wählen, speichern.) Auf dem Webspace: Wurde der Ordner content/ vollständig hochgeladen?",
          });
          return null;
        }
      }),
    );

    return {
      meta: courseFile.meta,
      welcome: courseFile.welcome,
      chapters: loaded.filter((chapter) => chapter !== null && !chapter.fatal),
      glossary,
      errors,
      sources,
    };
  }

  /**
   * Bestehensgrenze eines Kapitels: Kapitel-Wert, sonst Kurs-Wert, sonst 80.
   * @param {CourseModel} course
   * @param {import("./documents.js").ChapterModel} chapter
   * @returns {number}
   */
  function passThreshold(course, chapter) {
    const value = Number(
      chapter?.meta.bestehensgrenze ?? course.meta.bestehensgrenze ?? 80,
    );
    return Number.isFinite(value) && value > 0 && value <= 100 ? value : 80;
  }

  EM.define("js/content/loader.js", {
    createDefaultReader,
    createFileListReader,
    createFetchReader,
    loadCourse,
    passThreshold,
    CONTENT_DIR,
    CHAPTER_DIR,
  });
})();
