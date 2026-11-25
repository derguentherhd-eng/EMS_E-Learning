/*
 * test-utils.js – Mini-Testrahmen für die Selbsttests
 *
 * Ohne Test-Framework: group("Name") startet eine Gruppe, test("Name", fn)
 * registriert einen Test, assert/assertEqual prüfen Erwartungen. Ein Test ist
 * grün, wenn er ohne Ausnahme durchläuft.
 *
 * Zusammenspiel: die Dateien js/tests/tests-*.js registrieren ihre Tests hier;
 * js/pages/tests.js liest sie über getTests() aus und zeigt sie an.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Prüfhilfe: als Funktion mit JSDoc ergänzen und unten exportieren.
 *   – Neue Testdatei: unter js/tests/ anlegen und in js/core/scripts.js im
 *     Paket "tests" eintragen (vor js/pages/tests.js).
 */

(function () {
  "use strict";

  const { parseBody, parseChapter } = EM.require("js/content/documents.js");
  const { serializeChapter } = EM.require("js/content/serialize.js");

  // ───────────────────────────── Mini-Testrahmen ─────────────────────────────

  const tests = [];
  let currentGroup = "Allgemein";

  /** Startet eine neue Gruppe (Überschrift in der Ergebnisliste). */
  function group(name) {
    currentGroup = name;
  }

  /**
   * Registriert einen Test.
   * @param {string} name
   * @param {() => (void|Promise<void>)} fn
   */
  function test(name, fn) {
    tests.push({ group: currentGroup, name, fn });
  }

  /** Wirft einen Fehler, wenn condition falsch ist. */
  function assert(condition, message = "Bedingung nicht erfüllt") {
    if (!condition) {
      throw new Error(message);
    }
  }

  /** Vergleicht zwei Werte inhaltlich (auch Objekte und Listen). */
  function assertEqual(actual, expected, message = "") {
    const a = stableJson(actual);
    const b = stableJson(expected);
    if (a !== b) {
      throw new Error(
        `${message ? `${message}: ` : ""}erwartet ${b}, erhalten ${a}`,
      );
    }
  }

  /** JSON mit sortierten Schlüsseln – damit {a,b} und {b,a} gleich sind. */
  function stableJson(value) {
    return JSON.stringify(value, (key, inner) =>
      inner && typeof inner === "object" && !Array.isArray(inner)
        ? Object.fromEntries(
            Object.keys(inner)
              .sort()
              .map((k) => [k, inner[k]]),
          )
        : inner,
    );
  }

  /**
   * Entfernt Angaben, die sich beim Zurückschreiben ändern dürfen (Zeilennummern, Meldungen).
   * „Inhaltsgleich" heißt: nach dieser Bereinigung identisch.
   */
  function stripVolatile(value) {
    if (Array.isArray(value)) {
      return value.map(stripVolatile);
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value)
          .filter(
            ([key]) =>
              ![
                "line",
                "refLine",
                "warnings",
                "errors",
                "fatal",
                "welcomeLine",
              ].includes(key),
          )
          .map(([key, inner]) => [key, stripVolatile(inner)]),
      );
    }
    return value;
  }

  /** Hilfsfunktion: Baustein-Text → Element (wie im Kapitel). */
  function parseSingleElement(text) {
    const items = parseBody(text, 1, "test.md").filter(
      (item) => item.type !== "page",
    );
    assertEqual(items.length, 1, "Anzahl Elemente");
    return items[0];
  }

  /** Hilfsfunktion: prüft parse(serialize(parse(text))) == parse(text) für ein Kapitel. */
  function assertChapterRoundTrip(text, file = "test.md") {
    const first = parseChapter(text, file);
    const second = parseChapter(serializeChapter(first), file);
    assertEqual(stripVolatile(second), stripVolatile(first), "Round-Trip");
    // Zweimal geschrieben = identischer Text (kanonische Form ist stabil).
    assertEqual(
      serializeChapter(second),
      serializeChapter(first),
      "Kanonische Form stabil",
    );
  }

  /**
   * Liefert alle bisher registrierten Tests.
   * @returns {{group: string, name: string, fn: Function}[]}
   */
  function getTests() {
    return tests;
  }

  EM.define("js/tests/test-utils.js", {
    assert,
    assertChapterRoundTrip,
    assertEqual,
    getTests,
    group,
    parseSingleElement,
    stableJson,
    stripVolatile,
    test,
  });
})();
