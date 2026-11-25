/*
 * ordering.js – Baustein „reihenfolge": Schritte in die richtige Reihenfolge bringen
 *
 * Kursdown (Schritte in der RICHTIGEN Reihenfolge; angezeigt werden sie gemischt):
 *   :::reihenfolge Wie legst du eine Datei richtig ab?
 *   Datei nach der Namensregel benennen
 *   Richtigen Ordner im Drive suchen
 *   Hochladen
 *   > Erst benennen, dann ablegen: So findet sie später jeder über die Suche.
 *   :::
 *
 * Die Zeile mit > ist die Erklärung, die nach dem Prüfen erscheint (empfohlen).
 *
 * Bedienung: Jeder Schritt hat die Knöpfe „nach oben" und „nach unten". Nach jedem Verschieben
 * sagt ein aria-live-Bereich die neue Position an. Bei falscher Reihenfolge wird die richtige
 * angezeigt – mit Erklärung.
 *
 * Wenn du hier etwas ändern willst …
 *   – Aussehen: css/blocks/ordering.css.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { icon } = EM.require("js/ui/icons.js");
  const {
    blockError,
    blockSection,
    formatBlock,
    formatHeader,
    oneLine,
    shuffle,
    trimLines,
    trackExercise,
  } = EM.require("js/blocks/block-utils.js");

  /** @typedef {{title: string, steps: string[], explanation: string}} OrderingData */

  /** @type {import('./registry.js').BlockDefinition} */
  const definition = {
    name: "reihenfolge",
    interactive: true,

    parse(raw) {
      const steps = [];
      const explanation = [];
      for (const { text } of trimLines(raw.lines)) {
        const trimmed = text.trim();
        if (trimmed === "") {
          continue;
        }
        if (trimmed.startsWith(">")) {
          explanation.push(trimmed.replace(/^>\s?/, "").trim());
        } else {
          steps.push(trimmed.replace(/^(?:[-*]|\d+\.)\s+/, ""));
        }
      }
      return {
        data: { title: raw.title, steps, explanation: explanation.join(" ") },
        errors: [],
      };
    },

    validate(data, raw) {
      const errors = [];
      if (data.steps.length < 2) {
        errors.push(
          blockError(
            raw,
            raw.line,
            "Es braucht mindestens zwei Schritte.",
            "Schreibe jeden Schritt in eine eigene Zeile, in der richtigen Reihenfolge.",
          ),
        );
      }
      if (new Set(data.steps).size !== data.steps.length) {
        errors.push(
          blockError(
            raw,
            raw.line,
            "Zwei Schritte haben denselben Text.",
            "Jeder Schritt muss eindeutig sein, sonst kann die Reihenfolge nicht geprüft werden.",
          ),
        );
      }
      if (!data.explanation) {
        errors.push(
          blockError(
            raw,
            raw.line,
            "Es fehlt eine Erklärung.",
            'Ergänze eine Zeile „> Darum diese Reihenfolge: …".',
            "hinweis",
          ),
        );
      }
      return errors;
    },

    /**
     * @param {OrderingData} data
     * @param {import("./block-utils.js").BlockContext} context
     */
    render(data, context) {
      const { section } = blockSection(
        "ordering",
        data.title,
        context,
        "Reihenfolge-Aufgabe",
      );
      const announcer = el("p", {
        class: "visually-hidden",
        "aria-live": "polite",
      });
      const result = el("div", {
        class: "ordering__result",
        "aria-live": "polite",
      });
      const list = el("ol", { class: "ordering__list" });

      // Mischen – aber nie so, dass zufällig schon alles stimmt.
      let order = shuffle(data.steps, context.random);
      if (
        order.length > 1 &&
        order.every((step, index) => step === data.steps[index])
      ) {
        order = [...order.slice(1), order[0]];
      }

      function draw(focusStep = null, focusDirection = null) {
        list.replaceChildren(
          ...order.map((step, index) => {
            const up = el(
              "button",
              {
                type: "button",
                class: "icon-button ordering__move",
                disabled: index === 0,
                "aria-label": `„${step}" nach oben`,
              },
              icon("arrowUp", "icon-button__icon"),
            );
            const down = el(
              "button",
              {
                type: "button",
                class: "icon-button ordering__move",
                disabled: index === order.length - 1,
                "aria-label": `„${step}" nach unten`,
              },
              icon("arrowDown", "icon-button__icon"),
            );
            up.addEventListener("click", () => move(index, -1));
            down.addEventListener("click", () => move(index, 1));
            const item = el(
              "li",
              { class: "ordering__item" },
              el(
                "span",
                { class: "ordering__position", "aria-hidden": "true" },
                String(index + 1),
              ),
              el(
                "span",
                { class: "ordering__text" },
                context.renderInline(step),
              ),
              el("span", { class: "ordering__buttons" }, up, down),
            );
            if (step === focusStep) {
              // Fokus bleibt am verschobenen Schritt. Ist der Knopf jetzt gesperrt (ganz oben/
              // unten), springt er auf den anderen Knopf.
              queueMicrotask(() => {
                const preferred = focusDirection === -1 ? up : down;
                (preferred.disabled
                  ? preferred === up
                    ? down
                    : up
                  : preferred
                ).focus();
              });
            }
            return item;
          }),
        );
      }

      function move(index, direction) {
        const target = index + direction;
        [order[index], order[target]] = [order[target], order[index]];
        result.replaceChildren();
        draw(order[target], direction);
        announcer.textContent = `„${order[target]}" ist jetzt an Position ${target + 1} von ${order.length}.`;
      }

      // ── Ziehen mit Maus, Stift oder Finger (zusätzlich zu den Pfeilknöpfen) ──
      // Mit der Maus lässt sich die ganze Zeile ziehen, per Touch nur die Platznummer (Griff),
      // damit man auf dem Handy über die Liste weiterhin scrollen kann.
      /** @type {{ item: HTMLElement, pointerId: number, from: number }|null} */
      let drag = null;

      list.addEventListener("pointerdown", (event) => {
        const target = /** @type {Element} */ (event.target);
        const item = /** @type {HTMLElement|null} */ (
          target.closest(".ordering__item")
        );
        if (!item || event.button !== 0 || target.closest("button")) {
          return;
        }
        if (event.pointerType === "touch" && !target.closest(".ordering__position")) {
          return;
        }
        event.preventDefault();
        try {
          item.setPointerCapture(event.pointerId);
        } catch {
          // Ohne Capture funktioniert das Ziehen innerhalb der Liste trotzdem.
        }
        item.classList.add("is-dragging");
        drag = {
          item,
          pointerId: event.pointerId,
          from: [...list.children].indexOf(item),
        };
      });

      list.addEventListener("pointermove", (event) => {
        if (!drag || event.pointerId !== drag.pointerId) {
          return;
        }
        const others = [...list.children].filter((child) => child !== drag?.item);
        const before = others.find((child) => {
          const box = child.getBoundingClientRect();
          return event.clientY < box.top + box.height / 2;
        });
        if (before) {
          if (drag.item.nextElementSibling !== before) {
            list.insertBefore(drag.item, before);
          }
        } else if (list.lastElementChild !== drag.item) {
          list.append(drag.item);
        }
      });

      /** @param {PointerEvent} event */
      function endDrag(event) {
        if (!drag || event.pointerId !== drag.pointerId) {
          return;
        }
        const { item, from } = drag;
        drag = null;
        item.classList.remove("is-dragging");
        const to = [...list.children].indexOf(item);
        if (to === from) {
          return;
        }
        const [step] = order.splice(from, 1);
        order.splice(to, 0, step);
        result.replaceChildren();
        draw();
        announcer.textContent = `„${step}" ist jetzt an Position ${to + 1} von ${order.length}.`;
      }
      list.addEventListener("pointerup", endDrag);
      list.addEventListener("pointercancel", endDrag);

      const checkButton = el(
        "button",
        { type: "button", class: "button button--primary" },
        "Reihenfolge prüfen",
      );
      const markSolved = trackExercise(
        section,
        context,
        `reihenfolge:${JSON.stringify(data.steps)}`,
      );
      checkButton.addEventListener("click", () => {
        const correctCount = order.filter(
          (step, index) => step === data.steps[index],
        ).length;
        const allRight = correctCount === order.length;
        if (allRight) {
          markSolved();
        }
        for (const [index, item] of [...list.children].entries()) {
          item.classList.toggle(
            "is-correct",
            order[index] === data.steps[index],
          );
          item.classList.toggle("is-wrong", order[index] !== data.steps[index]);
        }
        result.replaceChildren(
          el(
            "div",
            { class: `feedback feedback--${allRight ? "correct" : "wrong"}` },
            el(
              "p",
              {},
              icon(allRight ? "check" : "cross", "feedback__icon"),
              el(
                "strong",
                {},
                allRight
                  ? "Richtig, genau so."
                  : `${correctCount} von ${order.length} Schritten stehen schon richtig.`,
              ),
            ),
            allRight ? null : el("p", {}, "Die richtige Reihenfolge:"),
            allRight
              ? null
              : el(
                  "ol",
                  {},
                  data.steps.map((step) =>
                    el("li", {}, context.renderInline(step)),
                  ),
                ),
            data.explanation
              ? el("p", {}, context.renderInline(data.explanation))
              : null,
          ),
        );
      });

      draw();
      section.append(
        el(
          "p",
          { class: "block__hint" },
          "Zieh die Schritte mit der Maus an die richtige Stelle oder nutze die Pfeilknöpfe.",
        ),
        list,
        el("div", { class: "block__actions" }, checkButton),
        announcer,
        result,
      );
      return section;
    },

    /** @param {OrderingData} data */
    serialize(data) {
      const lines = data.steps.map((step) => oneLine(step));
      if (data.explanation) {
        lines.push(`> ${oneLine(data.explanation)}`);
      }
      return formatBlock(formatHeader("reihenfolge", data.title), lines);
    },

    editor: {
      label: "Reihenfolge",
      description:
        "Schritte in die richtige Reihenfolge bringen; angezeigt wird gemischt.",
      icon: "assets/icons/reihenfolge.svg",
      createDefault: () => ({
        title: "Bring die Schritte in die richtige Reihenfolge",
        steps: ["Erster Schritt", "Zweiter Schritt", "Dritter Schritt"],
        explanation: "Warum genau diese Reihenfolge?",
      }),
      fields: [
        { key: "title", type: "text", label: "Aufgabe / Frage" },
        {
          key: "steps",
          type: "list",
          label: "Schritte in der richtigen Reihenfolge",
          itemLabel: "Schritt",
          min: 2,
          help: "Im Kurs werden die Schritte gemischt angezeigt.",
          itemFields: [
            { key: "value", type: "text", label: "Schritt", required: true },
          ],
        },
        {
          key: "explanation",
          type: "text",
          label: "Erklärung (warum diese Reihenfolge?)",
        },
      ],
    },
  };

  EM.define("js/blocks/ordering.js", { default: definition });
})();
