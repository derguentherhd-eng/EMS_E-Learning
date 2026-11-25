/*
 * tests-editor.js – Selbsttests: Editor-Dateinamen, Verlauf, Kursdatei, Glossar und Betrieb ohne Server
 *
 * Zusammenspiel: registriert beim Laden Testfälle über js/tests/test-utils.js;
 * ausgeführt und angezeigt werden sie von js/pages/tests.js.
 * Geprüfter Code: js/editor/names.js, history.js, js/content/loader.js, mirror.js.
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
  const { createFileListReader } = EM.require("js/content/loader.js");
  const {
    buildMirrorScript,
    collectMirrorPaths,
    createMirrorReader,
    parseMirrorScript,
  } = EM.require("js/content/mirror.js");
  const { backupPath, chapterFileName, imageFileName, slugify } =
    EM.require("js/editor/names.js");
  const { createHistory, record, redo, undo } = EM.require(
    "js/editor/history.js",
  );
  const { assert, assertEqual, group, stripVolatile, test } = EM.require(
    "js/tests/test-utils.js",
  );

  // ───────────────────────────── Editor-Logik ─────────────────────────────

  group("Editor: Dateinamen und Verlauf");

  test("Dateiname aus Kapiteltitel: Umlaute, Sonderzeichen, Nummer", () => {
    assertEqual(
      slugify("Größe & Übersicht: Straße!"),
      "groesse-uebersicht-strasse",
    );
    assertEqual(
      chapterFileName("Boxengasse: Regeln & Tipps!", ["01-a.md", "06-b.md"]),
      "07-boxengasse-regeln-tipps.md",
    );
    assertEqual(chapterFileName("Café Señor", []), "01-cafe-senor.md");
  });

  test("Dateiname: Dubletten bekommen -2, -3", () => {
    assertEqual(
      chapterFileName("Test", ["01-test.md", "02-test.md"]),
      "03-test.md",
    );
    assertEqual(
      imageFileName("Team Foto (1).JPG", ["team-foto-1.jpg"]),
      "team-foto-1-2.jpg",
    );
    assertEqual(imageFileName("virus.exe", []), null);
  });

  test("Sicherungskopie: Name mit Datum und Uhrzeit", () => {
    assertEqual(
      backupPath("content/kapitel/01-a.md", new Date(2026, 9, 13, 9, 5)),
      "content/_backup/01-a-2026-10-13-0905.md",
    );
  });

  test("Verlauf: Rückgängig und Wiederholen", () => {
    const history = createHistory();
    let doc = { value: 1 };
    record(history, structuredClone(doc), null, 0);
    doc = { value: 2 };
    record(history, structuredClone(doc), null, 10000);
    doc = { value: 3 };
    doc = undo(history, doc);
    assertEqual(doc.value, 2);
    doc = undo(history, doc);
    assertEqual(doc.value, 1);
    assertEqual(undo(history, doc), null, "nichts mehr rückgängig zu machen");
    doc = redo(history, doc);
    assertEqual(doc.value, 2);
  });

  test('Verlauf: Tippen wird zu einem Schritt gebündelt, neue Änderung löscht „Wiederholen"', () => {
    const history = createHistory();
    record(history, { v: "a" }, "feld", 0);
    record(history, { v: "ab" }, "feld", 500);
    record(history, { v: "abc" }, "feld", 900);
    assertEqual(history.past.length, 1);
    undo(history, { v: "abcd" });
    record(history, { v: "x" }, null, 5000);
    assertEqual(history.future.length, 0);
  });

  test("Verlauf: höchstens 50 Schritte", () => {
    const history = createHistory();
    for (let i = 0; i < 60; i += 1) {
      record(history, { i }, null, i * 10000);
    }
    assertEqual(history.past.length, 50);
    assertEqual(history.past[0].i, 10);
  });

  // ───────────────────────────── Kurs und Glossar ─────────────────────────────

  group("Kursdatei und Glossar");

  test("kurs.md: Round-Trip", () => {
    const text =
      "---\ntitel: K\nkursversion: 1.0\nkapitel:\n  - a.md\n  - b.md\n---\n\nWillkommen **hier**.\n";
    const first = parseCourse(text);
    assertEqual(first.meta.kapitel, ["a.md", "b.md"]);
    assertEqual(
      stripVolatile(parseCourse(serializeCourse(first))),
      stripVolatile(first),
    );
  });

  test("Glossar: Einträge, ungültige Zeilen bleiben erhalten", () => {
    const { entries, errors } = parseGlossary(
      "A: Erklärung: mit Doppelpunkt\nkaputt\nB: Zwei",
    );
    assertEqual(entries.length, 3);
    assertEqual(entries[0], {
      term: "A",
      text: "Erklärung: mit Doppelpunkt",
      line: 1,
    });
    assertEqual(errors[0].line, 2);
    assertEqual(
      serializeGlossary(entries),
      "A: Erklärung: mit Doppelpunkt\nkaputt\nB: Zwei\n",
    );
  });

  // ───────────────────────────── Offline-Datei ─────────────────────────────

  group("Betrieb ohne Server (content/inhalte.js)");

  test("Offline-Datei: Inhalte kommen unverändert zurück, auch mit Sonderzeichen", async () => {
    const files = {
      "content/kurs.md":
        'Umlaute äöüß, Backtick `x`, ${nicht}, </script>, \u2028, "Zitat"\n',
    };
    const data = parseMirrorScript(
      buildMirrorScript(files, ["01-a.md"], new Date(2026, 0, 1)),
    );
    assertEqual(data.dateien, files);
    assertEqual(data.kapitelOrdner, ["01-a.md"]);
    assertEqual(
      await createMirrorReader(data)("content/kurs.md"),
      files["content/kurs.md"],
    );
    assertEqual(await createMirrorReader(data)("gibt/es/nicht.md"), null);
  });

  test("Offline-Datei: welche Dateien hineingehören", () => {
    assertEqual(collectMirrorPaths(["01-a.md"], "assets/logo/logo.svg"), [
      "content/kurs.md",
      "content/glossar.md",
      "content/_vorlage-kapitel.md",
      "content/kapitel/01-a.md",
      "assets/logo/logo.svg",
    ]);
    assertEqual(
      collectMirrorPaths([], "assets/logo/logo.png").length,
      3,
      "Nur SVG-Logos werden als Text übernommen",
    );
  });

  test("Offline-Datei ist aktuell (gleicher Inhalt wie die .md-Dateien)", async () => {
    if (window.location.protocol === "file:") {
      return;
    } // ohne Server gibt es nichts zum Vergleichen
    const response = await fetch("content/inhalte.js", { cache: "no-cache" });
    const data = parseMirrorScript(await response.text());
    assert(
      data,
      "content/inhalte.js fehlt oder ist unlesbar – im Editor den Projektordner öffnen",
    );
    for (const [path, text] of Object.entries(data.dateien)) {
      const current = (
        await (await fetch(path, { cache: "no-cache" })).text()
      ).replace(/\r\n?/g, "\n");
      assertEqual(
        text,
        current,
        `${path} ist veraltet – im Editor den Projektordner öffnen`,
      );
    }
  });

  test("Eingelesener Ordner: Pfade ohne Ordnernamen, Auflisten eines Unterordners", async () => {
    function file(path, text) {
      return Object.assign(new File([text], path.split("/").pop()), {});
    }
    const files = [file("a", "x"), file("b", "y")];
    Object.defineProperty(files[0], "webkitRelativePath", {
      value: "onboarding/content/kurs.md",
    });
    Object.defineProperty(files[1], "webkitRelativePath", {
      value: "onboarding/content/kapitel/01-a.md",
    });
    const reader = createFileListReader(files);
    assertEqual(await reader.readText("content/kurs.md"), "x");
    assertEqual(reader.list("content/kapitel"), ["01-a.md"]);
    assertEqual(reader.list("content"), ["kurs.md"]);
  });

  EM.define("js/tests/tests-editor.js", {});
})();
