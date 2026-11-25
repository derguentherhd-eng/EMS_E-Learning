/*
 * tests-content.js – Selbsttests: Round-Trip aller echten Dateien in content/ (asynchron geladen)
 *
 * Zusammenspiel: registriert beim Laden Testfälle über js/tests/test-utils.js;
 * ausgeführt und angezeigt werden sie von js/pages/tests.js.
 * Geprüfter Code: js/content/loader.js, documents.js, serialize.js.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Logik: einen test(...)-Block in der passenden group(...) ergänzen.
 *   – Neuer Baustein: in tests-blocks.js (BLOCK_SAMPLES) ein gültiges und ein
 *     ungültiges Beispiel ergänzen; Parser- und Round-Trip-Tests entstehen daraus.
 */

(function () {
  "use strict";

  const { parseCourse, parseGlossary } = EM.require("js/content/documents.js");
  const { serializeCourse, serializeGlossary } = EM.require(
    "js/content/serialize.js",
  );
  const { createDefaultReader, loadCourse } = EM.require(
    "js/content/loader.js",
  );
  const { assertEqual, assertChapterRoundTrip, group, stripVolatile, test } =
    EM.require("js/tests/test-utils.js");

  // ───────────────────────── Alle echten Inhaltsdateien ─────────────────────────

  /**
   * Registriert die Round-Trip-Tests aller echten Inhaltsdateien. Läuft erst
   * im Runner (nicht beim Laden dieser Datei), weil content/inhalte.js im
   * Betrieb ohne Server erst nach den Paketen geladen wird.
   * @returns {Promise<void>} fertig, sobald alle Tests registriert sind
   */
  function registerContentTests() {
    group("Round-Trip aller Dateien in content/");

    return (async () => {
      // Mit Server die .md-Dateien, ohne Server (file://) die Offline-Datei content/inhalte.js.
      const read = createDefaultReader();
      const course = await loadCourse(read);
      test("content/kurs.md", () => {
        const first = parseCourse(course.sources["content/kurs.md"]);
        assertEqual(
          stripVolatile(parseCourse(serializeCourse(first))),
          stripVolatile(first),
        );
      });
      test("content/glossar.md", () => {
        const first = parseGlossary(
          course.sources["content/glossar.md"],
        ).entries;
        assertEqual(
          stripVolatile(parseGlossary(serializeGlossary(first)).entries),
          stripVolatile(first),
        );
      });
      const template = await read("content/_vorlage-kapitel.md");
      if (template !== null) {
        test("content/_vorlage-kapitel.md", () =>
          assertChapterRoundTrip(template, "_vorlage-kapitel.md"));
      }
      for (const [path, text] of Object.entries(course.sources)) {
        if (!path.startsWith("content/kapitel/")) {
          continue;
        }
        test(path, () => assertChapterRoundTrip(text, path.split("/").pop()));
      }
    })();
  }

  EM.define("js/tests/tests-content.js", { registerContentTests });
})();
