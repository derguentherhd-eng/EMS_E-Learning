/*
 * chapter.js – eine Seite eines Kapitels (#/kapitel/<id>/<n>)
 *
 * Aufbau einer Seite:
 *   Kopfzeile  „Sektor 3 · Unsere Subteams        Seite 2 von 7 · ca. 9 min"
 *   <h1>       Seitentitel (die „## "-Überschrift aus der Markdown-Datei)
 *   nur Seite 1: Freigabe-Hinweis (Sicherheitskapitel), Lernziele, „Direkt zum Quiz"
 *   Elemente   Text, Bilder, Bausteine
 *   Leiste     Zurück / Weiter (auf dem Handy unten fixiert)
 *
 * Fortschritt: Besuchte Seite und aktuelle Position werden gespeichert („Weiter, wo du
 * aufgehört hast" auf der Startseite).
 *
 * Wenn du hier etwas ändern willst …
 *   – Text des Freigabe-Hinweises: releaseNotice() unten.
 *   – Was auf Seite 1 zusätzlich erscheint: renderFirstPageIntro().
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { createBlockContext, renderElement } = EM.require("js/core/render.js");
  const { chapterHash } = EM.require("js/core/router.js");
  const { markVisited } = EM.require("js/core/store.js");
  const { statusBar } = EM.require("js/ui/statusbar.js");
  const { isReleased, isSafetyChapter } = EM.require("js/content/documents.js");
  const { renderNotFound } = EM.require("js/views/not-found.js");
  const { renderSafetyRecord } = EM.require("js/views/safety-record-view.js");

  /**
   * @param {import("./view-types.js").ViewContext} context
   * @returns {import("./view-types.js").ViewResult}
   */
  function renderChapter({ route, course, store }) {
    const index = course.chapters.findIndex(
      (chapter) => chapter.id === route.params.id,
    );
    const chapter = course.chapters[index];
    if (!chapter) {
      return renderNotFound(
        "Dieses Kapitel gibt es nicht (mehr). Vielleicht wurde es umbenannt oder deaktiviert.",
      );
    }
    const pageNumber = Number(route.params.page);
    const page = chapter.pages[pageNumber - 1];
    if (!page) {
      return renderNotFound(
        `Das Kapitel „${chapter.meta.titel}" hat keine Seite ${pageNumber}.`,
      );
    }

    store.update((state) => {
      markVisited(state, chapter.id, pageNumber);
      state.last = route.path;
    });

    const context = createBlockContext({
      chapterId: chapter.id,
      store,
      glossary: course.glossary,
    });
    const total = chapter.pages.length;
    const elements =
      pageNumber === 1
        ? [...chapter.preamble, ...page.elements]
        : page.elements;

    const article = el(
      "article",
      { class: "chapter stack" },
      el(
        "header",
        { class: "chapter__header" },
        el(
          "div",
          { class: "view-meta" },
          el(
            "p",
            {},
            `Sektor ${index + 1} · ${chapter.meta.kurztitel ?? chapter.meta.titel}`,
          ),
          el(
            "p",
            {},
            `Seite ${pageNumber} von ${total} · ca. ${chapter.meta.dauer} min`,
          ),
        ),
        statusBar(pageNumber, total),
        el("h1", { class: "view-title" }, page.title),
      ),
      pageNumber === 1 ? renderFirstPageIntro(chapter) : null,
      pageNumber === 1 ? renderSafetyRecord({ course, chapter, store }) : null,
      elements.map((element) => renderElement(element, context)),
    );

    const pager = renderPager(chapter, pageNumber, total);
    lockUntilSolved(article, pager);

    return {
      title: `${page.title} · ${chapter.meta.kurztitel ?? chapter.meta.titel}`,
      chapterId: chapter.id,
      node: el("div", {}, article, pager),
    };
  }

  /**
   * Gibt „Weiter" erst frei, wenn alle Übungen mit richtig/falsch auf der Seite gelöst sind
   * (Bausteine mit data-exercise, siehe trackExercise() in js/blocks/block-utils.js). Sonst
   * könnte man sich ohne Mitdenken durch das Kapitel klicken.
   * @param {HTMLElement} article  Inhalt der Seite
   * @param {HTMLElement} pager    Zurück/Weiter-Leiste
   */
  function lockUntilSolved(article, pager) {
    const next = pager.querySelector("[data-next]");
    if (!next) {
      return;
    }
    const hint = el("p", {
      class: "pager__hint",
      id: "pager-hint",
      "aria-live": "polite",
    });
    article.append(hint);

    function update() {
      const open = article.querySelectorAll('[data-exercise="offen"]').length;
      const locked = open > 0;
      next.setAttribute("aria-disabled", String(locked));
      next.classList.toggle("is-locked", locked);
      if (locked) {
        next.setAttribute("aria-describedby", "pager-hint");
      } else {
        next.removeAttribute("aria-describedby");
      }
      hint.textContent = locked
        ? `Löse zuerst ${open === 1 ? "die Übung" : `die ${open} Übungen`} auf dieser Seite richtig – dann geht es weiter.`
        : "";
    }

    next.addEventListener("click", (event) => {
      if (next.getAttribute("aria-disabled") === "true") {
        event.preventDefault();
        hint.textContent = "";
        // Kurz leeren, damit Screenreader die Meldung erneut vorlesen.
        setTimeout(update, 30);
        article.querySelector('[data-exercise="offen"]')?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    });
    article.addEventListener("exercise-change", update);
    update();
  }

  /** Freigabe-Hinweis, Lernziele und „Direkt zum Quiz" auf Seite 1. */
  function renderFirstPageIntro(chapter) {
    const goals = chapter.meta.lernziele ?? [];
    return el(
      "div",
      { class: "stack" },
      isSafetyChapter(chapter) && !isReleased(chapter) ? releaseNotice() : null,
      goals.length > 0
        ? el(
            "section",
            { class: "goals", "aria-labelledby": `goals-${chapter.id}` },
            el(
              "h2",
              { class: "goals__title", id: `goals-${chapter.id}` },
              "Nach diesem Sektor …",
            ),
            el(
              "ul",
              { class: "goals__list" },
              goals.map((goal) => el("li", {}, goal)),
            ),
          )
        : null,
      // Sicherheitskapitel: kein Abkürzen direkt ins Quiz – erst alle Seiten durcharbeiten.
      chapter.quiz && !isSafetyChapter(chapter)
        ? el(
            "p",
            { class: "chapter__skip" },
            "Kennst du dich schon aus? ",
            el(
              "a",
              { href: chapterHash(chapter.id, "quiz") },
              "Direkt zum Quiz",
            ),
          )
        : null,
    );
  }

  /**
   * Systemhinweis für Sicherheitskapitel, die noch nicht freigegeben sind. Er verschwindet
   * automatisch, sobald im Kopfbereich „freigegeben: ja" steht.
   */
  function releaseNotice() {
    return el(
      "div",
      { class: "callout callout--achtung", role: "note" },
      el("p", { class: "callout__label" }, "Achtung"),
      el("p", { class: "callout__title" }, "Noch nicht freigegeben"),
      el(
        "div",
        { class: "callout__body prose" },
        el(
          "p",
          {},
          "Die Inhalte dieses Kapitels müssen vor der Veröffentlichung von der Werkstattleitung bzw. den Sicherheitsverantwortlichen des Teams geprüft und freigegeben werden.",
        ),
      ),
    );
  }

  /** Zurück/Weiter-Leiste. */
  function renderPager(chapter, pageNumber, total) {
    const previous =
      pageNumber > 1
        ? el(
            "a",
            { class: "button", href: chapterHash(chapter.id, pageNumber - 1) },
            "Zurück",
          )
        : el("a", { class: "button", href: "#/" }, "Übersicht");
    let next;
    if (pageNumber < total) {
      next = el(
        "a",
        {
          class: "button button--primary",
          href: chapterHash(chapter.id, pageNumber + 1),
          "data-next": "",
        },
        "Weiter",
      );
    } else if (chapter.quiz) {
      next = el(
        "a",
        {
          class: "button button--primary",
          href: chapterHash(chapter.id, "quiz"),
          "data-next": "",
        },
        "Zum Quiz",
      );
    } else {
      next = el(
        "a",
        { class: "button button--primary", href: "#/" },
        "Zur Übersicht",
      );
    }
    return el(
      "nav",
      { class: "pager", "aria-label": "Seitennavigation" },
      previous,
      el("span", { class: "pager__spacer" }),
      next,
    );
  }

  EM.define("js/views/chapter.js", { renderChapter });
})();
