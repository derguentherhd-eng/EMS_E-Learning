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
  const { createBlockContext, renderElements } =
    EM.require("js/core/render.js");
  const { chapterHash } = EM.require("js/core/router.js");
  const { markVisited } = EM.require("js/core/store.js");
  const { statusBar } = EM.require("js/ui/statusbar.js");
  const { isReleased, isSafetyChapter } = EM.require("js/content/documents.js");
  const { renderNotFound } = EM.require("js/views/not-found.js");
  const { renderSafetyRecord } = EM.require("js/views/safety-record-view.js");
  const { currentLanguage, protectHumanTranslation } =
    EM.require("js/ui/language.js");
  const { humanTranslation, isUsable, needsHumanTranslation } = EM.require(
    "js/content/translations.js",
  );

  /**
   * Pause (ms), in der der Hinweis unter „Weiter" leer bleibt, bevor er neu gesetzt wird.
   * Ohne das Leeren liest ein Screenreader denselben Text bei einem zweiten Klick nicht
   * erneut vor, weil sich der Inhalt der aria-live-Region nicht ändert.
   */
  const LIVE_REGION_RESET_MS = 30;

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
    if (!chapter.pages[pageNumber - 1]) {
      return renderNotFound(
        `Das Kapitel „${chapter.meta.titel}" hat keine Seite ${pageNumber}.`,
      );
    }
    // Sicherheitsunterweisung in einer anderen Sprache: geprüfte Handübersetzung statt
    // maschineller Übersetzung (js/content/translations.js). Fortschritt und Links laufen weiter
    // über das deutsche Kapitel (gleiche ID und Seitenzahl).
    const human = localized(course, chapter);
    const shown = human && isUsable(human) ? human.chapter : chapter;
    const page = shown.pages[pageNumber - 1];

    const reviewMode = store.get().reviewMode;
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
      pageNumber === 1 ? [...shown.preamble, ...page.elements] : page.elements;

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
            `Sektor ${index + 1} · ${shown.meta.kurztitel ?? shown.meta.titel}`,
          ),
          el(
            "p",
            {},
            `Seite ${pageNumber} von ${total} · ca. ${shown.meta.dauer} min`,
          ),
        ),
        statusBar(pageNumber, total),
        el("h1", { class: "view-title" }, page.title),
      ),
      reviewMode ? reviewNotice() : null,
      pageNumber === 1 ? renderFirstPageIntro(shown, reviewMode) : null,
      pageNumber === 1 ? renderSafetyRecord({ course, chapter, store }) : null,
      renderElements(elements, context),
    );

    if (human) {
      markLocalized(article, human);
    }

    const pager = renderPager(chapter, pageNumber, total);
    // Prüfmodus (Einstellungen): „Weiter" nie sperren, damit die Redaktion schnell durchklicken kann.
    if (!reviewMode) {
      lockUntilSolved(article, pager);
    }

    return {
      title: `${page.title} · ${shown.meta.kurztitel ?? shown.meta.titel}`,
      chapterId: chapter.id,
      node: el(
        "div",
        {},
        human && !isUsable(human) ? localizedNotice(human) : null,
        article,
        pager,
      ),
      languageDependent: needsHumanTranslation(chapter),
    };
  }

  /**
   * Handübersetzung für die gewählte Sprache – nur bei Kapiteln, die eine brauchen
   * (Sicherheitsunterweisung), und nur, wenn nicht Deutsch gewählt ist.
   * @param {Object} course
   * @param {Object} chapter  deutsches Kapitel
   * @returns {ReturnType<typeof humanTranslation>|null}
   */
  function localized(course, chapter) {
    const language = currentLanguage();
    return needsHumanTranslation(chapter) && language !== "de"
      ? humanTranslation(course, chapter, language)
      : null;
  }

  /**
   * Kennzeichnet den Inhalt für die automatische Übersetzung: Handübersetzung schützen bzw.
   * das deutsche Original ganz von der maschinellen Übersetzung ausnehmen.
   * @param {HTMLElement} article
   * @param {Object} human  Eintrag aus humanTranslation()
   */
  function markLocalized(article, human) {
    if (isUsable(human)) {
      article.setAttribute("data-human-translation", human.chapter.language);
      article.lang = human.chapter.language;
      protectHumanTranslation(article, human.text);
    } else {
      article.setAttribute("translate", "no");
      article.lang = "de";
    }
  }

  /**
   * Hinweis, solange keine passende Handübersetzung da ist (wird selbst maschinell übersetzt).
   * @param {{state: string}} human
   * @returns {HTMLElement}
   */
  function localizedNotice(human) {
    return el(
      "p",
      { class: "notice", role: "status" },
      human.state === "laden"
        ? "Die geprüfte Übersetzung der Sicherheitsunterweisung wird geladen …"
        : "Für diese Sprache gibt es noch keine geprüfte Übersetzung der Sicherheitsunterweisung. Sie wird deshalb auf Deutsch angezeigt – Sicherheitsregeln werden nicht maschinell übersetzt.",
    );
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
    /** @type {ReturnType<typeof setTimeout>|undefined} */
    let liveRegionTimer;

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
        ? `Löse zuerst ${open === 1 ? "die Übung" : `die ${open} Übungen`} auf dieser Seite, dann geht es weiter.`
        : "";
    }

    next.addEventListener("click", (event) => {
      if (next.getAttribute("aria-disabled") === "true") {
        event.preventDefault();
        hint.textContent = "";
        // Kurz leeren, damit Screenreader die Meldung erneut vorlesen.
        clearTimeout(liveRegionTimer);
        liveRegionTimer = setTimeout(update, LIVE_REGION_RESET_MS);
        const openExercise = article.querySelector('[data-exercise="offen"]');
        if (openExercise) {
          // Fokus auf die offene Übung, damit Tastaturnutzer dort weitermachen.
          openExercise.setAttribute("tabindex", "-1");
          openExercise.focus({ preventScroll: true });
          openExercise.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    });
    article.addEventListener("exercise-change", update);
    update();
  }

  /** Hinweis oben auf jeder Seite, solange der Prüfmodus an ist. */
  function reviewNotice() {
    return el(
      "p",
      { class: "notice", role: "note" },
      "Prüfmodus ist an: Übungen und Quiz-Sperren sind ausgeschaltet. Ausschalten unter ",
      el("a", { href: "#/einstellungen" }, "Einstellungen"),
      ".",
    );
  }

  /**
   * Freigabe-Hinweis, Lernziele und „Direkt zum Quiz" auf Seite 1.
   * @param {Object} chapter
   * @param {boolean} reviewMode  Prüfmodus an: „Direkt zum Quiz" auch im Sicherheitskapitel
   */
  function renderFirstPageIntro(chapter, reviewMode) {
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
      chapter.quiz && (!isSafetyChapter(chapter) || reviewMode)
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

  EM.define("js/views/chapter.js", {
    renderChapter,
    localized,
    markLocalized,
    localizedNotice,
  });
})();
