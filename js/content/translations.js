/*
 * translations.js – handgemachte Übersetzungen der Sicherheitsunterweisung
 *
 * Warum? Die automatische Übersetzung im Browser (js/ui/language.js) ist für Sicherheitsregeln zu
 * ungenau. Sicherheitskapitel (Feld „freigegeben“) gibt es deshalb zusätzlich als geprüfte
 * Übersetzung je Sprache. Ist eine Sprache gewählt, zeigt der Kurs diese Fassung; die automatische
 * Übersetzung lässt deren Texte in Ruhe und übersetzt nur Bedienelemente.
 *
 * Ablage: content/uebersetzungen/<Kapiteldatei ohne .md>.<Sprachcode>.md, z. B.
 *   content/uebersetzungen/05-arbeitssicherheit.en.md
 * Aufbau: wie das deutsche Kapitel (gleiche Seiten, Bausteine, Antworten, Quiz), Kopfbereich mit
 *   titel, kurztitel, dauer, version, freigegeben, lernziele (übersetzt) sowie
 *   sprache      Sprachcode (en, fr, …)
 *   quelle       Dateiname des deutschen Kapitels
 *   quellstand   Prüfsumme des deutschen Textes, aus dem übersetzt wurde (sourceStamp)
 *
 * Wann gilt eine Übersetzung? Nur wenn ihre „version“ der deutschen entspricht und ihr Aufbau
 * passt (compareStructure). Sonst zeigt der Kurs das deutsche Original – nie eine maschinelle
 * Übersetzung. Weicht nur „quellstand“ ab (deutscher Text geändert, Version gleich), wird die
 * Übersetzung noch gezeigt, die Prüfseite und der Editor warnen aber.
 *
 * Wenn du hier etwas ändern willst …
 *   – Weitere Kapitel mit Handübersetzung: needsHumanTranslation().
 *   – Was als „gleicher Aufbau“ gilt: compareStructure() / signature().
 */

