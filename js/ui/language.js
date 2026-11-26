/*
 * language.js – Sprachauswahl mit Übersetzung direkt im Browser
 *
 * Der Kurs wird nur auf Deutsch gepflegt. Über die Sprachauswahl in der Kopfleiste übersetzt der
 * Browser die Seite selbst in eine andere Sprache. Dafür läuft Bergamot (Mozilla, dieselbe Technik
 * wie die eingebaute Übersetzung von Firefox) als WebAssembly direkt auf dem Gerät:
 *   – Programm: vendor/bergamot/ (liegt im Kurs, MPL-2.0).
 *   – Sprachmodelle: werden beim ersten Umschalten einmalig von Mozillas Servern geladen
 *     (Verzeichnis: REGISTRY_PATH, etwa 20–25 MB je Richtung) und danach vom Browser-Cache
 *     genommen.
 *     Die Texte selbst verlassen das Gerät nicht.
 *   – Für Deutsch gibt es nur das Modell Deutsch → Englisch. Alle anderen Sprachen laufen über
 *     Englisch als Zwischenschritt (Deutsch → Englisch → Zielsprache, doppelter Download).
 *
 * Funktionsweise:
 *   – Absätze, Listenpunkte, Überschriften und Tabellenzellen mit einfacher Formatierung (fett,
 *     kursiv, Links) werden als Ganzes übersetzt, damit der Satzzusammenhang erhalten bleibt.
 *   – Enthält ein Absatz Bedienelemente (z. B. Glossar-Knöpfe), wird Stück für Stück übersetzt,
 *     damit deren Funktion erhalten bleibt.
 *   – Was später neu erscheint (Seitenwechsel, Rückmeldungen, Quiz), übersetzt ein
 *     MutationObserver automatisch. „Deutsch“ stellt alle Originaltexte wieder her.
 *   – Elemente mit translate="no" werden nie übersetzt (z. B. die Sprachauswahl selbst).
 *   – Handübersetzte Inhalte (Sicherheitsunterweisung, js/content/translations.js) markiert die
 *     Kursansicht mit data-human-translation und meldet ihren Text über protectHumanTranslation().
 *     Texte daraus bleiben unangetastet; übersetzt werden dort nur Bedienelemente.
 *   – Bei jedem Sprachwechsel meldet das Ereignis „em-language-change“ (am document) die neue
 *     Sprache, damit die Kursansicht die passende Handübersetzung zeigen kann.
 *   – Die Wahl wird nur in diesem Browser gespeichert (localStorage, Schlüssel em-sprache).
 *   – Per Doppelklick geöffnet (file://) blockiert der Browser Module und Worker: Dann erklärt ein
 *     Hinweis, dass die Übersetzung nur über einen Webserver (GitHub Pages, Startskript) läuft.
 *
 * Zusammenspiel: js/pages/index.js verbindet die Auswahl [data-language-select] in der Kopfleiste.
 *
 * Wenn du hier etwas ändern willst …
 *   – Sprachen ergänzen oder entfernen: LANGUAGES (nur Sprachen, für die es ein Modell
 *     „en→xx“ in vendor/bergamot/registry.json gibt; siehe vendor/bergamot/VERSION.txt).
 *   – Welche Attribute mitübersetzt werden: ATTRIBUTES.
 *   – Was als Ganzes übersetzt wird: BLOCK_TAGS und INLINE_TAGS.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");

  const STORAGE_KEY = "em-sprache";
  const SOURCE_LANGUAGE = "de";

  /**
   * Verzeichnis der Sprachmodelle: Liste mit Download-Adressen bei Mozilla (CORS-Freigabe für alle
   * Webseiten) und Prüfsummen. Liegt im Kurs, damit auch Sprachen aus Firefox dazukommen können.
   */
  const REGISTRY_PATH = "vendor/bergamot/registry.json";
  /** Übersetzungsprogramm im Kurs (ES-Modul, startet seinen Worker selbst). */
  const TRANSLATOR_PATH = "vendor/bergamot/translator.js";
  /** Längste Wartezeit für den Download eines Sprachmodells. */
  const DOWNLOAD_TIMEOUT_MS = 180000;
  /** Obergrenze des Übersetzungs-Caches, damit der Speicher bei langen Sitzungen nicht wächst. */
  const CACHE_MAX_ENTRIES = 4000;

  /** Angebotene Sprachen; Namen in der jeweiligen Sprache, damit jede Person ihre findet. */
  const LANGUAGES = [
    { code: "de", name: "Deutsch" },
    { code: "en", name: "English" },
    { code: "fr", name: "Français" },
    { code: "es", name: "Español" },
    { code: "it", name: "Italiano" },
    { code: "pt", name: "Português" },
    { code: "cs", name: "Čeština" },
    { code: "bg", name: "Български" },
    { code: "et", name: "Eesti" },
    { code: "ru", name: "Русский" },
    { code: "uk", name: "Українська" },
    { code: "fi", name: "Suomi" },
  ];

  /** Elemente, deren Inhalt nie übersetzt wird (Großschreibung wie in nodeName). */
  const SKIP = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "CODE",
    "PRE",
    "TEXTAREA",
    "SVG",
  ]);

  /** Elemente, die als Ganzes übersetzt werden, wenn sie nur einfache Formatierung enthalten. */
  const BLOCK_TAGS = new Set([
    "P",
    "LI",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "TD",
    "TH",
    "DT",
    "DD",
    "FIGCAPTION",
    "CAPTION",
    "LEGEND",
  ]);
  const BLOCK_SELECTOR = [...BLOCK_TAGS].join(",");

  /** Formatierung, die innerhalb eines Blocks erlaubt ist (ohne eigene Funktion). */
  const INLINE_TAGS = new Set([
    "STRONG",
    "EM",
    "B",
    "I",
    "A",
    "ABBR",
    "SUP",
    "SUB",
    "BR",
    "MARK",
    "SMALL",
    "Q",
    "CITE",
    "DFN",
    "S",
    "U",
  ]);

  /** Attribute, die Menschen zu sehen oder zu hören bekommen. */
  const ATTRIBUTES = ["alt", "title", "aria-label", "placeholder"];

  /** Texte für Status und Hinweise (zweisprachig, weil sie gerade beim Umschalten erscheinen). */
  const TEXTS = {
    loading: "Sprachmodell wird geladen … / Loading language model …",
    translating: "Übersetze … / Translating …",
    fileTitle:
      "Übersetzung hier nicht möglich / Translation not available here",
    fileBody:
      "Der Kurs ist als Datei geöffnet (Doppelklick). So erlaubt der Browser keine Übersetzung. Öffne den Kurs über seine Internetadresse oder das Startskript.",
    fileBodyEn:
      "The course was opened as a local file. Please open it via its web address or the start script to use translation.",
    errorTitle: "Übersetzung fehlgeschlagen / Translation failed",
    errorBody:
      "Das Sprachmodell konnte nicht geladen werden. Prüfe deine Internetverbindung und versuche es noch einmal.",
    errorBodyEn:
      "The language model could not be loaded. Check your internet connection and try again.",
    ok: "OK",
  };

  /** Zielsprache, solange übersetzt wird; null = Deutsch (Original). */
  let target = null;
  /** @type {Promise<any>|null} Bergamot-Übersetzer (wird beim ersten Umschalten geladen). */
  let engine = null;
  /** @type {MutationObserver|null} */
  let observer = null;
  /** Handübersetzte Bereiche → ihr Text (Leerraum vereinheitlicht), siehe protectHumanTranslation(). */
  const humanSources = new WeakMap();

  /** @param {string} text */
  function squash(text) {
    return text.replace(/\s+/g, " ").trim();
  }

  /**
   * Meldet einen handübersetzten Bereich. Texte, die wörtlich in sourceText stehen, übersetzt die
   * automatische Übersetzung dort nicht – nur das, was das Programm selbst dazuschreibt (Knöpfe,
   * Rückmeldungen wie „Richtig.“).
   * @param {Element} container   trägt das Attribut data-human-translation
   * @param {string} sourceText   Inhalt der Übersetzungsdatei
   */
  function protectHumanTranslation(container, sourceText) {
    humanSources.set(container, squash(sourceText));
  }

  /**
   * Stammt dieser Text aus einer Handübersetzung?
   * @param {string} text
   * @param {Element|null} element  Ort des Textes
   * @returns {boolean}
   */
  function isHumanText(text, element) {
    const host = element?.closest("[data-human-translation]");
    const source = host ? humanSources.get(host) : undefined;
    const value = squash(text);
    return Boolean(source && value && source.includes(value));
  }

  /**
   * Aktuelle Sprache der Seite ('de' = Original).
   * @returns {string}
   */
  function currentLanguage() {
    return target ?? SOURCE_LANGUAGE;
  }

  /** Meldet den Sprachwechsel an die Kursansicht. */
  function announceLanguage() {
    document.dispatchEvent(
      new CustomEvent("em-language-change", {
        detail: { language: currentLanguage() },
      }),
    );
  }

  /** Deutscher Originaltext je Textknoten. */
  const originalText = new Map();
  /** Zuletzt eingesetzte Übersetzung je Textknoten (um eigene Änderungen zu erkennen). */
  const translatedText = new WeakMap();
  /** Original- und übersetztes HTML je Block. */
  const originalHtml = new Map();
  /** Deutsche Originalwerte der Attribute je Element. */
  const originalAttributes = new Map();
  /** Bereits übersetzte Texte, Schlüssel: Zielsprache + Art + Text. */
  const cache = new Map();
  /** Knoten und Blöcke, die gerade übersetzt werden (verhindert Doppelarbeit). */
  const pending = new WeakSet();

  /**
   * Liest die gespeicherte Sprache. Ohne Speicher (z. B. privates Fenster) gilt Deutsch.
   * @returns {string}
   */
  function storedLanguage() {
    try {
      const code = window.localStorage.getItem(STORAGE_KEY);
      return LANGUAGES.some((language) => language.code === code)
        ? code
        : SOURCE_LANGUAGE;
    } catch {
      return SOURCE_LANGUAGE;
    }
  }

  /** @param {string} code */
  function storeLanguage(code) {
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Ohne Speicher gilt die Wahl nur bis zum Neuladen.
    }
  }

  /** @returns {boolean} Als Datei geöffnet? Dann blockiert der Browser Module und Worker. */
  function isLocalFile() {
    return window.location.protocol === "file:";
  }

  /**
   * Lädt Bergamot (einmal pro Seitenaufruf). Die Sprachmodelle lädt Bergamot selbst beim ersten
   * Übersetzen einer Sprache.
   * @returns {Promise<any>}
   */
  function getEngine() {
    if (!engine) {
      const url = new URL(TRANSLATOR_PATH, document.baseURI).href;
      engine = import(url)
        .then(
          (module) =>
            new module.BatchTranslator({
              registryUrl: new URL(REGISTRY_PATH, document.baseURI).href,
              workers: 1,
              downloadTimeout: DOWNLOAD_TIMEOUT_MS,
            }),
        )
        .catch((error) => {
          engine = null;
          throw error;
        });
    }
    return engine;
  }

  /**
   * Übersetzt einen Text oder ein HTML-Stück ins aktuelle Ziel. Leerraum am Anfang und Ende bleibt
   * erhalten, Texte ohne Buchstaben (Zahlen, Satzzeichen) bleiben unverändert.
   * @param {string} text
   * @param {boolean} html
   * @returns {Promise<string>}
   */
  async function translate(text, html) {
    const [, before, core, after] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text) ?? [];
    if (!core || !/\p{L}/u.test(core)) {
      return text;
    }
    const language = target;
    const key = `${language}|${html ? "h" : "t"}|${core}`;
    let result = cache.get(key);
    if (result === undefined) {
      const translator = await getEngine();
      const response = await translator.translate({
        from: SOURCE_LANGUAGE,
        to: language,
        text: core,
        html,
      });
      result = response.target.text;
      if (cache.size >= CACHE_MAX_ENTRIES) {
        cache.clear();
      }
      cache.set(key, result);
    }
    return before + result + after;
  }

  /**
   * Darf dieser Block als Ganzes übersetzt werden? Nur, wenn er außer einfacher Formatierung
   * nichts enthält – sonst würden beim Ersetzen Knöpfe und ihre Funktionen verloren gehen.
   * @param {Element} element
   * @returns {boolean}
   */
  function isSimpleBlock(element) {
    if (!BLOCK_TAGS.has(element.nodeName)) {
      return false;
    }
    for (const child of element.querySelectorAll("*")) {
      if (
        !INLINE_TAGS.has(child.nodeName) ||
        child.getAttribute("translate") === "no"
      ) {
        return false;
      }
    }
    return /\p{L}/u.test(element.textContent ?? "");
  }

  /** @param {Element} element */
  function isExcluded(element) {
    return (
      SKIP.has(element.nodeName.toUpperCase()) ||
      element.getAttribute("translate") === "no"
    );
  }

  /**
   * Sammelt, was unterhalb von root zu übersetzen ist.
   * @param {Node} root
   * @returns {{ blocks: Element[], texts: Text[], elements: Element[] }}
   */
  function collect(root) {
    const blocks = [];
    const texts = [];
    const elements = [];
    const start = root.nodeType === Node.TEXT_NODE ? root.parentElement : root;
    if (!(start instanceof Element) || start.closest('[translate="no"]')) {
      return { blocks, texts, elements };
    }
    // Liegt der Startpunkt in einem einfachen Block, wird der ganze Block übersetzt.
    const block = start.closest(BLOCK_SELECTOR);
    if (
      block &&
      isSimpleBlock(block) &&
      !block.closest("[data-human-translation]")
    ) {
      blocks.push(block);
      return { blocks, texts, elements };
    }
    if (isExcluded(start)) {
      return { blocks, texts, elements };
    }
    if (root.nodeType === Node.TEXT_NODE) {
      texts.push(/** @type {Text} */ (root));
      return { blocks, texts, elements };
    }
    elements.push(start);
    const walker = document.createTreeWalker(
      start,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (node instanceof Element) {
            if (isExcluded(node)) {
              return NodeFilter.FILTER_REJECT;
            }
            if (
              isSimpleBlock(node) &&
              !node.closest("[data-human-translation]")
            ) {
              blocks.push(node);
              return NodeFilter.FILTER_REJECT;
            }
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node instanceof Element) {
        elements.push(node);
      } else {
        texts.push(/** @type {Text} */ (node));
      }
    }
    return { blocks, texts, elements };
  }

  /** Wirft Einträge für Knoten weg, die nicht mehr im Dokument stehen. */
  function pruneDisconnected() {
    for (const store of [originalText, originalHtml, originalAttributes]) {
      for (const node of store.keys()) {
        if (!node.isConnected) {
          store.delete(node);
        }
      }
    }
  }

  /**
   * Übersetzt einen Block als Ganzes (HTML mit Formatierung).
   * @param {Element} block
   * @returns {Promise<void>|null}
   */
  function translateBlock(block) {
    const saved = originalHtml.get(block);
    if (pending.has(block) || saved?.translated === block.innerHTML) {
      return null;
    }
    const german = block.innerHTML;
    const language = target;
    pending.add(block);
    return translate(german, true)
      .then(async (result) => {
        if (target !== language || block.innerHTML !== german) {
          return;
        }
        block.innerHTML = result;
        await translateAttributes([...block.querySelectorAll("*")]);
        // Erst nach den Attributen merken – sie gehören zum HTML des Blocks.
        originalHtml.set(block, { german, translated: block.innerHTML });
      })
      .finally(() => pending.delete(block));
  }

  /**
   * Übersetzt einen einzelnen Textknoten.
   * @param {Text} node
   * @returns {Promise<void>|null}
   */
  function translateText(node) {
    if (
      translatedText.get(node) === node.data ||
      pending.has(node) ||
      isHumanText(node.data, node.parentElement)
    ) {
      return null;
    }
    const german = node.data;
    const language = target;
    pending.add(node);
    return translate(german, false)
      .then((result) => {
        if (target !== language || node.data !== german) {
          return;
        }
        originalText.set(node, german);
        translatedText.set(node, result);
        node.data = result;
      })
      .finally(() => pending.delete(node));
  }

  /**
   * Übersetzt die sichtbaren bzw. vorgelesenen Attribute (ATTRIBUTES) der Elemente.
   * @param {Element[]} elements
   * @returns {Promise<void[]>}
   */
  function translateAttributes(elements) {
    const jobs = [];
    const language = target;
    for (const element of elements) {
      for (const name of ATTRIBUTES) {
        const german = element.getAttribute(name);
        const saved = originalAttributes.get(element);
        if (
          !german ||
          saved?.[name]?.translated === german ||
          isHumanText(german, element)
        ) {
          continue;
        }
        jobs.push(
          translate(german, false).then((result) => {
            if (target !== language || element.getAttribute(name) !== german) {
              return;
            }
            const entry = originalAttributes.get(element) ?? {};
            entry[name] = { german, translated: result };
            originalAttributes.set(element, entry);
            element.setAttribute(name, result);
          }),
        );
      }
    }
    return Promise.all(jobs);
  }

  /**
   * Übersetzt alles unterhalb von root.
   * @param {Node} root
   * @returns {Promise<void>}
   */
  async function translateTree(root) {
    const { blocks, texts, elements } = collect(root);
    await Promise.all([
      ...blocks.map(translateBlock),
      ...texts.map(translateText),
      translateAttributes(elements),
    ]);
    pruneDisconnected();
  }

  /** Stellt alle deutschen Texte wieder her. */
  function restore() {
    for (const [block, { german, translated }] of originalHtml) {
      if (block.isConnected && block.innerHTML === translated) {
        block.innerHTML = german;
      }
    }
    for (const [node, german] of originalText) {
      if (node.isConnected && translatedText.get(node) === node.data) {
        node.data = german;
      }
    }
    for (const [element, entry] of originalAttributes) {
      for (const [name, { german, translated }] of Object.entries(entry)) {
        if (element.getAttribute(name) === translated) {
          element.setAttribute(name, german);
        }
      }
    }
    originalHtml.clear();
    originalText.clear();
    originalAttributes.clear();
  }

  /** Übersetzt alles, was nach dem Umschalten neu auf der Seite erscheint. */
  function observe() {
    observer = new MutationObserver((records) => {
      if (!target) {
        return;
      }
      const roots = new Set();
      for (const record of records) {
        roots.add(record.target);
        if (record.type === "childList") {
          record.addedNodes.forEach((node) => roots.add(node));
        }
      }
      for (const root of roots) {
        if (root.isConnected) {
          translateTree(root).catch((error) => {
            console.warn("Übersetzung fehlgeschlagen:", error);
          });
        }
      }
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTES,
    });
  }

  /**
   * Zeigt einen Hinweis, warum nicht übersetzt werden kann.
   * @param {'file'|'error'} reason
   * @param {HTMLElement} returnFocusTo  Wird nach dem Schließen fokussiert.
   */
  function showProblem(reason, returnFocusTo) {
    const isFile = reason === "file";
    const dialog = el(
      "dialog",
      {
        class: "dialog",
        "aria-labelledby": "language-problem-title",
        translate: "no",
      },
      el(
        "form",
        { method: "dialog", class: "stack" },
        el(
          "h2",
          { id: "language-problem-title" },
          isFile ? TEXTS.fileTitle : TEXTS.errorTitle,
        ),
        el("p", {}, isFile ? TEXTS.fileBody : TEXTS.errorBody),
        el("p", { lang: "en" }, isFile ? TEXTS.fileBodyEn : TEXTS.errorBodyEn),
        el(
          "div",
          { class: "dialog__actions" },
          el(
            "button",
            { class: "button button--primary", value: "ok" },
            TEXTS.ok,
          ),
        ),
      ),
    );
    dialog.addEventListener("close", () => {
      dialog.remove();
      returnFocusTo.focus();
    });
    document.body.append(dialog);
    dialog.showModal();
  }

  /**
   * Verbindet die Sprachauswahl in der Kopfleiste.
   * @param {HTMLSelectElement} select
   */
  function setupLanguageSelect(select) {
    select.replaceChildren(
      ...LANGUAGES.map(({ code, name }) =>
        el("option", { value: code, lang: code }, name),
      ),
    );
    // Sichtbarer Hinweis beim Laden; role="status" liest ihn auch Screenreadern vor.
    const status = el("span", {
      class: "language-select__status",
      role: "status",
      translate: "no",
    });
    select.after(status);

    /**
     * @param {string} code  Zielsprache ('de' = Original)
     * @param {boolean} userAction  true = Auswahl durch die Person (Fehler als Dialog zeigen)
     */
    async function setLanguage(code, userAction) {
      if (target) {
        // Erst zurück zum Deutschen, dann in die neue Sprache.
        restore();
      }
      if (code === SOURCE_LANGUAGE) {
        target = null;
        announceLanguage();
        observer?.disconnect();
        observer = null;
        document.documentElement.lang = SOURCE_LANGUAGE;
        select.value = SOURCE_LANGUAGE;
        storeLanguage(SOURCE_LANGUAGE);
        return;
      }
      if (isLocalFile()) {
        select.value = SOURCE_LANGUAGE;
        if (userAction) {
          showProblem("file", select);
        }
        return;
      }
      target = code;
      announceLanguage();
      select.value = code;
      document.documentElement.lang = code;
      select.setAttribute("aria-busy", "true");
      status.textContent = TEXTS.loading;
      try {
        if (!observer) {
          observe();
        }
        await translateTree(document.documentElement);
        storeLanguage(code);
      } catch (error) {
        console.warn("Übersetzung fehlgeschlagen:", error);
        await setLanguage(SOURCE_LANGUAGE, false);
        if (userAction) {
          showProblem("error", select);
        }
      } finally {
        select.removeAttribute("aria-busy");
        status.textContent = "";
      }
    }

    select.addEventListener("change", () => setLanguage(select.value, true));
    select.value = SOURCE_LANGUAGE;
    const saved = storedLanguage();
    if (saved !== SOURCE_LANGUAGE) {
      setLanguage(saved, false);
    }
  }

  EM.define("js/ui/language.js", {
    setupLanguageSelect,
    currentLanguage,
    protectHumanTranslation,
    LANGUAGES,
  });
})();
