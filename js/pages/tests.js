/*
 * tests.js – Selbsttests: Runner und Anzeige (geladen von tests.html)
 *
 * Führt alle Tests aus, die die Module unter js/tests/ registriert haben, und
 * zeigt das Ergebnis an: Zusammenfassung in [data-test-summary], Gruppen und
 * Einzelergebnisse in [data-test-results].
 *
 * Zusammenspiel: js/tests/test-utils.js (Registrierung),
 * js/tests/tests-*.js (die eigentlichen Testfälle), tests.html.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neuer Test: in der passenden Datei unter js/tests/ ergänzen, nicht hier.
 *   – Darstellung der Ergebnisse: render() weiter unten.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { getTests, test } = EM.require("js/tests/test-utils.js");
  EM.require("js/tests/tests-markdown.js");
  EM.require("js/tests/tests-blocks.js");
  EM.require("js/tests/tests-course.js");
  EM.require("js/tests/tests-editor.js");
  const { registerContentTests } = EM.require("js/tests/tests-content.js");

  // ───────────────────────────── Ausführen und anzeigen ─────────────────────────────

  /** Führt alle registrierten Tests aus (die Inhaltsdateien werden vorher geladen). */
  async function runAll() {
    await contentTests.catch((error) => {
      test("Inhaltsdateien laden", () => {
        throw error;
      });
    });
    const outcomes = [];
    for (const entry of getTests()) {
      try {
        await entry.fn();
        outcomes.push({ ...entry, ok: true });
      } catch (error) {
        outcomes.push({ ...entry, ok: false, message: error.message });
      }
    }
    render(outcomes);
  }

  /** Zeigt die Testergebnisse an: Zusammenfassung oben, fehlgeschlagene Tests zuerst. */
  function render(outcomes) {
    const failed = outcomes.filter((outcome) => !outcome.ok);
    const summary = document.querySelector("[data-test-summary]");
    summary.textContent =
      failed.length === 0
        ? `Alle ${outcomes.length} Tests grün.`
        : `${failed.length} von ${outcomes.length} Tests fehlgeschlagen.`;
    summary.classList.add(
      failed.length === 0 ? "check-summary__ok" : "check-summary__count--error",
    );

    const groups = new Map();
    for (const outcome of outcomes) {
      if (!groups.has(outcome.group)) {
        groups.set(outcome.group, []);
      }
      groups.get(outcome.group).push(outcome);
    }
    document.querySelector("[data-test-results]").replaceChildren(
      ...[...groups].map(([name, items]) =>
        el(
          "section",
          { class: "check-file" },
          el(
            "div",
            { class: "check-file__head" },
            el("h2", { class: "check-file__title" }, name),
          ),
          el(
            "ol",
            { class: "check-list" },
            items.map((item) =>
              el(
                "li",
                {
                  class: `check-item check-item--${item.ok ? "hinweis" : "fehler"}`,
                  "data-test-ok": String(item.ok),
                },
                el(
                  "p",
                  { class: "check-item__message" },
                  `${item.ok ? "✓ grün" : "✕ rot"} – ${item.name}`,
                ),
                item.ok
                  ? null
                  : el("p", { class: "check-item__fix" }, item.message),
              ),
            ),
          ),
        ),
      ),
    );
  }

  const contentTests = registerContentTests();
  runAll();

  EM.define("js/pages/tests.js", {});
})();
