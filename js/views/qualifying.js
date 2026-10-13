/*
 * qualifying.js – Abschlussrunde (#/qualifying)
 *
 * Freigeschaltet, sobald alle aktiven Kapitel (in ihrer aktuellen Version) bestanden sind.
 * Ablauf: Startampel → bis zu `qualifying-fragen` gemischte Fragen aus allen Kapiteln →
 * Ergebnis. Gleiche Bestehensgrenze wie der Kurs (kurs.md), keine Pflicht-Sicherheitsfragen.
 * Bestanden → Zertifikat freigeschaltet. Unbegrenzt wiederholbar.
 *
 * Wenn du hier etwas ändern willst …
 *   – Anzahl der Fragen: „qualifying-fragen" in content/kurs.md (nicht hier).
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { chapterHash } = EM.require("js/core/router.js");
  const { getChapterStatus, isQualifyingUnlocked, recordQualifying } =
    EM.require("js/core/store.js");
  const { passThreshold } = EM.require("js/content/loader.js");
  const { drawQualifying, renderResultStrip, runQuiz, scoreAttempt } =
    EM.require("js/course/quiz.js");
  const { createStartLights } = EM.require("js/ui/start-lights.js");
  const { STATUS_TEXT } = EM.require("js/ui/sector-bar.js");
  const { renderReviewList } = EM.require("js/views/quiz-view.js");

  /**
   * @param {import("./view-types.js").ViewContext} context
   * @returns {import("./view-types.js").ViewResult}
   */
  function renderQualifying({ course, store }) {
    const state = store.get();
    if (!isQualifyingUnlocked(state, course.chapters)) {
      return { title: "Qualifying", node: renderLocked(course, state) };
    }

    // So viele Fragen wie in kurs.md gewünscht – aber nie mehr, als alle Pools zusammen hergeben.
    const pool = course.chapters.reduce(
      (sum, chapter) => sum + (chapter.quiz?.data.questions.length ?? 0),
      0,
    );
    const count = Math.min(Number(course.meta["qualifying-fragen"] ?? 8), pool);
    const threshold = passThreshold(course, null);
    const container = el("div", { class: "qualifying stack" });
    let lights = null;

    function begin() {
      const questions = drawQualifying(
        course.chapters.filter((chapter) => chapter.quiz),
        count,
      );
      runQuiz(container, {
        questions,
        label: (entry) => `Qualifying · aus Sektor ${entry.chapterIndex + 1}`,
        glossary: course.glossary,
        onFinish: (answered) => {
          const score = scoreAttempt(answered, threshold);
          store.update((draft) => {
            recordQualifying(
              draft,
              course.meta.kursversion,
              score.percent,
              score.passed,
            );
          });
          container.replaceChildren(
            renderResult(answered, score, threshold, showIntro),
          );
          container.querySelector("h1")?.focus();
          window.scrollTo({ top: 0 });
        },
      });
      container.querySelector("h1")?.focus();
      window.scrollTo({ top: 0 });
    }

    function showIntro(focus = true) {
      lights?.destroy();
      lights = createStartLights(begin);
      container.replaceChildren(
        el("h1", { tabindex: -1 }, "Qualifying"),
        el(
          "p",
          { class: "lead" },
          `${count} Fragen aus allen Sektoren, bunt gemischt. Du brauchst ${threshold} %. Danach wartet dein Zertifikat.`,
        ),
        lights.node,
      );
      if (focus) {
        container.querySelector("h1")?.focus();
      }
    }
    showIntro(false);

    return {
      title: "Qualifying",
      node: container,
      destroy: () => lights?.destroy(),
    };
  }

  /** Ansicht, solange noch nicht alle Sektoren bestanden sind. */
  function renderLocked(course, state) {
    const open = course.chapters
      .map((chapter, index) => ({
        chapter,
        index,
        status: getChapterStatus(state, chapter),
      }))
      .filter((entry) => !["bestanden", "bestzeit"].includes(entry.status));
    return el(
      "div",
      { class: "stack" },
      el("h1", {}, "Qualifying"),
      el(
        "p",
        { class: "lead" },
        "Das Qualifying startet, sobald du alle Sektoren bestanden hast. Noch offen:",
      ),
      el(
        "ul",
        { class: "review__list" },
        open.map((entry) =>
          el(
            "li",
            {},
            el(
              "a",
              { href: chapterHash(entry.chapter.id, 1) },
              `Sektor ${entry.index + 1}: ${entry.chapter.meta.titel}`,
            ),
            ` – ${STATUS_TEXT[entry.status]}`,
          ),
        ),
      ),
    );
  }

  /** Ergebnis des Qualifyings. */
  function renderResult(answered, score, threshold, restart) {
    const again = el(
      "button",
      {
        type: "button",
        class: `button${score.passed ? "" : " button--primary"}`,
      },
      "Nochmal fahren",
    );
    again.addEventListener("click", () => restart(true));
    const wrong = answered.filter((entry) => !entry.correct);
    return el(
      "div",
      { class: "quiz-result stack" },
      el("div", { class: "view-meta" }, el("p", {}, "Qualifying · Ergebnis")),
      el(
        "h1",
        { class: "quiz-result__title", tabindex: -1 },
        score.passed ? "Qualifiziert!" : "Noch nicht qualifiziert",
      ),
      el(
        "p",
        { class: "quiz-result__score" },
        el("span", { class: "quiz-result__percent" }, `${score.percent} %`),
        ` · ${score.correct} von ${score.total} richtig`,
      ),
      renderResultStrip(answered),
      score.passed
        ? el(
            "p",
            {},
            "Stark – du hast das Onboarding geschafft. Hol dir jetzt dein Zertifikat.",
          )
        : el(
            "p",
            { class: "notice notice--error" },
            `Nötig sind ${threshold} %. Schau dir die Themen unten nochmal an und starte dann neu – es kommen andere Fragen.`,
          ),
      wrong.length > 0 ? renderReviewList(wrong) : null,
      el(
        "div",
        { class: "block__actions" },
        score.passed
          ? el(
              "a",
              {
                class: "button button--primary button--large",
                href: "#/zertifikat",
              },
              "Zum Zertifikat",
            )
          : null,
        again,
      ),
    );
  }

  EM.define("js/views/qualifying.js", { renderQualifying });
})();