(function () {
  "use strict";

  const { normalizeText, parseChapter, isSafetyChapter } = EM.require(
    "js/content/documents.js",
  );
  const { parseFrontmatter } = EM.require("js/content/frontmatter.js");
  const { serializeChapter } = EM.require("js/content/serialize.js");
  const { LANGUAGES } = EM.require("js/ui/language.js");

  const TRANSLATION_DIR = "content/uebersetzungen";
  const SOURCE_LANGUAGE = "de";

  /** Sprachen, für die es Handübersetzungen geben muss (alle der Sprachauswahl außer Deutsch). */
  const TRANSLATION_LANGUAGES = LANGUAGES.filter(
    (language) => language.code !== SOURCE_LANGUAGE,
  );

  /**
   * Braucht dieses Kapitel Handübersetzungen? (Derzeit: alle Sicherheitskapitel.)
   * @param {{meta: Object}} chapter
   * @returns {boolean}
   */
  function needsHumanTranslation(chapter) {
    return isSafetyChapter(chapter);
  }

  /**
   * @param {string} chapterFile  z. B. '05-arbeitssicherheit.md'
   * @param {string} language     z. B. 'en'
   * @returns {string}  Dateiname der Übersetzung
   */
  function translationFileName(chapterFile, language) {
    return `${chapterFile.replace(/\.md$/i, "")}.${language}.md`;
  }

  /**
   * @param {string} chapterFile
   * @param {string} language
   * @returns {string}  Pfad ab Projektordner
   */
  function translationPath(chapterFile, language) {
    return `${TRANSLATION_DIR}/${translationFileName(chapterFile, language)}`;
  }

  /**
   * Prüfsumme des deutschen Textes ohne Kopfbereich. Der Text wird dafür eingelesen und in die
   * Standardform des Editors gebracht (serialize.js), Leerraum zählt nicht: So ergibt dieselbe
   * Fassung auf der Website, im Editor und nach dem Speichern dieselbe Prüfsumme. Der Kopfbereich
   * zählt nicht mit, damit z. B. das Freigeben keine Übersetzung als geändert markiert.
   * @param {string} text  Inhalt der deutschen Kapiteldatei
   * @returns {string}
   */
  function sourceStamp(text) {
    const chapter = parseChapter(normalizeText(text), "quelle.md");
    const body = parseFrontmatter(serializeChapter(chapter))
      .body.replace(/\s+/g, " ")
      .trim();
    let hash = 0x811c9dc5;
    for (const char of body) {
      hash ^= char.codePointAt(0);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  /**
   * Liest eine Übersetzungsdatei. Die Kapitel-ID bleibt die des deutschen Kapitels, damit
   * Fortschritt, Quizergebnisse und Links gleich bleiben.
   * @param {string} text
   * @param {string} chapterFile  Dateiname des deutschen Kapitels
   * @param {string} language
   * @returns {Object}  ChapterModel (plus path der Übersetzungsdatei)
   */
  function parseTranslation(text, chapterFile, language) {
    const chapter = parseChapter(text, chapterFile, TRANSLATION_DIR);
    chapter.path = translationPath(chapterFile, language);
    chapter.language = language;
    return chapter;
  }

  /**
   * Strukturelle Signatur eines Wertes: Zahlen, Wahrheitswerte, Listenlängen und welche Texte
   * innerhalb einer Liste gleich sind (z. B. gleiche Kategorien einer Zuordnung). Der Wortlaut
   * selbst zählt nicht – er ist ja übersetzt.
   * @param {*} value
   * @returns {*}
   */
  function signature(value) {
    if (Array.isArray(value)) {
      const patterns = {};
      const objects = value.every(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      );
      if (value.length > 0 && objects) {
        for (const key of Object.keys(value[0])) {
          if (value.every((item) => typeof item[key] === "string")) {
            const seen = new Map();
            patterns[key] = value
              .map((item) => {
                if (!seen.has(item[key])) {
                  seen.set(item[key], seen.size);
                }
                return seen.get(item[key]);
              })
              .join(",");
          }
        }
      }
      return { length: value.length, items: value.map(signature), patterns };
    }
    if (value && typeof value === "object") {
      const result = {};
      for (const key of Object.keys(value).sort()) {
        if (["line", "errors", "raw"].includes(key) || /Line$/.test(key)) {
          continue;
        }
        // Bildpfade müssen gleich bleiben, Texte nicht.
        result[key] =
          ["src", "bild"].includes(key) && typeof value[key] === "string"
            ? value[key]
            : signature(value[key]);
      }
      return result;
    }
    if (typeof value === "string") {
      return value.trim() ? "text" : "";
    }
    return value;
  }

  /** Grobe Form eines Markdown-Textes: Überschriften, Listen, Tabellen, Bilder, Absätze. */
  function markdownShape(markdown) {
    return markdown
      .split("\n")
      .map((line) => {
        const text = line.trim();
        if (!text) {
          return "";
        }
        if (/^#{1,6} /.test(text)) {
          return text.match(/^#+/)[0];
        }
        if (/^\d+\. /.test(text)) {
          return "1.";
        }
        if (/^- /.test(text)) {
          return "-";
        }
        if (/^\|/.test(text)) {
          return `|${(text.match(/\|/g) ?? []).length}`;
        }
        if (/^!\[/.test(text)) {
          return `bild:${(text.match(/\]\(([^ )]+)/) ?? [])[1]}`;
        }
        return "absatz";
      })
      .filter((shape, index, all) => shape !== "" || all[index - 1] !== "")
      .join(" ");
  }

  /** @param {Object} element  Seitenelement (text, image, block) */
  function elementSignature(element) {
    if (element.type === "text") {
      return { type: "text", shape: markdownShape(element.markdown) };
    }
    if (element.type === "image") {
      return { type: "image", src: element.src };
    }
    return {
      type: element.type,
      name: element.name,
      data: signature(element.data),
    };
  }

  /**
   * Vergleicht Übersetzung und deutsches Original.
   * @param {Object} german       ChapterModel des deutschen Kapitels
   * @param {Object} translation  ChapterModel der Übersetzung
   * @returns {string[]}  Abweichungen (leer = passt)
   */
  function compareStructure(german, translation) {
    const problems = [];
    for (const key of ["version", "dauer", "freigegeben"]) {
      if (String(translation.meta[key]) !== String(german.meta[key])) {
        problems.push(
          `Kopfbereich „${key}“ ist ${translation.meta[key] ?? "leer"}, im Original ${german.meta[key]}.`,
        );
      }
    }
    if (translation.meta.lernziele.length !== german.meta.lernziele.length) {
      problems.push("Die Zahl der Lernziele weicht ab.");
    }
    if (translation.pages.length !== german.pages.length) {
      problems.push(
        `${translation.pages.length} Seiten statt ${german.pages.length}.`,
      );
    }
    const germanParts = [
      german.preamble,
      ...german.pages.map((p) => p.elements),
    ];
    const translatedParts = [
      translation.preamble,
      ...translation.pages.map((p) => p.elements),
    ];
    const count = Math.min(germanParts.length, translatedParts.length);
    for (let index = 0; index < count; index += 1) {
      const germanSig = germanParts[index].map(elementSignature);
      const translatedSig = translatedParts[index].map(elementSignature);
      if (JSON.stringify(germanSig) !== JSON.stringify(translatedSig)) {
        const where =
          index === 0
            ? "Vor der ersten Seite"
            : `Seite ${index} („${german.pages[index - 1].title}“)`;
        problems.push(
          `${where}: Aufbau weicht ab (Absätze, Bilder oder Übungen und ihre Antworten).`,
        );
      }
    }
    if (Boolean(german.quiz) !== Boolean(translation.quiz)) {
      problems.push("Das Quiz fehlt.");
    } else if (german.quiz) {
      if (
        JSON.stringify(signature(german.quiz.data)) !==
        JSON.stringify(signature(translation.quiz.data))
      ) {
        problems.push(
          "Quiz: Fragen, Antworten, richtige Antworten oder Pflichtfragen weichen ab.",
        );
      }
      const titles = new Set(translation.pages.map((page) => page.title));
      for (const question of translation.quiz.data.questions) {
        if (question.pageRef && !titles.has(question.pageRef)) {
          problems.push(
            `Quiz: Verweis „~ ${question.pageRef}“ passt zu keinem Seitentitel.`,
          );
        }
      }
    }
    const errors = [
      ...translation.errors,
      ...[translation.preamble, ...translation.pages.map((p) => p.elements)]
        .flat()
        .flatMap((element) => element.errors ?? []),
      ...(translation.quiz?.errors ?? []),
    ];
    if (errors.length > 0) {
      problems.push(
        `${errors.length} Lesefehler, z. B. Zeile ${errors[0].line}: ${errors[0].message}`,
      );
    }
    return problems;
  }

  /**
   * Zustand einer Übersetzung im Vergleich zum Original.
   * @param {Object} german
   * @param {string} germanText   Inhalt der deutschen Datei (für quellstand)
   * @param {Object|null} translation
   * @returns {{state: 'fehlt'|'fehlerhaft'|'veraltet'|'pruefen'|'aktuell', problems: string[]}}
   *   fehlerhaft = Aufbau passt nicht · veraltet = andere Version · pruefen = deutscher Text seit
   *   der Übersetzung geändert (gleiche Version) · aktuell = alles passt
   */
  function translationStatus(german, germanText, translation) {
    if (!translation) {
      return { state: "fehlt", problems: [] };
    }
    if (String(translation.meta.version) !== String(german.meta.version)) {
      return {
        state: "veraltet",
        problems: [
          `Übersetzt aus Version ${translation.meta.version}, das Original hat Version ${german.meta.version}.`,
        ],
      };
    }
    const problems = compareStructure(german, translation);
    if (problems.length > 0) {
      return { state: "fehlerhaft", problems };
    }
    if (
      germanText &&
      String(translation.meta.quellstand ?? "") !== sourceStamp(germanText)
    ) {
      return {
        state: "pruefen",
        problems: [
          "Der deutsche Text wurde seit dieser Übersetzung geändert. Bitte die Übersetzung nachziehen und „quellstand“ erneuern.",
        ],
      };
    }
    return { state: "aktuell", problems: [] };
  }

  /**
   * Meldungen für Prüfseite und Editor (Format wie validate.js).
   * @param {Object} german
   * @param {string} germanText
   * @param {Object|null} translation
   * @param {{code: string, name: string}} language
   * @returns {Object[]}
   */
  function translationIssues(german, germanText, translation, language) {
    const path = translationPath(german.file, language.code);
    const { state, problems } = translationStatus(
      german,
      germanText,
      translation,
    );
    const label = `Übersetzung ${language.name} (${language.code})`;
    const messages = {
      fehlt: {
        message: `${label} fehlt. Wer ${language.name} wählt, sieht dieses Kapitel auf Deutsch.`,
        fix: `Datei ${path} anlegen (Aufbau wie das deutsche Kapitel, siehe docs/PFLEGE.md).`,
      },
      veraltet: {
        message: `${label} ist veraltet – Teilnehmende sehen dieses Kapitel deshalb auf Deutsch. ${problems.join(" ")}`,
        fix: "Übersetzung an die neue deutsche Fassung anpassen und „version“ angleichen.",
      },
      fehlerhaft: {
        message: `${label} passt nicht zum deutschen Kapitel und wird deshalb nicht angezeigt: ${problems.join(" ")}`,
        fix: "Aufbau der Übersetzung an das Original angleichen (gleiche Seiten, Übungen, Antworten).",
      },
      pruefen: {
        message: `${label}: ${problems.join(" ")}`,
        fix: "Änderungen am deutschen Text in die Übersetzung übernehmen, dann „quellstand“ erneuern.",
      },
    };
    const entry = messages[state];
    if (!entry) {
      return [];
    }
    return [
      {
        file: path,
        line: 0,
        severity: state === "pruefen" ? "warnung" : "fehler",
        ...entry,
      },
    ];
  }

  /**
   * Prüft alle Handübersetzungen eines Kurses (für pruefen.html).
   * @param {Object} course  CourseModel aus loader.js
   * @param {(path: string) => Promise<string|null>} readText
   * @returns {Promise<Object[]>}
   */
  async function checkTranslations(course, readText) {
    const errors = [];
    for (const chapter of course.chapters.filter(needsHumanTranslation)) {
      for (const language of TRANSLATION_LANGUAGES) {
        const text = await readText(
          translationPath(chapter.file, language.code),
        ).catch(() => null);
        const translation =
          text === null
            ? null
            : parseTranslation(text, chapter.file, language.code);
        errors.push(
          ...translationIssues(
            chapter,
            course.sources?.[chapter.path] ?? "",
            translation,
            language,
          ),
        );
      }
    }
    return errors;
  }

  // ── Laden im Kurs (bei Bedarf, mit Zwischenspeicher) ──

  /** Geladene Übersetzungen: Schlüssel 'datei|sprache' → Eintrag. */
  const loaded = new Map();

  /**
   * Liefert die Handübersetzung eines Kapitels für den Kurs. Beim ersten Aufruf wird sie geladen;
   * danach meldet das Ereignis „em-translation-loaded“ (am document), dass neu gezeichnet werden
   * kann.
   * @param {Object} course    CourseModel (mit read und sources aus loader.js)
   * @param {Object} chapter   deutsches Kapitel
   * @param {string} language
   * @returns {{state: 'laden'|'fehlt'|'fehlerhaft'|'veraltet'|'pruefen'|'aktuell', chapter?: Object, text?: string}}
   */
  function humanTranslation(course, chapter, language) {
    const key = `${chapter.file}|${language}`;
    const known = loaded.get(key);
    if (known) {
      return known;
    }
    const entry = { state: "laden" };
    loaded.set(key, entry);
    const path = translationPath(chapter.file, language);
    Promise.resolve(course.read ? course.read(path) : null)
      .catch(() => null)
      .then((text) => {
        if (text === null) {
          entry.state = "fehlt";
        } else {
          const translation = parseTranslation(text, chapter.file, language);
          const status = translationStatus(
            chapter,
            course.sources?.[chapter.path] ?? "",
            translation,
          );
          // „pruefen“ (nur Prüfsumme anders) wird noch angezeigt; Prüfseite und Editor warnen.
          entry.state = status.state;
          entry.chapter = translation;
          entry.text = normalizeText(text);
        }
        document.dispatchEvent(
          new CustomEvent("em-translation-loaded", {
            detail: { file: chapter.file, language },
          }),
        );
      });
    return entry;
  }

  /**
   * Darf die Übersetzung angezeigt werden?
   * @param {{state: string}} entry
   * @returns {boolean}
   */
  function isUsable(entry) {
    return entry.state === "aktuell" || entry.state === "pruefen";
  }

  EM.define("js/content/translations.js", {
    TRANSLATION_DIR,
    TRANSLATION_LANGUAGES,
    needsHumanTranslation,
    translationFileName,
    translationPath,
    sourceStamp,
    parseTranslation,
    compareStructure,
    translationStatus,
    translationIssues,
    checkTranslations,
    humanTranslation,
    isUsable,
  });
})();
