/*
 * settings.js – Einstellungen (#/einstellungen)
 *
 * – Darstellung: Wie System / Dunkel / Hell
 * – Fortschritt zurücksetzen (mit Bestätigungsdialog, <dialog>)
 * – Hinweis, wo die Daten liegen (nur in diesem Browser)
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Einstellung: Feld in js/core/store.js (createEmptyState) ergänzen, hier ein Formularfeld.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { applyTheme } = EM.require("js/ui/theme.js");

  /**
   * @param {import("./view-types.js").ViewContext} context
   * @returns {import("./view-types.js").ViewResult}
   */
  function renderSettings({ store }) {
    const state = store.get();
    const status = el("p", { class: "settings__status", role: "status" });

    // ── Darstellung ──
    const options = [
      {
        value: "system",
        label: "Wie System",
        hint: "folgt der Einstellung deines Geräts",
      },
      { value: "dark", label: "Dunkel", hint: "" },
      { value: "light", label: "Hell", hint: "gut lesbar bei Sonne" },
    ];
    const themeFieldset = el(
      "fieldset",
      { class: "choice-group" },
      el("legend", {}, "Darstellung"),
      options.map((option) =>
        el(
          "label",
          { class: "choice" },
          el("input", {
            type: "radio",
            name: "theme",
            value: option.value,
            checked: state.theme === option.value,
            onchange: () => {
              applyTheme(option.value);
              store.update((draft) => {
                draft.theme = option.value;
              });
            },
          }),
          el(
            "span",
            {},
            option.label,
            option.hint
              ? el("span", { class: "choice__hint" }, ` – ${option.hint}`)
              : null,
          ),
        ),
      ),
    );

    // ── Zurücksetzen mit Bestätigung ──
    const dialog = el(
      "dialog",
      { class: "dialog", "aria-labelledby": "reset-title" },
      el(
        "form",
        { method: "dialog", class: "stack" },
        el("h2", { id: "reset-title" }, "Fortschritt wirklich zurücksetzen?"),
        el(
          "p",
          {},
          "Alle bestandenen Sektoren, das Qualifying, abgehakte Checklisten und dein Name werden in diesem Browser gelöscht. Das lässt sich nicht rückgängig machen.",
        ),
        el(
          "div",
          { class: "dialog__actions" },
          el(
            "button",
            { class: "button", value: "cancel", autofocus: true },
            "Abbrechen",
          ),
          el(
            "button",
            { class: "button button--danger", value: "reset" },
            "Ja, zurücksetzen",
          ),
        ),
      ),
    );
    dialog.addEventListener("close", () => {
      if (dialog.returnValue === "reset") {
        store.reset();
        status.textContent = "Dein Fortschritt wurde zurückgesetzt.";
      }
    });

    const persistent = store.isPersistent();

    return {
      title: "Einstellungen",
      node: el(
        "div",
        { class: "stack stack--loose" },
        el("h1", {}, "Einstellungen"),
        themeFieldset,
        el(
          "section",
          { class: "stack", "aria-labelledby": "progress-title" },
          el("h2", { id: "progress-title" }, "Dein Fortschritt"),
          el(
            "p",
            {},
            persistent
              ? "Dein Fortschritt wird nur in diesem Browser auf diesem Gerät gespeichert. Es gibt kein Konto und keinen Server. Wechselst du das Gerät oder löschst du die Browserdaten, beginnst du von vorn."
              : "Speichern ist in diesem Browser gerade nicht möglich (z. B. privates Fenster). Dein Fortschritt geht beim Schließen verloren.",
          ),
          el(
            "p",
            {},
            el(
              "button",
              {
                class: "button",
                type: "button",
                onclick: () => dialog.showModal(),
              },
              "Fortschritt zurücksetzen",
            ),
          ),
          status,
          dialog,
        ),
      ),
    };
  }

  EM.define("js/views/settings.js", { renderSettings });
})();
