/*
 * tests-course.js – Selbsttests: Quiz-Bewertung, Fortschritt/Speicher und Zertifikat
 *
 * Zusammenspiel: registriert beim Laden Testfälle über js/tests/test-utils.js;
 * ausgeführt und angezeigt werden sie von js/pages/tests.js.
 * Geprüfter Code: js/course/*, js/core/store.js.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Logik: einen test(...)-Block in der passenden group(...) ergänzen.
 *   – Neuer Baustein: in tests-blocks.js (BLOCK_SAMPLES) ein gültiges und ein
 *     ungültiges Beispiel ergänzen; Parser- und Round-Trip-Tests entstehen daraus.
 */

(function () {
  "use strict";

  const { drawQualifying, drawQuestions, isAnswerCorrect, scoreAttempt } =
    EM.require("js/course/quiz.js");
  const {
    createEmptyState,
    createStore,
    getChapterStatus,
    isCertificateUnlocked,
    isQualifyingUnlocked,
    normalizeState,
    recordQualifying,
    recordQuizResult,
  } = EM.require("js/core/store.js");
  const { hashText, trackExercise } = EM.require("js/blocks/block-utils.js");
  const { certificateFileName, createVerificationCode, formatGermanDate } =
    EM.require("js/course/certificate.js");
  const { safetyRecordFileName } = EM.require("js/course/safety-record.js");
  const { assert, assertEqual, group, test } = EM.require(
    "js/tests/test-utils.js",
  );

  // ───────────────────────────── Quiz ─────────────────────────────

  group("Quiz-Bewertung");

  /** Vorhersagbarer Zufall für Tests (immer gleiche Folge). */
  function seededRandom(seed = 42) {
    let value = seed;
    return () => {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  const POOL = {
    count: 3,
    questions: [
      ...Array.from({ length: 6 }, (_, index) => ({
        text: `N${index}`,
        critical: false,
        answers: [
          { text: "a", correct: true },
          { text: "b", correct: false },
        ],
        explanation: "x",
        pageRef: "",
      })),
      {
        text: "K1",
        critical: true,
        answers: [
          { text: "a", correct: true },
          { text: "b", correct: false },
        ],
        explanation: "x",
        pageRef: "",
      },
      {
        text: "K2",
        critical: true,
        answers: [
          { text: "a", correct: true },
          { text: "b", correct: false },
        ],
        explanation: "x",
        pageRef: "",
      },
    ],
  };

  test("anzahl=3 zieht 3 normale + alle kritischen Fragen", () => {
    const drawn = drawQuestions(POOL, seededRandom());
    assertEqual(drawn.length, 5);
    assertEqual(drawn.filter((question) => question.critical).length, 2);
  });

  test("Neuer Versuch bevorzugt andere Fragen", () => {
    const first = drawQuestions(POOL, seededRandom(1));
    const avoid = new Set(first.map((question) => question.text));
    const second = drawQuestions(POOL, seededRandom(2), avoid).filter(
      (question) => !question.critical,
    );
    assert(
      second.every((question) => !avoid.has(question.text)),
      "Wiederholte Frage, obwohl genug neue da sind",
    );
  });

  test("Mehrfachauswahl: nur exakt richtige Auswahl zählt", () => {
    const question = {
      answers: [
        { text: "a", correct: true },
        { text: "b", correct: true },
        { text: "c", correct: false },
      ],
    };
    assert(isAnswerCorrect(question, ["b", "a"]), "a+b sollte richtig sein");
    assert(!isAnswerCorrect(question, ["a"]), "nur a ist unvollständig");
    assert(!isAnswerCorrect(question, ["a", "b", "c"]), "c ist zu viel");
  });

  test("Bestehen: Grenze erreicht und alle Sicherheitsfragen richtig", () => {
    function normal(correct) {
      return { question: { critical: false }, correct };
    }
    function critical(correct) {
      return { question: { critical: true }, correct };
    }
    assertEqual(
      scoreAttempt(
        [normal(true), normal(true), normal(true), normal(true), normal(false)],
        80,
      ).passed,
      true,
      "4/5 = 80 %",
    );
    assertEqual(
      scoreAttempt(
        [normal(true), normal(true), normal(true), normal(false)],
        80,
      ).passed,
      false,
      "75 %",
    );
    const withCritical = scoreAttempt(
      [
        normal(true),
        normal(true),
        normal(true),
        normal(true),
        normal(true),
        normal(true),
        normal(true),
        normal(true),
        normal(true),
        critical(false),
      ],
      80,
    );
    assertEqual(
      [withCritical.percent, withCritical.passed, withCritical.criticalFailed],
      [90, false, 1],
      "90 %, aber Sicherheitsfrage falsch",
    );
  });

  test('Prozent wird abgerundet (79,9 % ist nie „80 %")', () => {
    const answered = Array.from({ length: 1000 }, (_, index) => ({
      question: { critical: false },
      correct: index < 799,
    }));
    assertEqual(scoreAttempt(answered, 80), {
      correct: 799,
      total: 1000,
      percent: 79,
      passed: false,
      criticalFailed: 0,
    });
  });

  test("Qualifying: je Kapitel mindestens eine Frage, Gesamtzahl stimmt", () => {
    const chapters = ["a", "b", "c"].map((id) => ({
      id,
      quiz: {
        data: {
          questions: POOL.questions.map((question) => ({
            ...question,
            text: `${id}-${question.text}`,
          })),
        },
      },
    }));
    const drawn = drawQualifying(chapters, 8, seededRandom(7));
    assertEqual(drawn.length, 8);
    assertEqual(new Set(drawn.map((entry) => entry.chapter.id)).size, 3);
    assertEqual(
      new Set(drawn.map((entry) => entry.question.text)).size,
      8,
      "keine doppelten Fragen",
    );
  });

  // ───────────────────────────── Fortschritt ─────────────────────────────

  group("Fortschritt und Speicher");

  const chapterA = { id: "a", meta: { version: 1 } };
  const chapterB = { id: "b", meta: { version: 2 } };

  test("Besseres Ergebnis bleibt, schlechteres überschreibt nicht", () => {
    const state = createEmptyState();
    recordQuizResult(state, "a", 1, 80, true);
    recordQuizResult(state, "a", 1, 60, false);
    assertEqual(state.results.a.best, 80);
    recordQuizResult(state, "a", 1, 100, true);
    assertEqual(getChapterStatus(state, chapterA), "bestzeit");
    recordQuizResult(state, "a", 1, 90, false); // 90 %, aber Sicherheitsfrage falsch
    assertEqual(state.results.a.best, 100);
  });

  test("Bestanden schlägt höhere, aber nicht bestandene Prozentzahl", () => {
    const state = createEmptyState();
    recordQuizResult(state, "a", 1, 90, false);
    recordQuizResult(state, "a", 1, 80, true);
    assertEqual(getChapterStatus(state, chapterA), "bestanden");
  });

  test('Höhere Kapitelversion → „aktualisiert", Qualifying wieder gesperrt', () => {
    const state = createEmptyState();
    recordQuizResult(state, "a", 1, 100, true);
    recordQuizResult(state, "b", 1, 80, true);
    assertEqual(getChapterStatus(state, chapterB), "aktualisiert");
    assertEqual(isQualifyingUnlocked(state, [chapterA, chapterB]), false);
  });

  test("Deaktivierte Kapitel blockieren das Qualifying nicht, Fortschritt bleibt erhalten", () => {
    const state = createEmptyState();
    recordQuizResult(state, "a", 1, 80, true);
    recordQuizResult(state, "alt", 1, 0, false); // Kapitel „alt" steht nicht mehr in kurs.md
    assertEqual(isQualifyingUnlocked(state, [chapterA]), true);
    assert(
      state.results.alt,
      "Fortschritt des deaktivierten Kapitels wurde gelöscht",
    );
  });

  test("Zertifikat hängt an Qualifying und Kursversion", () => {
    const state = createEmptyState();
    recordQualifying(state, "1.0", 88, true);
    assertEqual(isCertificateUnlocked(state, "1.0"), true);
    assertEqual(isCertificateUnlocked(state, "1.1"), false);
  });

  test("Anläufe bis zum ersten Bestehen werden gezählt (Nachweis Sicherheitsunterweisung)", () => {
    const state = createEmptyState();
    recordQuizResult(state, "a", 1, 50, false, "2026-10-01");
    recordQuizResult(state, "a", 1, 70, false, "2026-10-02");
    recordQuizResult(state, "a", 1, 85, true, "2026-10-03");
    recordQuizResult(state, "a", 1, 100, true, "2026-10-04");
    assertEqual(state.results.a.attempts, 4);
    assertEqual(state.results.a.passedAfter, 3, "erstes Bestehen bleibt");
    assertEqual(state.results.a.passedDate, "2026-10-03");
    assertEqual(state.results.a.best, 100);
    recordQuizResult(state, "a", 2, 90, true, "2026-11-01");
    assertEqual(
      [state.results.a.attempts, state.results.a.passedAfter],
      [1, 1],
      "neue Kapitelversion zählt neu",
    );
  });

  test("Gelöste Übungen werden gemerkt und reichen „Weiter“ frei", () => {
    const store = createStore({ storage: null });
    const context = { store, chapterId: "k" };
    const section = document.createElement("section");
    const markSolved = trackExercise(section, context, "zuordnen:test");
    assertEqual(section.dataset.exercise, "offen");
    let events = 0;
    section.addEventListener("exercise-change", () => {
      events += 1;
    });
    markSolved();
    assertEqual(section.dataset.exercise, "geloest");
    assertEqual(events, 1, "Ereignis für die Kapitelseite");
    const again = document.createElement("section");
    trackExercise(again, context, "zuordnen:test");
    assertEqual(
      again.dataset.exercise,
      "geloest",
      "beim nächsten Besuch schon gelöst",
    );
    assertEqual(
      normalizeState({ exercises: { k: ["abc"] } }).exercises.k[0],
      "abc",
    );
  });

  test("Beschädigte gespeicherte Daten werden repariert", () => {
    assertEqual(normalizeState("kaputt"), createEmptyState());
    assertEqual(normalizeState({ theme: "lila", results: [] }).theme, "system");
  });

  test("Ohne localStorage läuft alles im Arbeitsspeicher", () => {
    const store = createStore({ storage: null });
    store.update((state) => recordQuizResult(state, "a", 1, 80, true));
    assertEqual(store.isPersistent(), false);
    assertEqual(store.get().results.a.best, 80);
  });

  test("Speicher, der beim Schreiben scheitert, legt den Kurs nicht lahm", () => {
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error("voll");
      },
      removeItem: () => {},
    };
    const store = createStore({ storage: broken });
    store.update((state) => {
      state.last = "#/glossar";
    });
    assertEqual(store.get().last, "#/glossar");
    assertEqual(store.isPersistent(), false);
  });

  test("Checklisten-Schlüssel hängt am Text", () => {
    assertEqual(
      hashText("Drive-Zugang beantragen"),
      hashText("Drive-Zugang beantragen"),
    );
    assert(
      hashText("A") !== hashText("B"),
      "verschiedene Texte, gleicher Schlüssel",
    );
  });

  // ───────────────────────────── Zertifikat ─────────────────────────────

  group("Zertifikat");

  test("Prüfcode: deterministisch, Format XXXX-XXXX, ändert sich mit den Eingaben", () => {
    const code = createVerificationCode(
      "Jürgen Weiß-Özdemir",
      "2026-10-13",
      "1.0",
    );
    assert(
      /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(code),
      `Format: ${code}`,
    );
    assertEqual(
      createVerificationCode("  jürgen   weiß-özdemir ", "2026-10-13", "1.0"),
      code,
      "Groß-/Kleinschreibung und Leerzeichen egal",
    );
    assert(
      createVerificationCode("Jürgen Weiß-Özdemir", "2026-10-14", "1.0") !==
        code,
      "Datum fließt ein",
    );
    assert(
      createVerificationCode("Jürgen Weiß-Özdemir", "2026-10-13", "1.1") !==
        code,
      "Version fließt ein",
    );
  });

  test("Dateiname ist dateisystemsicher", () => {
    assertEqual(
      certificateFileName("Jürgen Weiß-Özdemir"),
      "Onboarding-Zertifikat-Juergen-Weiss-Oezdemir.pdf",
    );
    assertEqual(
      certificateFileName("  Anna / Bé <3 "),
      "Onboarding-Zertifikat-Anna-Be-3.pdf",
    );
    assertEqual(
      certificateFileName("***"),
      "Onboarding-Zertifikat-Teilnehmende.pdf",
    );
  });

  test("Dateiname des Nachweises Sicherheitsunterweisung", () =>
    assertEqual(
      safetyRecordFileName("Jürgen Weiß", "2026-10-13"),
      "Nachweis-Sicherheitsunterweisung-Juergen-Weiss-2026-10-13.pdf",
    ));

  test("Datum auf Deutsch", () =>
    assertEqual(formatGermanDate("2026-03-01"), "1. März 2026"));

  EM.define("js/tests/tests-course.js", {});
})();
