/*
 * start-lights.js – Startampel vor dem Qualifying
 *
 * Wie beim Rennstart: Fünf Lichtpaare gehen nacheinander rot an, dann gehen alle aus – los.
 * Der einzige „Show-Moment" im Kurs, einmalig vor dem Qualifying, ca. 3 Sekunden.
 *
 * Barrierefreiheit:
 *   – Jederzeit überspringbar („Überspringen").
 *   – Bei „Bewegung reduzieren" (prefers-reduced-motion) gibt es keine Animation: Die Lichter
 *     stehen still, ein Knopf „Qualifying starten" führt weiter.
 *   – Die Lichter sind Dekoration (aria-hidden); der Status wird als Text angesagt.
 *
 * Farbe: Rot ist hier bewusst die einzige Farbe außerhalb des Team-CD – eine Startampel ist
 * rot, alles andere wäre unverständlich. Rot wird nirgends sonst verwendet.
 *
 * Wenn du hier etwas ändern willst …
 *   – Tempo: STEP_MS (Abstand zwischen den Lichtern).
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { prefersReducedMotion } = EM.require("js/blocks/block-utils.js");

  const STEP_MS = 550;
  const LIGHTS = 5;

  /**
   * Erzeugt die Startampel.
   * @param {() => void} onGo  wird aufgerufen, wenn es losgeht (oder übersprungen wird)
   * @returns {{node: HTMLElement, destroy: () => void}}
   */
  function createStartLights(onGo) {
    const timers = [];
    let done = false;
    const reduced = prefersReducedMotion();

    const lights = Array.from({ length: LIGHTS }, () =>
      el(
        "span",
        { class: "start-lights__column" },
        el("span", { class: "start-lights__lamp" }),
        el("span", { class: "start-lights__lamp" }),
      ),
    );
    const status = el(
      "p",
      { class: "start-lights__status", role: "status" },
      reduced ? "" : "Die Startampel läuft …",
    );

    function go() {
      if (done) {
        return;
      }
      done = true;
      timers.forEach(clearTimeout);
      onGo();
    }

    const actions = reduced
      ? el(
          "button",
          { type: "button", class: "button button--primary button--large" },
          "Qualifying starten",
        )
      : el("button", { type: "button", class: "button" }, "Überspringen");
    actions.addEventListener("click", go);

    const node = el(
      "div",
      { class: "start-lights" },
      el(
        "div",
        { class: "start-lights__panel", "aria-hidden": "true" },
        lights,
      ),
      status,
      el("div", { class: "block__actions" }, actions),
    );

    if (!reduced) {
      lights.forEach((light, index) => {
        timers.push(
          setTimeout(() => light.classList.add("is-on"), STEP_MS * (index + 1)),
        );
      });
      // Kurze, leicht zufällige Pause bei voller Ampel – wie im echten Start.
      const out = STEP_MS * (LIGHTS + 1) + Math.round(Math.random() * 400);
      timers.push(
        setTimeout(() => {
          lights.forEach((light) => light.classList.remove("is-on"));
          status.textContent = "Los!";
        }, out),
      );
      timers.push(setTimeout(go, out + 500));
    }

    return {
      node,
      destroy() {
        done = true;
        timers.forEach(clearTimeout);
      },
    };
  }

  EM.define("js/ui/start-lights.js", { createStartLights });
})();
