/*
 * language.js – Sprachschalter Deutsch / Englisch
 *
 * Der Kurs ist auf Deutsch geschrieben. Der Schalter „English“ in der Kopfleiste lässt die Seite
 * vom Browser selbst ins Englische übersetzen – es gibt keine zweite Inhaltsfassung und keinen
 * fremden Übersetzungsdienst.
 *
 * Funktionsweise:
 *   – Browser mit eingebauter Übersetzung für Webseiten (Translator-API, z. B. Chrome ab 138):
 *     Beim ersten Einschalten lädt der Browser einmalig sein Sprachmodell herunter. Danach werden
 *     alle Texte der Seite auf dem Gerät übersetzt – auch alles, was später neu erscheint
 *     (Seitenwechsel, Rückmeldungen der Übungen, Glossar). Ausschalten stellt den deutschen Text
 *     wieder her.
 *   – Andere Browser (Safari, Firefox, ältere Versionen): Ein Dialog erklärt, wie man dort die
 *     eingebaute Übersetzung des Browsers startet. Eine Webseite darf diese nicht selbst auslösen.
 *   – Die Wahl wird nur in diesem Browser gespeichert (localStorage, Schlüssel em-sprache).
 *   – Elemente mit translate="no" werden nicht übersetzt (z. B. der Schalter selbst).
 *
 * Zusammenspiel: js/pages/index.js verbindet den Knopf .language-toggle in der Kopfleiste.
 *
 * Wenn du hier etwas ändern willst …
 *   – Texte des Hinweisdialogs: showBrowserHelp().
 *   – Welche Attribute mitübersetzt werden: ATTRIBUTES.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");

  const STORAGE_KEY = "em-sprache";
  const LANGUAGES = { sourceLanguage: "de", targetLanguage: "en" };

  /** Elemente, deren Inhalt nie übersetzt wird. */
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA"]);

  /** Attribute, die Menschen zu sehen oder zu hören bekommen. */
  const ATTRIBUTES = ["alt", "title", "aria-label", "placeholder"];

  /** @type {any} */
  let translator = null;
  let active = false;
  /** @type {MutationObserver|null} */
  let observer = null;

  /** Deutscher Originaltext je Textknoten (zum Zurückstellen). */
  const originalText = new Map();
  /** Zuletzt eingesetzte Übersetzung je Textknoten (um eigene Änderungen zu erkennen). */
  const translatedText = new WeakMap();
  /** Deutsche Originalwerte der Attribute je Element. */
  const originalAttributes = new Map();
  /** Bereits übersetzte Texte (Deutsch → Englisch). */
  const cache = new Map();

  /**
   * Liest die gespeicherte Wahl. Ohne Speicher (z. B. privates Fenster) gilt Deutsch.
   * @returns {'de'|'en'}
   */
  function storedLanguage() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "de";
    } catch {
      return "de";
    }
  }

  /** @param {'de'|'en'} language */
  function storeLanguage(language) {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Ohne Speicher gilt die Wahl nur bis zum Neuladen.
    }
  }

  /** @returns {boolean} Hat der Browser eine eingebaute Übersetzung für Webseiten? */
  function hasBuiltInTranslator() {
    return "Translator" in self;
  }

  /**
   * Übersetzt einen Text. Leerraum am Anfang und Ende bleibt erhalten, Texte ohne Buchstaben
   * (Zahlen, Satzzeichen) bleiben unverändert.
   * @param {string} text
   * @returns {Promise<string>}
   */
  async function translate(text) {
    const [, before, core, after] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text) ?? [];
    if (!core || !/\p{L}/u.test(core)) {
      return text;
    }
    let result = cache.get(core);
    if (result === undefined) {
      result = await translator.translate(core);
      cache.set(core, result);
    }
    return before + result + after;
  }

  /**
   * Sammelt alle Textknoten und Elemente unterhalb von root, die übersetzt werden sollen.
   * @param {Node} root
   * @returns {{ texts: Text[], elements: Element[] }}
   */
  function collect(root) {
    const texts = [];
    const elements = [];
    if (root.nodeType === Node.TEXT_NODE) {
      const parent = root.parentElement;
      if (parent && !parent.closest('[translate="no"]') && !SKIP.has(parent.nodeName)) {
        texts.push(/** @type {Text} */ (root));
      }
      return { texts, elements };
    }
    if (!(root instanceof Element) || root.closest('[translate="no"]')) {
      return { texts, elements };
    }
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (node instanceof Element) {
            return SKIP.has(node.nodeName) || node.getAttribute("translate") === "no"
              ? NodeFilter.FILTER_REJECT
              : NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );
    elements.push(root);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node instanceof Element) {
        elements.push(node);
      } else {
        texts.push(/** @type {Text} */ (node));
      }
    }
    return { texts, elements };
  }

  /**
   * Übersetzt alle Texte und Attribute unterhalb von root.
   * @param {Node} root
   * @returns {Promise<void>}
   */
  async function translateTree(root) {
    const { texts, elements } = collect(root);
    const jobs = [];
    for (const node of texts) {
      // Eigene Übersetzung? Dann ist nichts zu tun. Sonst ist der Text neu (deutsch).
      if (translatedText.get(node) === node.data) {
        continue;
      }
      const german = node.data;
      jobs.push(
        translate(german).then((english) => {
          if (!active || node.data !== german) {
            return;
          }
          originalText.set(node, german);
          translatedText.set(node, english);
          node.data = english;
        }),
      );
    }
    for (const element of elements) {
      for (const name of ATTRIBUTES) {
        const german = element.getAttribute(name);
        const saved = originalAttributes.get(element);
        if (!german || saved?.[name]?.english === german) {
          continue;
        }
        jobs.push(
          translate(german).then((english) => {
            if (!active || element.getAttribute(name) !== german) {
              return;
            }
            const entry = originalAttributes.get(element) ?? {};
            entry[name] = { german, english };
            originalAttributes.set(element, entry);
            element.setAttribute(name, english);
          }),
        );
      }
    }
    await Promise.all(jobs);
  }

  /** Stellt alle deutschen Texte wieder her. */
  function restore() {
    for (const [node, german] of originalText) {
      if (node.isConnected && translatedText.get(node) === node.data) {
        node.data = german;
      }
    }
    for (const [element, entry] of originalAttributes) {
      for (const [name, { german, english }] of Object.entries(entry)) {
        if (element.getAttribute(name) === english) {
          element.setAttribute(name, german);
        }
      }
    }
    originalText.clear();
    originalAttributes.clear();
  }

  /** Übersetzt alles, was nach dem Einschalten neu auf der Seite erscheint. */
  function observe() {
    observer = new MutationObserver((records) => {
      if (!active) {
        return;
      }
      const roots = new Set();
      for (const record of records) {
        if (record.type === "childList") {
          record.addedNodes.forEach((node) => roots.add(node));
        } else {
          roots.add(record.target);
        }
      }
      for (const root of roots) {
        if (root.isConnected) {
          translateTree(root).catch(() => {});
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
   * Erklärt, wie man die eingebaute Übersetzung des Browsers startet (Browser ohne Translator-API).
   */
  function showBrowserHelp() {
    const dialog = el(
      "dialog",
      { class: "dialog", "aria-labelledby": "language-help-title", lang: "en", translate: "no" },
      el(
        "form",
        { method: "dialog", class: "stack" },
        el("h2", { id: "language-help-title" }, "Read this course in English"),
        el(
          "p",
          {},
          "This browser can’t switch the page automatically. Use its built-in translation instead:",
        ),
        el(
          "ul",
          {},
          el("li", {}, el("strong", {}, "Chrome / Edge: "), "right-click the page → “Translate to English”."),
          el("li", {}, el("strong", {}, "Safari: "), "click the translate icon in the address bar → “Translate to English”."),
          el("li", {}, el("strong", {}, "Firefox: "), "click the translate icon in the address bar → “Translate”."),
        ),
        el(
          "p",
          { lang: "de" },
          "Dein Browser kann die Seite nicht automatisch umstellen. Nutze die Übersetzung deines Browsers wie oben beschrieben.",
        ),
        el(
          "div",
          { class: "dialog__actions" },
          el("button", { class: "button button--primary", value: "ok" }, "OK"),
        ),
      ),
    );
    dialog.addEventListener("close", () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
  }

  /**
   * Verbindet den Schalter „English“ (aria-pressed = Englisch ist an).
   * @param {HTMLButtonElement} button
   */
  function setupLanguageToggle(button) {
    const label = button.querySelector("[data-language-label]") ?? button;
    const defaultLabel = label.textContent;

    function update() {
      button.setAttribute("aria-pressed", String(active));
      document.documentElement.lang = active ? "en" : "de";
    }

    /**
     * @param {boolean} userAction  true = Klick (darf das Sprachmodell herunterladen)
     */
    async function switchOn(userAction) {
      if (!hasBuiltInTranslator()) {
        if (userAction) {
          showBrowserHelp();
        }
        return;
      }
      try {
        if (!translator) {
          // Manche Browser kennen die Schnittstelle, antworten aber nie – dann nach 5 s aufgeben.
          const availability = await Promise.race([
            self.Translator.availability(LANGUAGES),
            new Promise((resolve) => {
              setTimeout(() => resolve("unavailable"), 5000);
            }),
          ]);
          if (availability === "unavailable") {
            if (userAction) {
              showBrowserHelp();
            }
            return;
          }
          // Ohne Klick darf der Browser nichts herunterladen – dann beim nächsten Klick.
          if (!userAction && availability !== "available") {
            return;
          }
          button.setAttribute("aria-busy", "true");
          label.textContent = "English …";
          translator = await self.Translator.create({
            ...LANGUAGES,
            monitor(monitor) {
              monitor.addEventListener("downloadprogress", (event) => {
                label.textContent = `English … ${Math.round(event.loaded * 100)} %`;
              });
            },
          });
        }
        active = true;
        update();
        if (!observer) {
          observe();
        }
        await translateTree(document.documentElement);
        storeLanguage("en");
      } catch {
        active = false;
        update();
        if (userAction) {
          showBrowserHelp();
        }
      } finally {
        button.removeAttribute("aria-busy");
        label.textContent = defaultLabel;
      }
    }

    function switchOff() {
      active = false;
      restore();
      update();
      storeLanguage("de");
    }

    button.addEventListener("click", () => {
      if (active) {
        switchOff();
      } else {
        switchOn(true);
      }
    });
    update();
    if (storedLanguage() === "en") {
      switchOn(false);
    }
  }

  EM.define("js/ui/language.js", { setupLanguageToggle, hasBuiltInTranslator });
})();
