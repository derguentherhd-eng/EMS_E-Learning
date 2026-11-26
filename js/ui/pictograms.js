/*
 * pictograms.js – animierte Sicherheits-Piktogramme (kinetischer Piktogramm-Stil)
 *
 * Figuren und Gegenstände bestehen nur aus geometrischen Grundformen: Kreis als Kopf (ohne Hals),
 * Kapseln (Linien mit runden Enden) für Rumpf und Glieder, einfarbige Flächen in currentColor.
 * Überlappende Teile trennt ein schmaler Rand in Hintergrundfarbe (--pg-bg), damit die Figur
 * auch einfarbig lesbar bleibt.
 *
 * Jede Animation läuft in drei Phasen (Zeiten in css/components/pictogram.css):
 *   1. Auftritt (0,6 s)  Teile fliegen herein bzw. klappen in die Zielpose
 *   2. Pose     (1,8 s)  die Figur steht still in der Piktogramm-Pose – die eigentliche Botschaft
 *   3. Abgang   (0,6 s)  die Figur führt die Handlung zu Ende und verlässt das Bild
 * Ohne Animation (prefers-reduced-motion, kein JavaScript, vor dem Abspielen) zeigt das SVG
 * immer Phase 2. Die Pose steht deshalb als Grundzustand im CSS, die Animation weicht nur ab.
 *
 * Aufbau des Skeletts (viewBox 0 0 200 200, Figur schaut nach rechts): Jedes Körperteil ist eine
 * eigene <g>-Gruppe mit Drehpunkt im Gelenk (style="--o: x y", siehe JOINTS). Unterarm und
 * Unterschenkel liegen IN Oberarm bzw. Oberschenkel – so drehen sie automatisch mit.
 *
 * Benutzen:
 *   – Im Kurs: Baustein „:::piktogramm“ (js/blocks/pictogram-block.js).
 *   – Im Code: createPictogram('schutzbrille', { loop: true, size: '12rem', color: '#ffed00' }).
 *
 * Wenn du hier etwas ändern willst …
 *   – Neues Piktogramm: Eintrag in PICTOGRAMS (Bezeichnung + Gegenstände) und Bewegungen in
 *     css/components/pictogram.css (Abschnitt mit [data-pictogram="…"]).
 *   – Proportionen der Figur: JOINTS und die Strichstärken in pictogram.css.
 */

