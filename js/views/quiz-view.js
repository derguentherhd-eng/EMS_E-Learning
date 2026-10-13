/*
 * quiz-view.js – Kapitelquiz (#/kapitel/<id>/quiz)
 *
 * Ablauf: Fragen ziehen (js/course/quiz.js) → eine Frage pro Bildschirm → Ergebnis.
 * Ergebnis: Prozent, Zeitenmonitor-Streifen, Liste der falsch beantworteten Fragen mit Link
 * zur Seite zum Nachlesen (aus „~ Seitentitel"), dann „Weiter zu Sektor …" oder „Nochmal".
 * Das beste Ergebnis wird gespeichert; die Sektoranzeige färbt sich automatisch
 * (gelb = bestanden, lila = 100 %).
 *
 * Sicherheitskapitel (Feld „freigegeben"): Das Quiz öffnet erst, wenn alle Seiten bearbeitet
 * wurden. Nach dem Bestehen gibt es den PDF-Nachweis (js/views/safety-record-view.js).
 *
 * Wenn du hier etwas ändern willst …
 *   – Texte der Ergebnisseite: renderResult() unten.
 *   – Bewertungsregeln: js/course/quiz.js (scoreAttempt).
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { icon } = EM.require("js/ui/icons.js");
  const { chapterHash } = EM.require("js/core/router.js");
  const { isQualifyingUnlocked, recordQuizResult } =
    EM.require("js/core/store.js");
  const { passThreshold } = EM.require("js/content/loader.js");
  const { drawQuestions, renderResultStrip, runQuiz, scoreAttempt } =
    EM.require("js/course/quiz.js");
  const { renderNotFound } = EM.require("js/views/not-found.js");
  const { isSafetyChapter } = EM.require("js/content/documents.js");
  const { renderSafetyRecord } = EM.require("js/views/safety-record-view.js");

  /**
   * @param {import("./view-types.js").ViewContext} context
   * @returns {import("./view-types.js").ViewResult}
   */
  function renderQuiz({ route, course, store }) {
    const index = course.chapters.findIndex(
      (chapter) => chapter.id === route.params.id,
    );
    const chapter = course.chapters[index];
    if (!chapter) {
      return renderNotFound("Dieses Kapitel gibt es nicht (mehr).");
    }
    const sector = `Sektor ${index + 1} · ${chapter.meta.kurztitel ?? chapter.meta.titel}`;

    if (!chapter.quiz || chapter.quiz.data.questions.length === 0) {
      return {
        title: `Quiz · ${chapter.meta.kurztitel}`,
        chapterId: chapter.id,
        node: el(
          "div",
          { class: "stack" },
          el("h1", {}, "Für dieses Kapitel gibt es noch kein Quiz"),
          el(
            "p",
            {},
            el("a", { class: "button", href: "#/" }, "Zur Übersicht"),
          ),
        ),
      };
    }

    // Sicherheitskapitel: erst alle Seiten durcharbeiten, dann das Quiz.
    if (isSafetyChapter(chapter)) {
      const visited = store.get().visited[chapter.id] ?? [];
      const missing = chapter.pages.findIndex(
        (_page, pageIndex) => !visited.includes(pageIndex + 1),
      );
      if (missing !== -1) {
        return {
          title: `Quiz · ${chapter.meta.kurztitel ?? chapter.meta.titel}`,
          chapterId: chapter.id,
          node: el(
            "div",
            { class: "stack" },
            el("h1", {}, "Erst alle Seiten durcharbeiten"),
            el(
              "p",
              { class: "lead" },
              "Das Quiz zur Sicherheitsunterweisung öffnet, wenn du alle Seiten des Kapitels bearbeitet hast.",
            ),
            el(
              "p",
              {},
              el(
                "a",
                {
                  class: "button button--primary",
                  href: chapterHash(chapter.id, missing + 1),
                },
                `Weiter mit Seite ${missing + 1}`,
              ),
            ),
          ),
        };
      }
    }

    store.update((state) => {
      state.last = route.path;
    });

    const threshold = passThreshold(course, chapter);
    const container = el("div", { class: "quiz-view" });
    let lastAsked = new Set();

    function start(focus) {
      const questions = drawQuestions(
        chapter.quiz.data,
        Math.random,
        lastAsked,
      ).map((question) => ({ question, chapter, chapterIndex: index }));
      lastAsked = new Set(questions.map((entry) => entry.question.text));
      runQuiz(container, {
        questions,
        label: () => `${sector} · Quiz`,
        glossary: course.glossary,
        onFinish: (answered) => {
          const score = scoreAttempt(answered, threshold);
          store.update((state) => {
            recordQuizResult(
              state,
              chapter.id,
              chapter.meta.version,
              score.percent,
              score.passed,
            );
          });
          container.replaceChildren(
            renderResult({
              course,
              chapter,
              index,
              answered,
              score,
              threshold,
              store,
              retry: () => start(true),
            }),
          );
          container.querySelector("h1")?.focus();
          window.scrollTo({ top: 0 });
        },
      });
      if (focus) {
        container.querySelector("h1")?.focus();
        window.scrollTo({ top: 0 });
      }
    }
    start(false);

    return {
      title: `Quiz · ${chapter.meta.kurztitel ?? chapter.meta.titel}`,
      chapterId: chapter.id,
      node: container,
    };
  }

  /**
   * Ergebnisseite eines Kapitelquiz.
   */
  function renderResult({
    course,
    chapter,
    index,
    answered,
    score,
    threshold,
    store,
    retry,
  }) {
    const name = chapter.meta.kurztitel ?? chapter.meta.titel;
    const perfect = score.passed && score.percent === 100;
    const heading = perfect
      ? `Bestzeit! Sektor ${index + 1} mit 100 %`
      : score.passed
        ? `Sektor ${index + 1} bestanden`
        : `Sektor ${index + 1} noch nicht bestanden`;
    const wrong = answered.filter((entry) => !entry.correct);
    const nextChapter = course.chapters[index + 1];
    const allDone = isQualifyingUnlocked(store.get(), course.chapters);

    const retryButton = el(
      "button",
      {
        type: "button",
        class: `button${score.passed ? "" : " button--primary"}`,
      },
      score.passed ? "Nochmal versuchen" : "Nochmal mit neuen Fragen",
    );
    retryButton.addEventListener("click", retry);

    let forward = null;
    if (score.passed) {
      forward = allDone
        ? el(
            "a",
            { class: "button button--primary", href: "#/qualifying" },
            "Zum Qualifying",
          )
        : nextChapter
          ? el(
              "a",
              {
                class: "button button--primary",
                href: chapterHash(nextChapter.id, 1),
              },
              `Weiter zu Sektor ${index + 2}`,
            )
          : el(
              "a",
              { class: "button button--primary", href: "#/" },
              "Zur Übersicht",
            );
    }

    return el(
      "div",
      { class: "quiz-result stack" },
      el(
        "div",
        { class: "view-meta" },
        el("p", {}, `Sektor ${index + 1} · ${name} · Ergebnis`),
      ),
      el(
        "h1",
        {
          class: `quiz-result__title${perfect ? " quiz-result__title--best" : ""}`,
          tabindex: -1,
        },
        heading,
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
            perfect
              ? "Alles richtig – dein Sektor leuchtet lila."
              : "Dein Sektor ist jetzt gelb. Mit 100 % wird er lila – du kannst es jederzeit nochmal versuchen.",
          )
        : el(
            "p",
            { class: "notice notice--error" },
            score.criticalFailed > 0
              ? `Mindestens eine Sicherheitsfrage war falsch. Sicherheitsfragen müssen immer stimmen – unabhängig von den ${threshold} %.`
              : `Nötig sind ${threshold} %. Schau dir die Themen unten nochmal an – beim nächsten Versuch kommen andere Fragen.`,
          ),
      wrong.length > 0 ? renderReviewList(wrong) : null,
      score.passed ? renderSafetyRecord({ course, chapter, store }) : null,
      el(
        "div",
        { class: "block__actions" },
        forward,
        retryButton,
        score.passed
          ? null
          : el(
              "a",
              { class: "button", href: chapterHash(chapter.id, 1) },
              "Zurück zum Kapitel",
            ),
      ),
    );
  }

  /**
   * Liste „Schau dir das nochmal an" mit Links zu den Seiten aus „~ Seitentitel".
   * Wird auch vom Qualifying genutzt.
   * @param {import('../course/quiz.js').AnsweredQuestion[]} wrong
   * @returns {HTMLElement}
   */
  function renderReviewList(wrong) {
    return el(
      "section",
      { class: "review stack--tight", "aria-labelledby": "review-title" },
      el(
        "h2",
        { id: "review-title", class: "review__title" },
        "Schau dir das nochmal an",
      ),
      el(
        "ul",
        { class: "review__list" },
        wrong.map((entry) => {
          const ref = entry.question.pageRef.toLocaleLowerCase("de");
          const pageIndex = ref
            ? entry.chapter.pages.findIndex(
                (page) => page.title.toLocaleLowerCase("de") === ref,
              )
            : -1;
          const target = chapterHash(
            entry.chapter.id,
            pageIndex === -1 ? 1 : pageIndex + 1,
          );
          const pageName =
            pageIndex === -1
              ? entry.chapter.meta.titel
              : entry.chapter.pages[pageIndex].title;
          return el(
            "li",
            { class: "review__item" },
            icon("cross", "review__icon"),
            el(
              "span",
              {},
              el("span", { class: "review__question" }, entry.question.text),
              " ",
              el("a", { href: target }, `Zur Seite „${pageName}"`),
            ),
          );
        }),
      ),
    );
  }

  EM.define("js/views/quiz-view.js", { renderQuiz, renderReviewList });
})();
