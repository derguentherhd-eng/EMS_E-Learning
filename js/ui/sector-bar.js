/*
 * sector-bar.js – die Sektoranzeige: Fortschritt und Navigation in einem
 *
 * Idee (aus dem Zeitenmonitor der Formel 1): Jedes Kapitel ist ein Sektor.
 *   grau  = offen · gelb = bestanden · lila = Bestzeit (100 %)
 *   ↻     = Kapitel wurde aktualisiert, Quiz bitte neu machen
 * Am Ende steht die Zielflagge für das Qualifying.
 *
 * Barrierefreiheit: Der Zustand steckt nie nur in der Farbe. Jedes Segment hat ein Symbol und
 * einen (für Screenreader lesbaren) Text, z. B. „Sektor 2: Einstein Motorsport – Bestzeit".
 * Das aktuelle Kapitel ist mit aria-current markiert.
 *
 * Zusammenspiel: main.js erzeugt die Anzeige einmal nach dem Laden des Kurses und ruft bei
 * jedem Seitenwechsel setCurrent() auf. Änderungen am Fortschritt kommen über store.subscribe.
 *
 * Wenn du hier etwas ändern willst …
 *   – Farben/Formen: css/components/sector-bar.css.
 *   – Zustandslogik: getChapterStatus() in js/core/store.js.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { icon } = EM.require("js/ui/icons.js");
  const { chapterHash } = EM.require("js/core/router.js");
  const { getChapterStatus, isCertificateUnlocked, isQualifyingUnlocked } =
    EM.require("js/core/store.js");

  /** Sichtbarer bzw. vorgelesener Text je Zustand. */
  const STATUS_TEXT = {
    offen: "offen",
    bestanden: "bestanden",
    bestzeit: "Bestzeit",
    aktualisiert: "aktualisiert – Quiz neu machen",
  };

  const STATUS_ICON = {
    bestanden: "check",
    bestzeit: "star",
    aktualisiert: "refresh",
  };

  /**
   * Baut die Sektoranzeige in einen Container (das leere <nav class="sector-bar"> aus index.html).
   *
   * @param {HTMLElement} container
   * @param {import('../content/loader.js').CourseModel} course
   * @param {import('../core/store.js').Store} store
   * @returns {{setCurrent: (chapterId: string|null) => void}}
   */
  function createSectorBar(container, course, store) {
    let currentId = null;

    function render() {
      const state = store.get();
      const list = el(
        "ol",
        { class: "sector-bar__list" },
        course.chapters.map((chapter, index) => {
          const status = getChapterStatus(state, chapter);
          const label = `Sektor ${index + 1}: ${chapter.meta.kurztitel ?? chapter.meta.titel} – ${STATUS_TEXT[status]}`;
          return el(
            "li",
            { class: "sector-bar__item" },
            el(
              "a",
              {
                class: `sector-bar__segment sector-bar__segment--${status}`,
                href: chapterHash(chapter.id, 1),
                title: label,
                "aria-current": chapter.id === currentId ? "step" : null,
              },
              el(
                "span",
                { class: "sector-bar__number", "aria-hidden": "true" },
                `S${index + 1}`,
              ),
              el(
                "span",
                { class: "sector-bar__label", "aria-hidden": "true" },
                chapter.meta.kurztitel ?? "",
              ),
              STATUS_ICON[status]
                ? icon(STATUS_ICON[status], "sector-bar__icon")
                : null,
              el("span", { class: "visually-hidden" }, label),
            ),
          );
        }),
        finishItem(state, course),
      );

      const currentIndex = course.chapters.findIndex(
        (chapter) => chapter.id === currentId,
      );
      const caption =
        currentIndex === -1
          ? null
          : el(
              "p",
              { class: "sector-bar__caption", "aria-hidden": "true" },
              `S${currentIndex + 1} · ${course.chapters[currentIndex].meta.kurztitel ?? ""}`,
            );
      container.replaceChildren(list, caption ?? "");
    }

    container.hidden = course.chapters.length === 0;
    store.subscribe(render);
    render();

    return {
      setCurrent(chapterId) {
        currentId = chapterId;
        render();
      },
    };
  }

  /** Letztes Segment: Zielflagge für Qualifying und Zertifikat. */
  function finishItem(state, course) {
    const unlocked = isQualifyingUnlocked(state, course.chapters);
    const done = isCertificateUnlocked(state, course.meta.kursversion);
    const label = done
      ? "Qualifying bestanden – Zertifikat verfügbar"
      : unlocked
        ? "Qualifying freigeschaltet"
        : "Qualifying – gesperrt, bis alle Sektoren bestanden sind";
    const modifier = done ? "done" : unlocked ? "ready" : "locked";
    return el(
      "li",
      { class: "sector-bar__item sector-bar__item--finish" },
      el(
        "a",
        {
          class: `sector-bar__segment sector-bar__finish sector-bar__finish--${modifier}`,
          href: done ? "#/zertifikat" : "#/qualifying",
          title: label,
        },
        icon(done || unlocked ? "flag" : "lock", "sector-bar__icon"),
        el("span", { class: "visually-hidden" }, label),
      ),
    );
  }

  EM.define("js/ui/sector-bar.js", { createSectorBar, STATUS_TEXT });
})();
