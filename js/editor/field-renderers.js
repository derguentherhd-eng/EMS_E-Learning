/*
 * field-renderers.js – baut Formulare aus Feldbeschreibungen (Schemas)
 *
 * Jeder Baustein beschreibt in `editor.fields`, welche Felder er hat (siehe registry.js,
 * FieldSchema). Diese Datei macht daraus Formularfelder. Deshalb erscheint ein neuer Baustein
 * automatisch im Editor – ohne dass hier etwas geändert werden muss.
 *
 * Feldtypen: text · markdown (Textfeld mit Werkzeugleiste) · number · select · boolean ·
 * image (Pfad + „Bild wählen …") · list (Einträge mit eigenen Feldern, verschiebbar).
 * Schlüssel mit Punkt (z. B. 'fields.kurz') greifen auf verschachtelte Werte zu. In Listen
 * aus reinen Texten heißt das einzige Feld 'value'.
 *
 * Kein WYSIWYG: Die Werkzeugleiste fügt Kursdown-Syntax ein (z. B. **fett**). Der Text bleibt
 * lesbares Markdown – genau das, was in der Datei steht.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neuer Feldtyp: in renderField() einen Fall ergänzen und in registry.js (FieldSchema) und
 *     docs/ENTWICKLER.md dokumentieren.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");

  /**
   * @typedef {Object} FieldContext
   * @property {(mutate: () => void, options?: {structural?: boolean, key?: string}) => void} change
   *           Meldet eine Änderung an den Editor. structural = Formular muss neu gebaut werden.
   * @property {string} idPrefix   eindeutiges Präfix für IDs
   * @property {() => Promise<string|null>} pickImage          Bild importieren → Pfad
   * @property {() => Promise<string|null>} pickGlossaryTerm   Glossarbegriff wählen → Begriff
   * @property {(path: string) => string} imageUrl             Pfad → anzeigbare Adresse
   */

  /**
   * Liest einen (evtl. verschachtelten) Wert.
   * @param {Object} data
   * @param {string} key  z. B. 'fields.kurz'
   * @returns {any}
   */
  function getPath(data, key) {
    return key
      .split(".")
      .reduce((value, part) => (value == null ? undefined : value[part]), data);
  }

  /**
   * Setzt einen (evtl. verschachtelten) Wert; fehlende Zwischenobjekte werden angelegt.
   * Leere Texte in verschachtelten Feldern werden entfernt (damit beim Speichern keine leeren
   * Zeilen entstehen).
   * @param {Object} data
   * @param {string} key
   * @param {any} value
   */
  function setPath(data, key, value) {
    const parts = key.split(".");
    const last = parts.pop();
    let target = data;
    for (const part of parts) {
      if (typeof target[part] !== "object" || target[part] === null) {
        target[part] = {};
      }
      target = target[part];
    }
    if (parts.length > 0 && value === "") {
      delete target[last];
    } else {
      target[last] = value;
    }
  }

  /**
   * Baut alle Felder eines Schemas.
   * @param {import('../blocks/registry.js').FieldSchema[]} fields
   * @param {Object} data     das Datenobjekt im Modell (wird direkt verändert)
   * @param {FieldContext} context
   * @returns {DocumentFragment}
   */
  function renderFields(fields, data, context) {
    const fragment = document.createDocumentFragment();
    for (const field of fields) {
      fragment.append(renderField(field, data, context));
    }
    return fragment;
  }

  /**
   * Baut ein einzelnes Feld.
   * @param {import('../blocks/registry.js').FieldSchema} field
   * @param {Object} data
   * @param {FieldContext} context
   * @returns {HTMLElement}
   */
  function renderField(field, data, context) {
    const id = `${context.idPrefix}-${field.key.replace(/[^a-z0-9]/gi, "-")}`;
    const hintId = field.help ? `${id}-hint` : null;
    const value = getPath(data, field.key);
    const label = el(
      "label",
      { for: id },
      field.label,
      field.required
        ? el("span", { class: "field__required" }, " (Pflicht)")
        : null,
    );
    const hint = field.help
      ? el("p", { class: "field__hint", id: hintId }, field.help)
      : null;
    function set(newValue) {
      return context.change(() => setPath(data, field.key, newValue), {
        key: id,
      });
    }

    switch (field.type) {
      case "markdown":
        return renderMarkdownField({
          id,
          label,
          hint,
          hintId,
          value: value ?? "",
          set,
          context,
          required: field.required,
        });
      case "number": {
        const input = el("input", {
          type: "number",
          id,
          value: value ?? "",
          min: field.min,
          max: field.max,
          step: "any",
          class: "field__input field__input--number",
          "aria-describedby": hintId,
          required: field.required,
        });
        input.addEventListener("input", () =>
          set(input.value === "" ? null : Number(input.value)),
        );
        return el("div", { class: "field" }, label, hint, input);
      }
      case "select": {
        const select = el(
          "select",
          { id, class: "field__input", "aria-describedby": hintId },
          (field.options ?? []).map((option) =>
            el("option", { value: option, selected: option === value }, option),
          ),
        );
        select.addEventListener("change", () => set(select.value));
        return el("div", { class: "field" }, label, hint, select);
      }
      case "boolean": {
        const input = el("input", {
          type: "checkbox",
          id,
          checked: Boolean(value),
          "aria-describedby": hintId,
        });
        input.addEventListener("change", () => set(input.checked));
        return el("div", { class: "field field--inline" }, input, label, hint);
      }
      case "image":
        return renderImageField({
          id,
          label,
          hint,
          hintId,
          value: value ?? "",
          set,
          context,
        });
      case "list":
        return renderListField(field, data, context, id);
      default: {
        const input = el("input", {
          type: "text",
          id,
          value: value ?? "",
          class: "field__input",
          "aria-describedby": hintId,
          required: field.required,
        });
        input.addEventListener("input", () => set(input.value));
        return el("div", { class: "field" }, label, hint, input);
      }
    }
  }

  /**
   * Textfeld mit schlanker Werkzeugleiste. Die Knöpfe fügen Kursdown-Syntax an der
   * Cursorposition ein bzw. um die Markierung herum.
   */
  function renderMarkdownField({
    id,
    label,
    hint,
    hintId,
    value,
    set,
    context,
    required = false,
    warnPageSyntax = false,
  }) {
    const textarea = el(
      "textarea",
      {
        id,
        rows: Math.min(18, Math.max(5, value.split("\n").length + 1)),
        class: "field__input field__textarea",
        "aria-describedby": hintId,
        required,
        spellcheck: "true",
      },
      value,
    );
    const warning = el("p", { class: "field__warning", role: "status" });
    function checkSyntax() {
      if (!warnPageSyntax) {
        return;
      }
      const problem = textarea.value
        .split("\n")
        .find((line) => /^##(\s|$)/.test(line) || /^:::/.test(line.trim()));
      warning.textContent = problem
        ? `Achtung: „${problem.trim()}" – Zeilen mit „## " beginnen beim Speichern eine neue Seite, „:::" einen Baustein. Für Zwischenüberschriften „### " verwenden.`
        : "";
    }
    textarea.addEventListener("input", () => {
      set(textarea.value);
      checkSyntax();
    });

    /** Fügt Text ein und meldet die Änderung wie eine normale Eingabe. */
    function insert(before, after = "", placeholder = "") {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.slice(start, end) || placeholder;
      textarea.setRangeText(`${before}${selected}${after}`, start, end, "end");
      if (!textarea.value.slice(start, end).length && placeholder) {
        textarea.setSelectionRange(
          start + before.length,
          start + before.length + selected.length,
        );
      }
      textarea.focus();
      textarea.dispatchEvent(new Event("input"));
    }
    function linePrefix(prefix) {
      const start =
        textarea.value.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
      textarea.setRangeText(prefix, start, start, "end");
      textarea.focus();
      textarea.dispatchEvent(new Event("input"));
    }

    function tool(text, title, action) {
      return el(
        "button",
        { type: "button", class: "toolbar__button", title, onclick: action },
        text,
      );
    }
    const toolbar = el(
      "div",
      {
        class: "toolbar",
        role: "toolbar",
        "aria-label": "Textformat",
        "aria-controls": id,
      },
      tool("Fett", "Markierten Text fett: **Text**", () =>
        insert("**", "**", "fetter Text"),
      ),
      tool("Kursiv", "Markierten Text kursiv: *Text*", () =>
        insert("*", "*", "kursiver Text"),
      ),
      tool("Link", "Link einfügen: [Text](https://…)", () =>
        insert("[", "](https://)", "Linktext"),
      ),
      tool("Liste", "Listenpunkt am Zeilenanfang: - ", () => linePrefix("- ")),
      tool("Zwischenüberschrift", "Zwischenüberschrift: ### ", () =>
        linePrefix("### "),
      ),
      tool("Glossar", "Glossarbegriff einfügen: [[Begriff]]", async () => {
        // Der modale Dialog setzt die Markierung im Textfeld zurück → vorher merken.
        const { selectionStart, selectionEnd } = textarea;
        const term = await context.pickGlossaryTerm();
        if (!term) {
          return;
        }
        textarea.setSelectionRange(selectionStart, selectionEnd);
        insert(`[[${term}]]`);
      }),
      tool("Platzhalter", "Platzhalter für fehlenden Inhalt: {{TODO: …}}", () =>
        insert("{{TODO: ", "}}", "Was fehlt hier?"),
      ),
    );
    // Pfeiltasten wechseln zwischen den Knöpfen der Werkzeugleiste (WAI-ARIA-Muster „Toolbar").
    toolbar.addEventListener("keydown", (event) => {
      const buttons = [...toolbar.querySelectorAll("button")];
      const index = buttons.indexOf(
        /** @type {HTMLButtonElement} */ (document.activeElement),
      );
      if (index === -1 || !["ArrowRight", "ArrowLeft"].includes(event.key)) {
        return;
      }
      event.preventDefault();
      buttons[
        (index + (event.key === "ArrowRight" ? 1 : buttons.length - 1)) %
          buttons.length
      ].focus();
    });
    checkSyntax();
    return el(
      "div",
      { class: "field" },
      label,
      hint,
      toolbar,
      textarea,
      warning,
    );
  }

  /** Bildfeld: Pfad zum Bild, Vorschau und Knopf zum Importieren. */
  function renderImageField({ id, label, hint, hintId, value, set, context }) {
    const input = el("input", {
      type: "text",
      id,
      value,
      class: "field__input",
      "aria-describedby": hintId,
      placeholder: "assets/bilder/…",
    });
    const thumb = el("img", {
      class: "field__thumb",
      alt: "",
      src: value ? context.imageUrl(value) : null,
      hidden: !value,
    });
    input.addEventListener("input", () => {
      set(input.value.trim());
      thumb.hidden = input.value.trim() === "";
      thumb.src = context.imageUrl(input.value.trim());
    });
    const pick = el(
      "button",
      { type: "button", class: "button button--small" },
      "Bild wählen …",
    );
    pick.addEventListener("click", async () => {
      const path = await context.pickImage();
      if (!path) {
        return;
      }
      input.value = path;
      input.dispatchEvent(new Event("input"));
    });
    return el(
      "div",
      { class: "field" },
      label,
      hint,
      el("div", { class: "field__row" }, input, pick),
      thumb,
    );
  }

  /** Liste mit Einträgen; jeder Eintrag hat eigene Felder und lässt sich verschieben/entfernen. */
  function renderListField(field, data, context, id) {
    const items = getPath(data, field.key) ?? [];
    const primitive =
      field.itemFields?.length === 1 && field.itemFields[0].key === "value";
    const itemLabel = field.itemLabel ?? "Eintrag";

    function structural(mutate) {
      return context.change(mutate, { structural: true });
    }
    const list = el(
      "ol",
      { class: "field-list__items" },
      items.map((item, index) => {
        // Für Listen aus reinen Texten ein Hilfsobjekt, das Änderungen in die Liste zurückschreibt.
        const proxy = primitive
          ? {
              get value() {
                return items[index];
              },
              set value(text) {
                items[index] = text;
              },
            }
          : item;
        const itemContext = { ...context, idPrefix: `${id}-${index}` };
        function move(delta) {
          return structural(() => {
            const target = index + delta;
            [items[index], items[target]] = [items[target], items[index]];
          });
        }
        return el(
          "li",
          { class: "field-list__item" },
          el(
            "fieldset",
            { class: "field-list__fieldset" },
            el("legend", {}, `${itemLabel} ${index + 1}`),
            renderFields(field.itemFields ?? [], proxy, itemContext),
            el(
              "div",
              { class: "field-list__actions" },
              el(
                "button",
                {
                  type: "button",
                  class: "button button--small",
                  disabled: index === 0,
                  "aria-label": `${itemLabel} ${index + 1} nach oben`,
                  onclick: () => move(-1),
                },
                "↑",
              ),
              el(
                "button",
                {
                  type: "button",
                  class: "button button--small",
                  disabled: index === items.length - 1,
                  "aria-label": `${itemLabel} ${index + 1} nach unten`,
                  onclick: () => move(1),
                },
                "↓",
              ),
              el(
                "button",
                {
                  type: "button",
                  class: "button button--small",
                  disabled: items.length <= (field.min ?? 0),
                  "aria-label": `${itemLabel} ${index + 1} entfernen`,
                  onclick: () => structural(() => items.splice(index, 1)),
                },
                "Entfernen",
              ),
            ),
          ),
        );
      }),
    );
    const add = el(
      "button",
      { type: "button", class: "button button--small" },
      `+ ${itemLabel} hinzufügen`,
    );
    add.addEventListener("click", () =>
      structural(() => {
        if (!Array.isArray(getPath(data, field.key))) {
          setPath(data, field.key, items);
        }
        items.push(primitive ? "" : createEmptyItem(field.itemFields ?? []));
      }),
    );
    return el(
      "fieldset",
      { class: "field-list" },
      el(
        "legend",
        { class: "field-list__legend" },
        field.label,
        el("span", { class: "field-list__count" }, ` (${items.length})`),
      ),
      field.help ? el("p", { class: "field__hint" }, field.help) : null,
      list,
      add,
    );
  }

  /**
   * Startwerte für einen neuen Listeneintrag.
   * @param {import('../blocks/registry.js').FieldSchema[]} itemFields
   * @returns {Object}
   */
  function createEmptyItem(itemFields) {
    const item = {};
    for (const field of itemFields) {
      const start =
        {
          number: field.min ?? 0,
          boolean: false,
          select: field.options?.[0] ?? "",
          list: [],
        }[field.type] ?? "";
      if (field.key.includes(".")) {
        // Verschachtelte Felder (z. B. fields.kurz): Elternobjekt anlegen, leere Texte weglassen.
        const parent = field.key.split(".").slice(0, -1).join(".");
        if (getPath(item, parent) === undefined) {
          setPath(item, parent, {});
        }
        if (start !== "") {
          setPath(item, field.key, start);
        }
      } else {
        setPath(item, field.key, start);
      }
    }
    return item;
  }

  EM.define("js/editor/field-renderers.js", {
    getPath,
    setPath,
    renderFields,
    renderField,
    renderMarkdownField,
  });
})();
