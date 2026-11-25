/*
 * canvas-fields.js – Felder: Kurs-/Kapitel-Formulare und rechte Spalte
 *
 * Enthält die Felddefinitionen (COURSE_FIELDS, CHAPTER_FIELDS, IMAGE_FIELDS),
 * den Formular-Kontext der mittleren Spalte (middleContext) und das
 * Eigenschaften-Formular des ausgewählten Elements (renderProperties), je
 * nach Elementtyp aus dem Schema des Bausteins (field-renderers.js) gebaut.
 *
 * Zusammenspiel: page-canvas.js (mittlere Spalte, Re-Export von
 * renderProperties), canvas-elements.js (elementLabel), hotspot-editor.js.
 *
 * Wenn du hier etwas ändern willst …
 *   – Felder der Kurseinstellungen: COURSE_FIELDS. Kapitelkopf: CHAPTER_FIELDS.
 *   – Felder eines Bildes: IMAGE_FIELDS.
 *   – Rechte Spalte je Elementtyp: renderProperties / renderRawEditor.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { getBlock } = EM.require("js/blocks/registry.js");
  const { parseBody } = EM.require("js/content/documents.js");
  const { renderFields, renderMarkdownField } = EM.require(
    "js/editor/field-renderers.js",
  );
  const { renderHotspotEditor } = EM.require("js/editor/hotspot-editor.js");
  const { elementLabel } = EM.require("js/editor/canvas-elements.js");

  /** Zeilenzahl des Textfelds für nicht lesbare Abschnitte. */
  const RAW_ROWS = 14;

  /** Felder der Kurseinstellungen (content/kurs.md). */
  const COURSE_FIELDS = [
    { key: "titel", type: "text", label: "Kurstitel", required: true },
    { key: "team", type: "text", label: "Team" },
    {
      key: "kursversion",
      type: "text",
      label: "Kursversion",
      required: true,
      help: "Erhöhen (z. B. 1.0 → 1.1), wenn sich der Kurs grundlegend ändert. Wer das Qualifying mit einer älteren Version bestanden hat, muss es dann neu machen.",
    },
    {
      key: "bestehensgrenze",
      type: "number",
      label: "Bestehensgrenze in Prozent",
      min: 1,
      max: 100,
    },
    {
      key: "qualifying-fragen",
      type: "number",
      label: "Anzahl Fragen im Qualifying",
      min: 1,
      max: 50,
    },
    {
      key: "zertifikat-titel",
      type: "text",
      label: "Titel auf dem Zertifikat",
    },
    {
      key: "zertifikat-unterschrift-name",
      type: "text",
      label: "Unterschrift: Name",
    },
    {
      key: "zertifikat-unterschrift-rolle",
      type: "text",
      label: "Unterschrift: Rolle",
    },
    { key: "logo", type: "image", label: "Logo (SVG empfohlen)" },
  ];

  /** Felder des Kapitelkopfs. */
  const CHAPTER_FIELDS = [
    { key: "titel", type: "text", label: "Titel", required: true },
    {
      key: "kurztitel",
      type: "text",
      label: "Kurztitel (Sektoranzeige)",
      required: true,
      help: "Höchstens ca. 20 Zeichen.",
    },
    {
      key: "dauer",
      type: "number",
      label: "Dauer in Minuten",
      min: 1,
      max: 120,
      required: true,
    },
    {
      key: "version",
      type: "number",
      label: "Version",
      min: 1,
      required: true,
      help: "Erhöhen, wenn sich das Quiz ändert – dann müssen alle das Quiz neu machen.",
    },
    {
      key: "bestehensgrenze",
      type: "number",
      label: "Eigene Bestehensgrenze (optional)",
      min: 1,
      max: 100,
      help: "Leer lassen = Wert aus den Kurseinstellungen.",
    },
    {
      key: "lernziele",
      type: "list",
      label: "Lernziele",
      itemLabel: "Lernziel",
      itemFields: [{ key: "value", type: "text", label: "Lernziel" }],
    },
  ];

  /** Felder eines Bildelements. */
  const IMAGE_FIELDS = [
    { key: "src", type: "image", label: "Bild", required: true },
    {
      key: "alt",
      type: "text",
      label: "Alternativtext (was ist zu sehen?)",
      required: true,
      help: "Pflicht. Menschen mit Screenreader hören diesen Text statt das Bild zu sehen.",
    },
    { key: "caption", type: "text", label: "Bildunterschrift (optional)" },
  ];

  /**
   * Formular-Kontext für Felder in der mittleren Spalte.
   * @param {Object} editor Editor-Objekt.
   * @param {string} idPrefix Präfix für eindeutige Feld-IDs.
   * @param {string|null} [chapterFile] Kapiteldatei für commit().
   * @returns {Object} Kontext für renderFields.
   */
  function middleContext(editor, idPrefix, chapterFile = null) {
    return {
      idPrefix,
      change: (mutate, options = {}) =>
        editor.commit(mutate, {
          source: "middle",
          coalesce: options.key,
          structural: options.structural,
          chapter: chapterFile,
        }),
      pickImage: editor.pickImage,
      pickGlossaryTerm: editor.pickGlossaryTerm,
      imageUrl: editor.imageUrl,
    };
  }

  /**
   * Formular des ausgewählten Elements (rechte Spalte).
   * @param {Object} editor Editor-Objekt.
   * @returns {HTMLElement}
   */
  function renderProperties(editor) {
    const { state } = editor;
    const selection = state.selection;
    /**
     * Leerzustand der rechten Spalte.
     * @param {string} text Hinweistext.
     * @returns {HTMLElement}
     */
    function empty(text) {
      return el(
        "div",
        { class: "stack" },
        el("h2", { class: "editor-column__title" }, "Eigenschaften"),
        el("p", { class: "canvas__info" }, text),
      );
    }
    if (
      !state.doc ||
      selection.kind !== "page" ||
      selection.element === undefined
    ) {
      return empty(
        "Wähle in der Mitte ein Element aus, um es hier zu bearbeiten.",
      );
    }
    const entry = editor.entryByFile(selection.file);
    const page = entry?.model?.pages[selection.page];
    const element = page?.elements[selection.element];
    if (!element) {
      return empty("Dieses Element gibt es nicht mehr.");
    }

    const file = entry.file;
    const idPrefix = `el-${entry.model.id}-${selection.page}-${selection.element}`;
    const context = {
      idPrefix,
      change: (mutate, options = {}) =>
        editor.commit(mutate, {
          source: "right",
          coalesce: options.key,
          structural: options.structural,
          chapter: file,
        }),
      pickImage: editor.pickImage,
      pickGlossaryTerm: editor.pickGlossaryTerm,
      imageUrl: editor.imageUrl,
    };
    const heading = el(
      "h2",
      { class: "editor-column__title" },
      `Eigenschaften: ${elementLabel(element)}`,
    );

    if (element.type === "text") {
      return el(
        "div",
        { class: "stack" },
        heading,
        renderMarkdownField({
          id: `${idPrefix}-text`,
          label: el("label", { for: `${idPrefix}-text` }, "Text"),
          hint: el(
            "p",
            { class: "field__hint", id: `${idPrefix}-text-hint` },
            '„### " = Zwischenüberschrift, „- " = Liste. Mehr in docs/BAUSTEINE.md.',
          ),
          hintId: `${idPrefix}-text-hint`,
          value: element.markdown,
          set: (value) =>
            context.change(
              () => {
                element.markdown = value;
              },
              { key: `${idPrefix}-text` },
            ),
          context,
          warnPageSyntax: true,
        }),
      );
    }
    if (element.type === "image") {
      return el(
        "div",
        { class: "stack" },
        heading,
        renderFields(IMAGE_FIELDS, element, context),
      );
    }
    if (element.type === "raw") {
      return renderRawEditor(editor, entry, selection, element, heading);
    }

    const definition = getBlock(element.name);
    if (definition.editor.customEditor === "hotspot") {
      return el(
        "div",
        { class: "stack" },
        heading,
        renderHotspotEditor(element.data, context, definition.editor.fields),
      );
    }
    return el(
      "div",
      { class: "stack" },
      heading,
      el("p", { class: "field__hint" }, definition.editor.description),
      renderFields(definition.editor.fields, element.data, context),
    );
  }

  /**
   * Nicht lesbarer Abschnitt: Rohtext bearbeiten und neu einlesen.
   * @param {Object} editor Editor-Objekt.
   * @param {Object} entry Kapiteleintrag.
   * @param {Object} selection Aktuelle Auswahl (Seite, Element).
   * @param {Object} element Das nicht lesbare Element.
   * @param {HTMLElement} heading Bereits gebaute Überschrift.
   * @returns {HTMLElement}
   */
  function renderRawEditor(editor, entry, selection, element, heading) {
    const id = `raw-${entry.model.id}-${selection.page}-${selection.element}`;
    const textarea = el(
      "textarea",
      {
        id,
        class: "field__input field__textarea",
        rows: RAW_ROWS,
        spellcheck: "false",
      },
      element.text,
    );
    textarea.addEventListener("input", () =>
      editor.commit(
        () => {
          element.text = textarea.value;
        },
        { source: "right", coalesce: id, chapter: entry.file },
      ),
    );
    const reparse = el(
      "button",
      { type: "button", class: "button button--primary button--small" },
      "Erneut einlesen",
    );
    reparse.addEventListener("click", () => {
      const items = parseBody(textarea.value, 1, entry.model.path).filter(
        (item) => item.type !== "page",
      );
      const stillRaw = items.some((item) => item.type === "raw");
      editor.commit(
        () => {
          entry.model.pages[selection.page].elements.splice(
            selection.element,
            1,
            ...items,
          );
        },
        { chapter: entry.file },
      );
      editor.select({
        kind: "page",
        file: entry.file,
        page: selection.page,
        element: selection.element,
      });
      editor.setStatus(
        stillRaw
          ? "Immer noch nicht lesbar – siehe Meldung."
          : "Abschnitt ist jetzt lesbar.",
      );
    });
    return el(
      "div",
      { class: "stack" },
      heading,
      el(
        "div",
        { class: "notice notice--error" },
        el(
          "p",
          {},
          "Der Editor versteht diesen Abschnitt nicht. Er bleibt unverändert erhalten.",
        ),
        el(
          "ul",
          {},
          element.errors.map((error) =>
            el("li", {}, `${error.message} ${error.fix ?? ""}`),
          ),
        ),
      ),
      el(
        "div",
        { class: "field" },
        el("label", { for: id }, "Quelltext des Abschnitts"),
        textarea,
      ),
      reparse,
    );
  }

  EM.define("js/editor/canvas-fields.js", {
    COURSE_FIELDS,
    CHAPTER_FIELDS,
    middleContext,
    renderProperties,
  });
})();