(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  /** Gelenkpunkte im Grundstand (aufrecht, Arme und Beine gerade nach unten). */
  const JOINTS = {
    neck: [100, 60],
    shoulder: [100, 72],
    elbow: [100, 94],
    hand: [100, 116],
    hip: [100, 112],
    knee: [100, 140],
    foot: [100, 168],
    head: [100, 43],
    ground: [100, 176],
  };

  /** @param {number[]} point */
  function origin([x, y]) {
    return `--o: ${x}px ${y}px`;
  }

  /**
   * Kapsel (Linie mit runden Enden). Mit gap wird darunter ein breiterer Strich in Hintergrund-
   * farbe gezeichnet, der das Teil von dahinterliegenden Teilen trennt.
   */
  function capsule(from, to, className, gap = true) {
    const coords = `x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}"`;
    return `${gap ? `<line class="pg-gap ${className}" ${coords}/>` : ""}<line class="pg-line ${className}" ${coords}/>`;
  }

  /**
   * Ein Arm (Ober- und Unterarm) mit optionalem Gegenstand in der Hand.
   * @param {'front'|'back'} side
   * @param {string} [handObject]  SVG-Markup, liegt im Unterarm
   */
  function arm(side, handObject = "") {
    const { shoulder, elbow, hand } = JOINTS;
    return `<g class="pg-arm pg-arm--${side}" style="${origin(shoulder)}">
      ${capsule(shoulder, elbow, "pg-limb")}
      <g class="pg-forearm pg-forearm--${side}" style="${origin(elbow)}">
        ${capsule(elbow, hand, "pg-limb")}${handObject}
      </g>
    </g>`;
  }

  /** Ein Bein (Ober- und Unterschenkel). */
  function leg(side) {
    const { hip, knee, foot } = JOINTS;
    return `<g class="pg-leg pg-leg--${side}" style="${origin(hip)}">
      ${capsule(hip, knee, "pg-limb")}
      <g class="pg-shin pg-shin--${side}" style="${origin(knee)}">
        ${capsule(knee, foot, "pg-limb")}
      </g>
    </g>`;
  }

  /**
   * Die ganze Figur. objects: Gegenstände an Kopf und Händen.
   * @param {{head?: string, handFront?: string, handBack?: string}} [objects]
   */
  function figure(objects = {}) {
    const { head, neck, hip, ground } = JOINTS;
    return `<g class="pg-figure" style="${origin(ground)}">
      ${leg("back")}
      <g class="pg-body" style="${origin(hip)}">
        ${arm("back", objects.handBack)}
        ${capsule([100, 70], [100, 106], "pg-torso")}
        <g class="pg-head" style="${origin(neck)}">
          <circle class="pg-gap-fill" cx="${head[0]}" cy="${head[1]}" r="16"/>
          <circle class="pg-fill" cx="${head[0]}" cy="${head[1]}" r="13"/>
          ${objects.head ?? ""}
        </g>
        ${arm("front", objects.handFront)}
      </g>
      ${leg("front")}
    </g>`;
  }

  /**
   * Alle Piktogramme: Bezeichnung (für Screenreader und Editor) und SVG-Inhalt.
   * Gegenstände sind eigene Gruppen mit Drehpunkt, damit sie unabhängig fliegen können.
   */
  const PICTOGRAMS = {
    schutzbrille: {
      label: "Schutzbrille aufsetzen",
      description:
        "Eine Figur setzt eine Schutzbrille auf, hält kurz inne und wendet sich dann der Arbeit zu.",
      svg: () =>
        figure({
          head: `<g class="pg-goggles" style="${origin([114, 41])}">
            <rect class="pg-fill" x="80" y="38" width="26" height="5" rx="2.5"/>
            <rect class="pg-gap-fill" x="99" y="30" width="32" height="22" rx="9"/>
            <rect class="pg-fill" x="102" y="33" width="26" height="16" rx="7"/>
            <rect class="pg-gap-fill" x="108" y="37" width="14" height="4" rx="2"/>
          </g>`,
        }) + floor(),
    },

    stolpern: {
      label: "Vorsicht, Stolpergefahr",
      description:
        "Eine Figur läuft, stolpert über eine Stufe und fängt sich, dann steigt sie bewusst darüber.",
      svg: () =>
        `${floor()}<g class="pg-step" style="${origin([128, 176])}">
          <rect class="pg-fill" x="108" y="158" width="44" height="18" rx="3"/>
        </g>${figure()}${warning([42, 18])}`,
    },

    heben: {
      label: "Schwer heben: in die Knie, Rücken gerade",
      description:
        "Eine Figur geht in die Knie, hebt eine Kiste mit geradem Rücken und geht mit ihr weiter.",
      svg: () =>
        `${floor() + figure()}<g class="pg-box" style="${origin([133, 168])}">
          <rect class="pg-gap-fill" x="115" y="127" width="40" height="44" rx="6"/>
          <rect class="pg-fill" x="118" y="130" width="34" height="38" rx="4"/>
          <rect class="pg-gap-fill" x="118" y="142" width="34" height="3"/>
        </g>`,
    },

    fluchtweg: {
      label: "Fluchtweg: zum Notausgang",
      description:
        "Eine Figur rennt los, ist kurz in der Laufpose zu sehen und verschwindet durch die Tür.",
      svg: () =>
        `<g class="pg-door" style="${origin([180, 176])}">
          <rect class="pg-fill" x="146" y="64" width="40" height="6" rx="2"/>
          <rect class="pg-fill" x="146" y="64" width="6" height="112" rx="2"/>
          <rect class="pg-fill" x="180" y="64" width="6" height="112" rx="2"/>
          <g class="pg-door-leaf" style="${origin([180, 120])}">
            <rect class="pg-fill" x="155" y="73" width="25" height="103" rx="2"/>
          </g>
        </g>${floor()}${figure()}`,
    },
  };

  /** Boden: wächst beim Auftritt aus der Mitte, schrumpft beim Abgang. */
  function floor() {
    return `<g class="pg-floor" style="${origin([100, 178])}"><rect class="pg-fill" x="30" y="176" width="140" height="4" rx="2"/></g>`;
  }

  /** Warndreieck mit Ausrufezeichen (Mittelpunkt der Unterkante bei x, y + 40). */
  function warning([x, y]) {
    return `<g class="pg-warning" style="${origin([x, y + 20])}">
      <path class="pg-fill" d="M${x} ${y} L${x + 23} ${y + 40} H${x - 23} Z" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>
      <rect class="pg-gap-fill" x="${x - 3}" y="${y + 12}" width="6" height="15" rx="3"/>
      <circle class="pg-gap-fill" cx="${x}" cy="${y + 33}" r="3.5"/>
    </g>`;
  }

  /**
   * Erzeugt ein Piktogramm als <figure> mit Inline-SVG.
   * @param {string} name  Schlüssel aus PICTOGRAMS
   * @param {Object} [options]
   * @param {boolean} [options.loop=true]  true = Endlosschleife; false = einmal abspielen, sobald
   *   es ins Bild scrollt, erneut bei Maus darüber bzw. Fokus
   * @param {string} [options.size]   CSS-Größe, z. B. '10rem' (Standard: --pg-size in pictogram.css)
   * @param {string} [options.color]  CSS-Farbe der Figur (Standard: Textfarbe)
   * @param {string} [options.label]  eigener Text für Screenreader
   * @returns {HTMLElement|null}  null, wenn es das Piktogramm nicht gibt
   */
  function createPictogram(name, options = {}) {
    const pictogram = PICTOGRAMS[name];
    if (!pictogram) {
      return null;
    }
    const { loop = true, size, color, label } = options;
    const wrapper = document.createElement("span");
    wrapper.className = "pictogram";
    wrapper.dataset.pictogram = name;
    wrapper.dataset.loop = String(loop);
    if (size) {
      wrapper.style.setProperty("--pg-size", size);
    }
    if (color) {
      wrapper.style.color = color;
    }
    if (pictogram.timing) {
      const [entry, hold, exit] = pictogram.timing;
      wrapper.style.setProperty("--pg-entry", `${entry}s`);
      wrapper.style.setProperty("--pg-hold", `${hold}s`);
      wrapper.style.setProperty("--pg-exit", `${exit}s`);
    }
    if (pictogram.motion) {
      installMotion(name, pictogram);
    }
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", pictogram.viewBox ?? "0 0 200 200");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label ?? pictogram.label);
    svg.innerHTML = pictogram.svg();
    wrapper.append(svg);
    setupPlayback(wrapper, loop);
    return wrapper;
  }

  /**
   * Abspielen steuern: Schleife läuft nur, solange das Piktogramm sichtbar ist (spart Akku);
   * einmalige Piktogramme spielen beim ersten Sichtbarwerden und erneut bei Maus/Fokus.
   * Die Klasse is-playing startet die CSS-Animation.
   * @param {HTMLElement} wrapper
   * @param {boolean} loop
   */
  function setupPlayback(wrapper, loop) {
    const svg = wrapper.querySelector("svg");
    // Manche Motive bewegen Teile zusätzlich auf einer Bahn (SVG <animateMotion>, z. B. das Auto
    // auf der Rennstrecke). Diese Zeitleiste wird mit der CSS-Animation gestartet und gestoppt.
    const hasTimeline =
      svg?.querySelector("animateMotion, animate, animateTransform") != null;
    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    function start() {
      wrapper.classList.add("is-playing");
      if (hasTimeline && !reducedMotion) {
        svg.setCurrentTime(0);
        svg.unpauseAnimations();
      }
    }

    function stop() {
      wrapper.classList.remove("is-playing");
      if (hasTimeline) {
        svg.pauseAnimations();
        // Grundzustand: Bahn-Bewegung am Anfang (z. B. Auto an der Startlinie).
        svg.setCurrentTime(0);
      }
    }

    function play() {
      stop();
      // Neu starten: Stil einmal auswerten lassen, sonst läuft die Animation nicht von vorn.
      void wrapper.offsetWidth;
      start();
    }

    if (hasTimeline) {
      svg.pauseAnimations();
    }
    if (!("IntersectionObserver" in window)) {
      start();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (loop) {
          if (entry.isIntersecting) {
            start();
          } else {
            stop();
          }
        } else if (entry.isIntersecting) {
          play();
          observer.disconnect();
        } else {
          stop();
        }
      }
    });
    observer.observe(wrapper);
    if (!loop) {
      wrapper.addEventListener("mouseenter", play);
      wrapper.addEventListener("focusin", play);
      // Nach dem Abgang wieder die Pose zeigen (Grundzustand), nicht ein leeres Bild.
      // Alle Teile enden gleichzeitig – das erste Ende genügt.
      wrapper.addEventListener("animationend", stop);
    }
  }

  // ───────────────────────── Bewegungen als Daten ─────────────────────────
  //
  // Neuere Motive (js/ui/pictograms-safety.js) beschreiben ihre Bewegung nicht direkt in CSS,
  // sondern als Daten. installMotion() macht daraus einmalig CSS-@keyframes (ein <style> im
  // <head>) – die Animation selbst bleibt reines CSS.
  //
  //   timing: [Auftritt, Pose, Abgang] in Sekunden, z. B. [0.6, 1.8, 1.2]
  //   motion: { "<CSS-Selektor im SVG>": {
  //       hold:    Transformation in der Pose (Phase 2, auch Grundzustand), z. B. "rotate(-40deg)"
  //       opacity: Deckkraft in der Pose (z. B. 0 für Folgen, die erst in Phase 3 erscheinen)
  //       dash:    Strichlänge in der Pose (0 = ganz gezeichnet, 1 = unsichtbar; Pfad mit pathLength="1")
  //       frames:  [[Zeit, { t: Transformation, o: Deckkraft, d: Strich, e: Easing }], …]
  //   } }
  // Zeiten: Sekunden oder Phasenmarken "H" (Beginn der Pose), "X" (Beginn des Abgangs),
  // "E" (Ende), auch mit Abstand, z. B. "X+0.3". t: "hold" = Pose. e: "in" = Auftritts-Easing,
  // "out" = Abgangs-Easing, sonst ein CSS-Easing; gilt bis zum nächsten Schlüsselbild.

  const installed = new Set();

  /**
   * Wandelt eine Zeitangabe in Sekunden um.
   * @param {number|string} value
   * @param {number[]} timing
   */
  function seconds(value, [entry, hold, exit]) {
    if (typeof value === "number") {
      return value;
    }
    // Phasenmarke plus beliebig viele Abstände, z. B. "X+0.3+0.25".
    const match = /^([HXE])((?:[+-]\d*\.?\d+)*)$/.exec(value);
    if (!match) {
      throw new Error(`Unbekannte Zeitangabe „${value}“`);
    }
    const base = { H: entry, X: entry + hold, E: entry + hold + exit }[
      match[1]
    ];
    const offsets = match[2].match(/[+-]\d*\.?\d+/g) ?? [];
    return offsets.reduce((sum, offset) => sum + Number(offset), base);
  }

  /** @param {string} value */
  function easing(value) {
    return (
      { in: "var(--pg-ease-in)", out: "var(--pg-ease-out)" }[value] ?? value
    );
  }

  /**
   * Erzeugt das CSS eines Motivs und hängt es einmal an den <head>.
   * @param {string} name
   * @param {{timing?: number[], motion: Object}} pictogram
   */
  function installMotion(name, pictogram) {
    if (installed.has(name)) {
      return;
    }
    installed.add(name);
    const timing = pictogram.timing ?? [0.6, 1.8, 0.6];
    const total = timing[0] + timing[1] + timing[2];
    const rules = [];
    Object.entries(pictogram.motion).forEach(([selector, part], index) => {
      const scope = `[data-pictogram="${name}"] ${selector}`;
      // Drehpunkt auch für Teile, die keine <g> sind (Pfade, Kreise).
      const statics = [
        "transform-box: view-box",
        "transform-origin: var(--o, 0 0)",
      ];
      if (part.hold) {
        statics.push(`--hold: ${part.hold}`, "transform: var(--hold)");
      }
      if (part.opacity !== undefined) {
        statics.push(`opacity: ${part.opacity}`);
      }
      if (part.dash !== undefined) {
        statics.push(`stroke-dasharray: 1; stroke-dashoffset: ${part.dash}`);
      }
      rules.push(`${scope} { ${statics.join("; ")}; }`);
      if (!part.frames) {
        return;
      }
      const keyframes = `pg-${name}-${index}`;
      rules.push(
        `.is-playing[data-pictogram="${name}"] ${selector} { animation: ${keyframes} var(--pg-total) ease var(--pg-delay, 0s) var(--pg-iter) both; animation-play-state: var(--pg-state, running); }`,
      );
      const steps = part.frames.map(([time, values]) => {
        const at = Math.min(
          100,
          Math.max(0, (seconds(time, timing) / total) * 100),
        );
        const declarations = [];
        if (values.t !== undefined) {
          declarations.push(
            `transform: ${values.t === "hold" ? "var(--hold, none)" : values.t}`,
          );
        }
        if (values.o !== undefined) {
          declarations.push(`opacity: ${values.o}`);
        }
        if (values.d !== undefined) {
          declarations.push(`stroke-dashoffset: ${values.d}`);
        }
        if (values.e !== undefined) {
          declarations.push(`animation-timing-function: ${easing(values.e)}`);
        }
        return `${at.toFixed(2)}% { ${declarations.join("; ")}; }`;
      });
      rules.push(`@keyframes ${keyframes} { ${steps.join(" ")} }`);
    });
    const style = document.createElement("style");
    style.dataset.pictogramMotion = name;
    // Gleiche Kaskadenebene wie css/components/pictogram.css.
    rules.push(
      `@media (prefers-reduced-motion: reduce) { .is-playing[data-pictogram="${name}"] * { animation: none; } }`,
    );
    style.textContent = `@layer components { ${rules.join("\n")} }`;
    document.head.append(style);
  }

  /**
   * Neues Motiv anmelden (von js/ui/pictograms-safety.js genutzt).
   * @param {string} name
   * @param {{label: string, description: string, svg: () => string, timing?: number[], motion?: Object}} definition
   */
  function registerPictogram(name, definition) {
    PICTOGRAMS[name] = definition;
  }

  EM.define("js/ui/pictograms.js", {
    PICTOGRAMS,
    createPictogram,
    registerPictogram,
    figure,
    capsule,
    origin,
    floor,
    warning,
    JOINTS,
  });
})();
