/*
 * pictograms-safety.js – animierte Unfall-Piktogramme der Sicherheitsunterweisung
 *
 * Jedes Motiv zeigt einen Fehler und seine Folge in drei Phasen (siehe js/ui/pictograms.js):
 *   1. Auftritt  Die Handlung beginnt (es wird gebohrt, geschliffen, angefasst …).
 *   2. Pose      Der Unfall passiert – eingefroren, sofort lesbar. Auch die stehende Fassung bei
 *                „Bewegung reduzieren“.
 *   3. Abgang    Die Folge wird sichtbar (Verletzung, Brand, Vergiftung), dann blendet alles aus.
 * Verletzungen sind rot (--pg-danger), alles andere in der Figurfarbe (currentColor).
 *
 * Aufbau eines Motivs: svg() liefert die Szene (immer in scene() eingepackt, damit sie am Ende
 * ausblendet), motion beschreibt die Bewegung als Daten (Format: installMotion() in pictograms.js).
 * Gelenkwinkel der Posen sind mit einer kleinen Rückwärtsrechnung (Hand an Zielpunkt) bestimmt;
 * „rotate(-40deg)“ heißt: Glied um 40° nach vorn (nach rechts) gedreht.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neues Motiv: Eintrag unten mit registerPictogram(); Baukasten-Teile (drill, battery …) nutzen.
 *   – Im Kurs einsetzen: Baustein „:::piktogramm Titel motiv=<name>“.
 */

(function () {
  "use strict";

  const { registerPictogram, figure, capsule, origin, floor } = EM.require(
    "js/ui/pictograms.js",
  );

  /** Gemeinsamer Takt: Auftritt, Pose (Unfall), Abgang (Folge) in Sekunden. */
  const TIMING = [0.7, 1.8, 1.3];

  // ───────────────────────── Baukasten ─────────────────────────

  /** Ganze Szene: blendet am Anfang ein und am Ende aus. */
  function scene(markup) {
    return `<g class="pg-scene">${markup}</g>`;
  }

  /** Ein-/Ausblenden der ganzen Szene (in jedes motion-Objekt eingemischt). */
  const SCENE_FADE = {
    ".pg-scene": {
      frames: [
        [0, { o: 0 }],
        [0.15, { o: 1 }],
        ["E-0.25", { o: 1 }],
        ["E", { o: 0 }],
      ],
    },
  };

  /** Rechteck mit Rand in Hintergrundfarbe (hebt sich von Teilen dahinter ab). */
  function block(x, y, width, height, radius = 3, className = "pg-fill") {
    return `<rect class="pg-gap-fill" x="${x - 3}" y="${y - 3}" width="${width + 6}" height="${height + 6}" rx="${radius + 2}"/>
      <rect class="${className}" x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}"/>`;
  }

  /** Dünne Linie (z. B. Bewegungsspuren, Funken). */
  function stroke(d, width = 4, className = "pg-line", extra = "") {
    return `<path class="${className}" d="${d}" stroke-width="${width}" stroke-linecap="round" fill="none" ${extra}/>`;
  }

  /** Ständerbohrmaschine, Bohrer bei x = 148. */
  function drill() {
    return `<g class="pg-drill">
      ${block(168, 60, 10, 112, 2)}
      ${block(112, 170, 72, 6, 2)}
      ${block(116, 120, 52, 6, 2)}
      ${block(118, 38, 62, 26, 6)}
      <g class="pg-chuck" style="${origin([148, 76])}">
        ${block(141, 64, 14, 18, 3)}
        ${stroke("M148 84 V106", 5)}
      </g>
      <g class="pg-spin">${stroke("M132 72 A16 6 0 0 0 164 72", 3, "pg-line", 'stroke-dasharray="4 5"')}</g>
    </g>`;
  }

  /** Bandschleifer: Schleifband als Schlaufe, Auflage links. */
  function sander() {
    return `<g class="pg-sander">
      ${block(150, 60, 30, 112, 4)}
      <rect class="pg-line" x="128" y="58" width="18" height="108" rx="9" fill="none" stroke-width="6"/>
      ${block(104, 116, 26, 6, 2)}
      ${block(112, 170, 72, 6, 2)}
      <g class="pg-belt-arrow">${stroke("M120 74 V96", 3)}${stroke("M115 90 L120 97 L125 90", 3)}</g>
    </g>`;
  }

  /** Akku mit zwei Polen (links +, rechts −). */
  function battery(x, y, width, height, className = "pg-battery") {
    return `<g class="${className}" style="${origin([x + width / 2, y + height])}">
      ${block(x, y, width, height, 5)}
      ${block(x + 6, y - 8, 10, 8, 1)}
      ${block(x + width - 16, y - 8, 10, 8, 1)}
      <rect class="pg-gap-fill" x="${x + width / 2 - 8}" y="${y + height / 2 - 2}" width="16" height="4"/>
    </g>`;
  }

  /** Winkelschleifer (in den Händen der Figur, Scheibe bei x = 150). */
  function grinder(withDisc = true) {
    return `<g class="pg-grinder" style="${origin([128, 100])}">
      ${stroke("M100 100 H142", 13, "pg-gap")}${stroke("M100 100 H142", 9)}
      ${withDisc ? `<g class="pg-disc" style="${origin([150, 106])}"><circle class="pg-gap-fill" cx="150" cy="106" r="17"/><circle class="pg-fill" cx="150" cy="106" r="14"/><circle class="pg-gap-fill" cx="150" cy="106" r="3"/></g>` : ""}
    </g>`;
  }

  /** Rote Aufprall-Zacke (Verletzung). */
  function burst(x, y, size = 1, className = "pg-burst") {
    const points = [];
    for (let i = 0; i < 16; i += 1) {
      const angle = (Math.PI * 2 * i) / 16;
      const radius = (i % 2 === 0 ? 13 : 6) * size;
      points.push(
        `${(x + radius * Math.cos(angle)).toFixed(1)},${(y + radius * Math.sin(angle)).toFixed(1)}`,
      );
    }
    return `<g class="${className}" style="${origin([x, y])}"><polygon class="pg-danger" points="${points.join(" ")}"/></g>`;
  }

  /** Totenkopf (Lebensgefahr). */
  function skull(x, y, size = 1, className = "pg-skull") {
    return `<g class="${className}" style="${origin([x, y])}"><g transform="translate(${x} ${y}) scale(${size})">
      <rect class="pg-danger" x="-30" y="14" width="60" height="9" rx="4.5" transform="rotate(25)"/>
      <rect class="pg-danger" x="-30" y="14" width="60" height="9" rx="4.5" transform="rotate(-25)"/>
      <path class="pg-danger" d="M-20 -4 C-20 -30 20 -30 20 -4 C20 8 14 12 12 16 V22 H-12 V16 C-14 12 -20 8 -20 -4 Z"/>
      <circle class="pg-gap-fill" cx="-8" cy="-3" r="5.5"/><circle class="pg-gap-fill" cx="8" cy="-3" r="5.5"/>
    </g></g>`;
  }

  /** Flamme (Brand). */
  function flame(x, y, size = 1, className = "pg-flame") {
    return `<g class="${className}" style="${origin([x, y])}"><g transform="translate(${x} ${y}) scale(${size})">
      <path class="pg-danger" d="M0 -34 C14 -18 24 -6 20 10 C17 22 -17 22 -20 10 C-24 -6 -10 -12 -6 -26 C-1 -14 5 -15 0 -34 Z"/>
      <path class="pg-fill" d="M1 -10 C9 0 12 6 10 14 C8 20 -8 20 -10 14 C-12 6 -4 2 1 -10 Z"/>
    </g></g>`;
  }

  /** Wolke (Rauch, Staub, giftige Gase). */
  function cloud(x, y, size = 1, className = "pg-cloud", fill = "pg-fill") {
    return `<g class="${className}" style="${origin([x, y])}"><g transform="translate(${x} ${y}) scale(${size})">
      <circle class="${fill}" cx="-14" cy="4" r="11"/><circle class="${fill}" cx="0" cy="-5" r="14"/><circle class="${fill}" cx="15" cy="3" r="11"/>
      <rect class="${fill}" x="-25" y="3" width="50" height="12" rx="6"/>
    </g></g>`;
  }

  /** Punkte (Staub, Ausschlag). */
  function dots(points, radius, className = "pg-fill") {
    return points
      .map(
        ([x, y]) =>
          `<circle class="${className}" cx="${x}" cy="${y}" r="${radius}"/>`,
      )
      .join("");
  }

  /** Gehschritt der Beine während des Auftritts, danach Pose. */
  function walkLegs(until = "H") {
    return {
      ".pg-leg--front": {
        frames: [
          [0, { t: "rotate(28deg)" }],
          [0.2, { t: "rotate(-28deg)" }],
          [0.4, { t: "rotate(20deg)", e: "in" }],
          [until, { t: "hold" }],
        ],
      },
      ".pg-leg--back": {
        frames: [
          [0, { t: "rotate(-28deg)" }],
          [0.2, { t: "rotate(28deg)" }],
          [0.4, { t: "rotate(-20deg)", e: "in" }],
          [until, { t: "hold" }],
        ],
      },
    };
  }

  /** Figur kommt von links (dx Pixel) herein und steht in der Pose an hold. */
  function enter(hold, dx = 60) {
    return {
      ".pg-figure": {
        hold,
        frames: [
          [0, { t: `${hold} translateX(-${dx}px)`, e: "in" }],
          [0.5, { t: "hold" }],
        ],
      },
    };
  }

  /** Teil, das erst im Abgang erscheint (aufpoppen). */
  function appearAt(time, popScale = 1.25) {
    return {
      opacity: 0,
      frames: [
        [0, { o: 0, t: "scale(0)" }],
        [time, { o: 0, t: "scale(0)", e: "in" }],
        [`${time}+0.25`, { o: 1, t: `scale(${popScale})` }],
        [`${time}+0.4`, { o: 1, t: "scale(1)" }],
        ["E", { o: 1, t: "scale(1)" }],
      ],
    };
  }

  /** Zeit als Phasenmarke mit Abstand: at("X", 0.3) → "X+0.3". */
  function at(mark, offset) {
    return `${mark}${offset >= 0 ? "+" : ""}${offset}`;
  }

  /** Teil, das ab der Pose zu sehen ist (Unfall). */
  function visibleFromHold(lead = 0.15) {
    return {
      frames: [
        [0, { o: 0, t: "scale(0)" }],
        [at("H", -lead), { o: 0, t: "scale(0)", e: "in" }],
        ["H", { o: 1, t: "scale(1.2)" }],
        [at("H", 0.2), { o: 1, t: "scale(1)" }],
      ],
    };
  }

  /** Mehrere motion-Objekte zusammenführen (spätere gewinnen). */
  function motion(...parts) {
    return Object.assign({}, SCENE_FADE, ...parts);
  }

  /** Motiv anmelden (immer mit gemeinsamem Takt). */
  function define(name, label, description, svg, moves, timing = TIMING) {
    registerPictogram(name, {
      label,
      description,
      timing,
      svg: () => scene(svg()),
      motion: moves,
    });
  }

  // ───────────────────────── Motive ─────────────────────────

  // 1. Handschuh an der Bohrmaschine
  define(
    "handschuh-bohrer",
    "Handschuh an der Bohrmaschine: Finger samt Sehne ausgerissen",
    "Die Figur bohrt mit Handschuhen. Der Bohrer wickelt den Handschuh auf und reißt einen Finger samt Sehne aus.",
    () =>
      `${
        floor() +
        drill() +
        figure({
          handFront: `<g class="pg-glove">${block(93, 110, 14, 14, 5)}</g>`,
        })
      }<g class="pg-wrap">${stroke("M138 70 Q148 62 158 70 M138 78 Q148 70 158 78 M138 86 Q148 78 158 86", 4)}</g>${burst(
        146,
        96,
        1,
      )}<g class="pg-finger" style="${origin([146, 94])}">${capsule([146, 94], [146, 78], "pg-limb")}${stroke("M146 96 Q138 104 150 110", 3, "pg-danger-line", 'pathLength="1"')}</g>` +
      `<g class="pg-drops" style="${origin([128, 138])}">${dots(
        [
          [128, 130],
          [136, 140],
          [122, 146],
        ],
        3,
        "pg-danger",
      )}</g>`,
    motion(walkLegs(), enter("translateX(-12px)"), {
      ".pg-body": {
        hold: "rotate(25deg)",
        frames: [
          [0, { t: "rotate(5deg)" }],
          [0.5, { t: "rotate(15deg)", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.3), { t: "rotate(-8deg)" }],
          ["E", { t: "rotate(-8deg)" }],
        ],
      },
      ".pg-arm--front": {
        hold: "rotate(-83deg)",
        frames: [
          [0, { t: "rotate(0deg)" }],
          [0.45, { t: "rotate(-55deg)", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.3), { t: "rotate(-20deg)" }],
          ["E", { t: "rotate(-20deg)" }],
        ],
      },
      ".pg-forearm--front": {
        hold: "rotate(-10deg)",
        frames: [
          [0, { t: "rotate(0deg)" }],
          [0.45, { t: "rotate(-30deg)", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.3), { t: "rotate(-100deg)" }],
          ["E", { t: "rotate(-100deg)" }],
        ],
      },
      ".pg-wrap": visibleFromHold(),
      ".pg-burst": visibleFromHold(0.1),
      ".pg-finger": {
        opacity: 0,
        dash: 1,
        frames: [
          [0, { o: 0 }],
          ["X", { o: 0, t: "none", d: 1 }],
          [at("X", 0.1), { o: 1, e: "out" }],
          [
            at("X", 0.6),
            { o: 1, t: "translate(-6px, 20px) rotate(95deg)", d: 0 },
          ],
          ["E", { o: 1, t: "translate(-6px, 20px) rotate(90deg)", d: 0 }],
        ],
      },
      ".pg-drops": appearAt("X+0.3"),
    }),
  );

  // 2. Schal an der Maschine
  define(
    "schal-maschine",
    "Schal an der Maschine: Strangulation, Lebensgefahr",
    "Der Schal der Figur gerät an die Spindel, wird aufgewickelt und zieht sie am Hals zur Maschine.",
    () =>
      `${
        floor() +
        drill() +
        figure({
          head: `<g class="pg-scarf-hang">${capsule([96, 60], [112, 92], "pg-scarf")}</g>`,
        })
      }<g class="pg-scarf-line">${stroke("M118 70 Q132 64 146 74", 10, "pg-gap")}${stroke("M118 70 Q132 64 146 74", 7, "pg-line", 'pathLength="1"')}</g>` +
      `<g class="pg-wrap">${stroke("M138 70 Q148 62 158 70 M138 78 Q148 70 158 78", 4)}</g>` +
      `<g class="pg-neck-mark" style="${origin([116, 72])}">${stroke("M108 64 L124 78 M112 60 L128 74", 4, "pg-danger-line")}</g>${skull(
        52,
        46,
        0.9,
      )}`,
    motion(walkLegs(), enter("translateX(-8px)"), {
      ".pg-body": {
        hold: "rotate(35deg)",
        frames: [
          [0, { t: "rotate(0deg)" }],
          [0.55, { t: "rotate(8deg)", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.5), { t: "rotate(70deg)" }],
          ["E", { t: "rotate(70deg)" }],
        ],
      },
      ".pg-head": {
        hold: "rotate(20deg)",
        frames: [
          [0, { t: "none" }],
          [0.55, { t: "none", e: "in" }],
          ["H", { t: "hold" }],
        ],
      },
      ".pg-arm--front": {
        hold: "rotate(-150deg)",
        frames: [
          [0, { t: "none" }],
          [0.55, { t: "none", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.5), { t: "rotate(-20deg)" }],
        ],
      },
      ".pg-forearm--front": {
        hold: "rotate(110deg)",
        frames: [
          [0, { t: "none" }],
          [0.55, { t: "none", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.5), { t: "none" }],
        ],
      },
      ".pg-arm--back": {
        hold: "rotate(-140deg)",
        frames: [
          [0, { t: "none" }],
          [0.55, { t: "none", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.5), { t: "rotate(10deg)" }],
        ],
      },
      ".pg-forearm--back": {
        hold: "rotate(100deg)",
        frames: [
          [0, { t: "none" }],
          [0.55, { t: "none", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.5), { t: "none" }],
        ],
      },
      ".pg-leg--front": {
        hold: "rotate(-15deg)",
        frames: [
          [0, { t: "rotate(28deg)" }],
          [0.2, { t: "rotate(-28deg)" }],
          [0.4, { t: "rotate(20deg)", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.5), { t: "rotate(-60deg)" }],
        ],
      },
      ".pg-shin--front": {
        frames: [
          ["X", { t: "none" }],
          [at("X", 0.5), { t: "rotate(90deg)" }],
          ["E", { t: "rotate(90deg)" }],
        ],
      },
      ".pg-scarf-hang": {
        opacity: 0,
        frames: [
          [0, { o: 1 }],
          [at("H", -0.15), { o: 1 }],
          [at("H", -0.1), { o: 0 }],
        ],
      },
      ".pg-scarf-line": {
        frames: [
          [0, { o: 0 }],
          [at("H", -0.15), { o: 0 }],
          [at("H", -0.1), { o: 1 }],
          ["X", { o: 1 }],
          [at("X", 0.3), { o: 0 }],
          ["E", { o: 0 }],
        ],
      },
      ".pg-scarf-line .pg-line": {
        dash: 0,
        frames: [
          [0, { d: 1 }],
          [at("H", -0.15), { d: 1, e: "in" }],
          ["H", { d: 0 }],
        ],
      },
      ".pg-wrap": visibleFromHold(),
      ".pg-neck-mark": visibleFromHold(0.05),
      ".pg-skull": appearAt("X+0.4"),
    }),
  );

  // 3. Lange Haare
  define(
    "haare-maschine",
    "Offene Haare an der Maschine: Kopfhaut abgerissen",
    "Die offenen Haare der Figur geraten an die Spindel und werden aufgewickelt, die Kopfhaut wird abgerissen.",
    () =>
      `${
        floor() +
        drill() +
        figure({
          head: `<g class="pg-hair">${capsule([90, 36], [80, 60], "pg-hairtail")}</g>
          <g class="pg-scalp" style="${origin([100, 43])}"><path class="pg-danger" d="M86 40 A14 14 0 0 1 114 40 Q100 34 86 40 Z"/><path class="pg-danger" d="M86 40 A14 14 0 0 1 114 40 L112 44 Q100 37 88 44 Z"/></g>`,
        })
      }<g class="pg-hair-line">${stroke("M120 54 Q134 56 146 72", 6, "pg-line", 'pathLength="1"')}</g>` +
      `<g class="pg-wrap">${stroke("M138 70 Q148 62 158 70 M138 78 Q148 70 158 78", 4)}</g>`,
    motion(walkLegs(), enter("translateX(-4px)"), {
      ".pg-body": {
        hold: "rotate(38deg)",
        frames: [
          [0, { t: "none" }],
          [0.55, { t: "rotate(15deg)", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.4), { t: "rotate(-25deg)" }],
          ["E", { t: "rotate(-25deg)" }],
        ],
      },
      ".pg-head": {
        hold: "rotate(30deg)",
        frames: [
          [0, { t: "none" }],
          [0.55, { t: "none", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.4), { t: "rotate(-10deg)" }],
        ],
      },
      ".pg-arm--front": {
        hold: "rotate(-120deg)",
        frames: [
          [0, { t: "none" }],
          [0.5, { t: "rotate(-40deg)", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.4), { t: "rotate(-160deg)" }],
        ],
      },
      ".pg-forearm--front": {
        hold: "rotate(-30deg)",
        frames: [
          [0, { t: "none" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.4), { t: "rotate(120deg)" }],
        ],
      },
      ".pg-arm--back": { hold: "rotate(40deg)" },
      ".pg-hair": {
        frames: [
          [0, { o: 1 }],
          [at("H", -0.1), { o: 1 }],
          ["H", { o: 0 }],
        ],
        opacity: 0,
      },
      ".pg-hair-line": {
        frames: [
          [0, { o: 0 }],
          [at("H", -0.1), { o: 0 }],
          ["H", { o: 1 }],
        ],
      },
      ".pg-hair-line .pg-line": {
        dash: 0,
        frames: [
          [0, { d: 1 }],
          [at("H", -0.1), { d: 1, e: "in" }],
          [at("H", 0.1), { d: 0 }],
        ],
      },
      ".pg-wrap": visibleFromHold(),
      ".pg-scalp": appearAt("X+0.2", 1.1),
    }),
  );

  // 4. Hochvolt: Strom durch den Körper
  define(
    "hv-koerper",
    "Hochvolt-Kabel angefasst: Herzkammerflimmern",
    "Die Figur fasst ein Hochvolt-Kabel an. Der Strom fließt durch den Körper, das Herz gerät aus dem Takt.",
    () =>
      `${floor()}<g class="pg-hv">${block(148, 92, 38, 84, 4)}
        <path class="pg-gap-fill" d="M170 104 L160 124 H168 L162 142 L176 118 H168 L174 104 Z"/>
        ${stroke("M148 112 Q140 112 136 100", 12, "pg-gap")}${stroke("M148 112 Q140 112 136 100", 8)}</g>${figure()}<g class="pg-shock">${stroke("M134 98 L116 92 L104 104 L98 100 L94 128 L100 140 L94 168", 5, "pg-danger-line", 'pathLength="1" stroke-linejoin="round"')}</g>${burst(
          134,
          98,
          0.9,
        )}<g class="pg-heart" style="${origin([46, 52])}">
        <path class="pg-danger" d="M46 74 C14 52 20 26 36 26 C42 26 45 30 46 34 C47 30 50 26 56 26 C72 26 78 52 46 74 Z"/>
        ${stroke("M18 52 H30 L34 42 L38 62 L42 38 L46 64 L50 40 L54 58 L58 48 H74", 3.5, "pg-gap pg-heart-line", 'pathLength="1" stroke-linejoin="round"')}
      </g>`,
    motion(walkLegs(), enter("translateX(-10px)"), {
      ".pg-body": {
        hold: "rotate(5deg)",
        frames: [
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.5), { t: "rotate(-55deg)" }],
          ["E", { t: "rotate(-55deg)" }],
        ],
      },
      ".pg-leg--front": {
        frames: [
          ["X", { t: "none", e: "out" }],
          [at("X", 0.5), { t: "rotate(-78deg)" }],
          ["E", { t: "rotate(-78deg)" }],
        ],
      },
      ".pg-leg--back": {
        frames: [
          ["X", { t: "none", e: "out" }],
          [at("X", 0.5), { t: "rotate(-60deg)" }],
          ["E", { t: "rotate(-60deg)" }],
        ],
      },
      ".pg-shin--front": {
        frames: [
          ["X", { t: "none", e: "out" }],
          [at("X", 0.5), { t: "rotate(60deg)" }],
          ["E", { t: "rotate(60deg)" }],
        ],
      },
      ".pg-arm--front": {
        hold: "rotate(-57deg)",
        frames: [
          [0, { t: "none" }],
          [0.4, { t: "rotate(-20deg)", e: "in" }],
          ["H", { t: "hold" }],
        ],
      },
      ".pg-forearm--front": { hold: "rotate(-10deg)" },
      ".pg-arm--back": {
        hold: "rotate(45deg)",
        frames: [
          [0, { t: "none" }],
          [at("H", -0.1), { t: "none", e: "in" }],
          ["H", { t: "hold" }],
        ],
      },
      ".pg-head": { hold: "rotate(-12deg)" },
      ".pg-figure": {
        hold: "translateX(-10px)",
        frames: [
          [0, { t: "translateX(-70px)", e: "in" }],
          [0.5, { t: "hold" }],
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.5), { t: "translate(-14px, 27px)" }],
          ["E", { t: "translate(-14px, 27px)" }],
        ],
      },
      ".pg-shock": {
        frames: [
          [0, { o: 0 }],
          [at("H", -0.1), { o: 0 }],
          ["H", { o: 1 }],
          ["X", { o: 1 }],
          [at("X", 0.3), { o: 0 }],
          ["E", { o: 0 }],
        ],
      },
      ".pg-shock .pg-danger-line": {
        dash: 0,
        frames: [
          [0, { d: 1 }],
          [at("H", -0.1), { d: 1 }],
          [at("H", 0.15), { d: 0 }],
        ],
      },
      ".pg-burst": visibleFromHold(0.1),
      ".pg-heart": appearAt("X+0.2"),
      ".pg-heart-line": {
        dash: 0,
        frames: [
          [0, { d: 1 }],
          [at("X", 0.4), { d: 1 }],
          [at("X", 0.9), { d: 0 }],
        ],
      },
    }),
  );

  // 5. Lichtbogen
  define(
    "hv-lichtbogen",
    "Werkzeug über Hochvolt-Polen: Lichtbogen, schwere Verbrennungen",
    "Ein Schraubenschlüssel berührt zwei Hochvolt-Pole. Ein Lichtbogen blitzt auf und verbrennt Hände und Gesicht.",
    () =>
      `${
        floor() +
        battery(122, 140, 56, 36) +
        figure({
          handFront: `<g class="pg-burn-hand">${dots(
            [
              [102, 118],
              [97, 112],
            ],
            3.5,
            "pg-danger",
          )}</g>`,
          head: `<g class="pg-burn-face">${dots(
            [
              [106, 40],
              [110, 48],
              [102, 50],
            ],
            3,
            "pg-danger",
          )}</g>`,
        })
      }<g class="pg-wrench" style="${origin([150, 128])}">${stroke("M128 128 H172", 11, "pg-gap")}${stroke("M128 128 H172", 7)}</g>` +
      `<g class="pg-arc" style="${origin([168, 130])}">
        ${burst(168, 130, 1.4, "pg-arc-core")}
        ${stroke("M168 104 V96 M188 112 L194 106 M190 130 H198 M148 112 L142 106", 4, "pg-danger-line")}
      </g>`,
    motion(walkLegs(), enter("translateX(-5px)"), {
      ".pg-body": {
        hold: "rotate(45deg)",
        frames: [
          [0, { t: "none" }],
          [0.5, { t: "rotate(30deg)", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.35), { t: "rotate(-15deg)" }],
          ["E", { t: "rotate(-15deg)" }],
        ],
      },
      ".pg-arm--front": {
        hold: "rotate(-52deg)",
        frames: [
          [0, { t: "none" }],
          [0.5, { t: "rotate(-30deg)", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.35), { t: "rotate(-150deg)" }],
        ],
      },
      ".pg-forearm--front": {
        hold: "rotate(-26deg)",
        frames: [
          ["X", { t: "hold" }],
          [at("X", 0.35), { t: "rotate(110deg)" }],
        ],
      },
      ".pg-arm--back": {
        frames: [
          ["X", { t: "none" }],
          [at("X", 0.35), { t: "rotate(-140deg)" }],
        ],
      },
      ".pg-forearm--back": {
        frames: [
          ["X", { t: "none" }],
          [at("X", 0.35), { t: "rotate(100deg)" }],
        ],
      },
      ".pg-wrench": {
        frames: [
          [0, { t: "translate(-30px, -40px) rotate(-30deg)", e: "in" }],
          [at("H", -0.05), { t: "none" }],
          ["X", { t: "none", e: "out" }],
          [at("X", 0.3), { t: "translate(10px, 10px) rotate(15deg)" }],
        ],
      },
      ".pg-arc": {
        frames: [
          [0, { o: 0, t: "scale(0)" }],
          [at("H", -0.05), { o: 0, t: "scale(0)" }],
          ["H", { o: 1, t: "scale(1.2)" }],
          [at("H", 0.15), { o: 1, t: "scale(0.9)" }],
          [at("H", 0.3), { o: 1, t: "scale(1.1)" }],
          ["X", { o: 1, t: "scale(1)" }],
          [at("X", 0.3), { o: 1, t: "scale(2.2)" }],
          [at("X", 0.6), { o: 0, t: "scale(2.6)" }],
        ],
      },
      ".pg-burn-hand": appearAt("X+0.3"),
      ".pg-burn-face": appearAt("X+0.35"),
    }),
  );

  // 6. Ring am Akku
  define(
    "lv-ring",
    "Ring am Akku: Verbrennung bis auf den Knochen",
    "Ein Ring an der Hand berührt beide Akkupole. Er wird glühend heiß und verbrennt den Finger.",
    () =>
      `${
        floor() +
        battery(128, 132, 54, 44) +
        figure({
          handFront: `<g class="pg-ring"><circle class="pg-gap-fill" cx="100" cy="114" r="7"/><circle class="pg-ring-fill" cx="100" cy="114" r="5"/></g>
          <g class="pg-burn-finger">${dots(
            [
              [100, 118],
              [104, 112],
              [96, 110],
            ],
            4,
            "pg-danger",
          )}</g>`,
        })
      }<g class="pg-heat" style="${origin([152, 112])}">${stroke("M140 108 C134 98 146 94 140 82 M152 106 C146 96 158 92 152 80 M164 108 C158 98 170 94 164 82", 3.5, "pg-danger-line")}</g>`,
    motion(walkLegs(), enter("translateX(0px)"), {
      ".pg-body": {
        hold: "rotate(45deg)",
        frames: [
          [0, { t: "none" }],
          [0.5, { t: "rotate(30deg)", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.3), { t: "rotate(5deg)" }],
          ["E", { t: "rotate(5deg)" }],
        ],
      },
      ".pg-arm--front": {
        hold: "rotate(-60deg)",
        frames: [
          [0, { t: "none" }],
          [0.5, { t: "rotate(-40deg)", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.3), { t: "rotate(-20deg)" }],
        ],
      },
      ".pg-forearm--front": {
        hold: "rotate(-24deg)",
        frames: [
          ["X", { t: "hold" }],
          [at("X", 0.3), { t: "rotate(-110deg)" }],
        ],
      },
      ".pg-heat": visibleFromHold(0.05),
      ".pg-burn-finger": appearAt("X+0.3"),
    }),
  );

  // 7. Aufgeblähter Akku
  define(
    "akku-brand",
    "Beschädigter Akku: Brand und giftige Gase",
    "Ein aufgeblähter Lithium-Akku wird geladen. Er gerät in Brand und setzt giftige Gase frei.",
    () =>
      `${floor()}<g class="pg-plug">${stroke("M40 150 Q60 150 72 160 T128 160", 4)}</g>${battery(
        126,
        136,
        52,
        40,
        "pg-battery pg-swell",
      )}${flame(152, 128, 0.8, "pg-flame-small")}${flame(
        152,
        124,
        1.6,
        "pg-flame-big",
      )}${cloud(118, 70, 1.1, "pg-cloud pg-gas")}${skull(
        118,
        64,
        0.55,
        "pg-gas-skull",
      )}${figure()}`,
    motion(walkLegs(), enter("translateX(-38px)", 40), {
      ".pg-swell": {
        hold: "scale(1.12, 1.3)",
        frames: [
          [0, { t: "none" }],
          [0.3, { t: "none", e: "in" }],
          ["H", { t: "hold" }],
        ],
      },
      ".pg-flame-small": visibleFromHold(0.1),
      ".pg-flame-big": appearAt("X+0.1", 1.15),
      ".pg-gas": appearAt("X+0.35", 1.1),
      ".pg-gas-skull": appearAt("X+0.5"),
      ".pg-figure": {
        hold: "translateX(-38px)",
        frames: [
          [0, { t: "translateX(-78px)", e: "in" }],
          [0.5, { t: "hold" }],
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.6), { t: "translateX(-140px)" }],
        ],
      },
      ".pg-arm--front": {
        hold: "rotate(-150deg)",
        frames: [
          [0, { t: "none" }],
          [at("H", -0.15), { t: "none", e: "in" }],
          ["H", { t: "hold" }],
        ],
      },
      ".pg-forearm--front": { hold: "rotate(60deg)" },
      ".pg-arm--back": {
        hold: "rotate(-130deg)",
        frames: [
          [0, { t: "none" }],
          [at("H", -0.15), { t: "none", e: "in" }],
          ["H", { t: "hold" }],
        ],
      },
      ".pg-forearm--back": { hold: "rotate(70deg)" },
      ".pg-body": { hold: "rotate(-12deg)" },
    }),
  );

  // 8. Werkstück mit der Hand gehalten
  define(
    "bohr-werkstueck",
    "Werkstück mit der Hand gehalten: tiefe Schnitte",
    "Ein kleines Blech wird beim Bohren mit der Hand gehalten. Es reißt mit, dreht wie ein Propeller und schneidet die Hand.",
    () =>
      `${
        floor() + drill()
      }<g class="pg-plate" style="${origin([148, 116])}">${block(126, 113, 44, 5, 2)}</g>` +
      `<g class="pg-plate-spin">${stroke("M118 108 A30 10 0 0 0 178 112", 3, "pg-line", 'stroke-dasharray="5 5"')}</g>${figure(
        {
          handFront: `<g class="pg-cuts">${stroke("M93 108 L107 116 M93 116 L106 124", 3.5, "pg-danger-line")}</g>`,
        },
      )}${burst(132, 112, 0.8)}`,
    motion(walkLegs(), enter("translateX(-8px)"), {
      ".pg-body": {
        hold: "rotate(30deg)",
        frames: [
          [0, { t: "none" }],
          [0.5, { t: "rotate(20deg)", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.35), { t: "rotate(-5deg)" }],
        ],
      },
      ".pg-arm--front": {
        hold: "rotate(-40deg)",
        frames: [
          [0, { t: "none" }],
          [0.5, { t: "rotate(-30deg)", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.35), { t: "rotate(-30deg)" }],
        ],
      },
      ".pg-forearm--front": {
        hold: "rotate(-37deg)",
        frames: [
          ["X", { t: "hold" }],
          [at("X", 0.35), { t: "rotate(-110deg)" }],
        ],
      },
      ".pg-chuck": {
        frames: [
          [0, { t: "translateY(-12px)", e: "in" }],
          [at("H", -0.1), { t: "none" }],
        ],
      },
      ".pg-plate": {
        hold: "rotate(-30deg)",
        frames: [
          [0, { t: "none" }],
          [at("H", -0.15), { t: "none", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.4), { t: "rotate(-200deg)" }],
          ["E", { t: "rotate(-380deg)" }],
        ],
      },
      ".pg-plate-spin": visibleFromHold(),
      ".pg-burst": visibleFromHold(0.05),
      ".pg-cuts": appearAt("X+0.25"),
    }),
  );

  // 9. Lange Stange
  define(
    "bohr-stange",
    "Lange Stange nicht gesichert: Bauch aufgeschlitzt",
    "Eine lange Stange reißt sich beim Bohren los und schlägt in Bauchhöhe im Kreis gegen die Figur.",
    () =>
      `${
        floor() + drill()
      }<g class="pg-bar" style="${origin([148, 116])}">${block(96, 113, 76, 6, 3)}</g>` +
      `<g class="pg-bar-spin">${stroke("M90 104 A58 16 0 0 0 190 112", 3, "pg-line", 'stroke-dasharray="5 5"')}</g>${figure(
        {},
      )}<g class="pg-belly" style="${origin([84, 96])}">${stroke("M72 92 L96 100", 6, "pg-danger-line")}${dots(
        [
          [78, 108],
          [86, 112],
          [82, 120],
        ],
        3,
        "pg-danger",
      )}</g>`,
    motion(walkLegs(), enter("translateX(-16px)"), {
      ".pg-bar": {
        hold: "rotate(14deg)",
        frames: [
          [0, { t: "none" }],
          [at("H", -0.2), { t: "none", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.5), { t: "rotate(200deg)" }],
          ["E", { t: "rotate(380deg)" }],
        ],
      },
      ".pg-bar-spin": visibleFromHold(),
      ".pg-arm--front": { hold: "rotate(-60deg)" },
      ".pg-forearm--front": { hold: "rotate(-60deg)" },
      ".pg-body": {
        hold: "rotate(-14deg)",
        frames: [
          [0, { t: "none" }],
          [at("H", -0.1), { t: "none", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.4), { t: "rotate(35deg)" }],
          ["E", { t: "rotate(35deg)" }],
        ],
      },
      ".pg-figure": {
        hold: "translateX(-16px)",
        frames: [
          [0, { t: "translateX(-76px)", e: "in" }],
          [0.5, { t: "hold" }],
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.4), { t: "translateX(-38px)" }],
          ["E", { t: "translateX(-38px)" }],
        ],
      },
      ".pg-belly": {
        frames: [
          [0, { o: 0, t: "scale(0)" }],
          [at("H", -0.05), { o: 0, t: "scale(0)", e: "in" }],
          ["H", { o: 1, t: "scale(1.2)" }],
          [at("H", 0.2), { o: 1, t: "scale(1)" }],
          ["X", { o: 1, t: "none", e: "out" }],
          [at("X", 0.4), { o: 1, t: "translate(-14px, 8px) scale(1.3)" }],
          ["E", { o: 1, t: "translate(-14px, 8px) scale(1.3)" }],
        ],
      },
    }),
  );

  // 10. Bohrfutterschlüssel
  define(
    "bohrfutterschluessel",
    "Bohrfutterschlüssel steckt: Geschoss ins Gesicht",
    "Der Bohrfutterschlüssel steckt noch. Beim Einschalten wird er weggeschleudert und trifft das Gesicht.",
    () =>
      `${
        floor() + drill() + figure()
      }<g class="pg-key" style="${origin([148, 74])}">${stroke("M140 74 H160 M150 74 V88", 6)}</g>` +
      `<g class="pg-key-trail">${stroke("M118 64 L134 70 M116 74 L130 76", 3, "pg-line", 'stroke-dasharray="4 4"')}</g>${burst(
        98,
        42,
        0.9,
      )}`,
    motion(walkLegs(), enter("translateX(-10px)"), {
      ".pg-arm--front": {
        hold: "rotate(-55deg)",
        frames: [
          [0, { t: "none" }],
          [0.5, { t: "rotate(-40deg)", e: "in" }],
          ["H", { t: "hold" }],
        ],
      },
      ".pg-forearm--front": { hold: "rotate(-25deg)" },
      ".pg-key": {
        hold: "translate(-34px, -30px) rotate(-160deg)",
        frames: [
          [0, { t: "none" }],
          [at("H", -0.1), { t: "none", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { o: 1, t: "hold", e: "out" }],
          [at("X", 0.2), { t: "translate(-36px, -30px) rotate(-260deg)" }],
          ["E", { t: "translate(-60px, 90px) rotate(-420deg)" }],
        ],
      },
      ".pg-key-trail": visibleFromHold(),
      ".pg-burst": appearAt("X+0.15"),
      ".pg-body": {
        frames: [
          ["X", { t: "none" }],
          [at("X", 0.4), { t: "rotate(-25deg)" }],
          ["E", { t: "rotate(-25deg)" }],
        ],
      },
      ".pg-head": {
        frames: [
          ["X", { t: "none" }],
          [at("X", 0.25), { t: "rotate(-25deg)" }],
        ],
      },
    }),
  );

  // 11. Bandschleifer
  define(
    "bandschleifer-spalt",
    "Finger am Schleifband: bis auf den Knochen abgeschliffen",
    "Die Fingerspitze gerät in den Spalt zwischen Band und Auflage und wird abgeschliffen.",
    () =>
      `${
        floor() +
        sander() +
        figure({
          handFront: `<g class="pg-raw-finger" style="${origin([100, 118])}">${dots([[100, 118]], 7, "pg-danger")}</g>`,
        })
      }<g class="pg-sparks">${stroke("M130 112 L122 126 M132 112 L132 130 M130 110 L118 118", 3, "pg-danger-line")}</g>`,
    motion(walkLegs(), enter("translateX(-8px)"), {
      ".pg-body": {
        hold: "rotate(20deg)",
        frames: [
          [0, { t: "none" }],
          [0.5, { t: "rotate(10deg)", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.3), { t: "rotate(-10deg)" }],
        ],
      },
      ".pg-arm--front": {
        hold: "rotate(-44deg)",
        frames: [
          [0, { t: "none" }],
          [0.5, { t: "rotate(-30deg)", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.3), { t: "rotate(-10deg)" }],
        ],
      },
      ".pg-forearm--front": {
        hold: "rotate(-28deg)",
        frames: [
          ["X", { t: "hold" }],
          [at("X", 0.3), { t: "rotate(-120deg)" }],
        ],
      },
      ".pg-belt-arrow": {
        frames: [
          [0, { t: "translateY(-10px)" }],
          [0.35, { t: "translateY(10px)" }],
          [0.7, { t: "translateY(-10px)" }],
          ["H", { t: "none" }],
        ],
      },
      ".pg-sparks": visibleFromHold(0.05),
      ".pg-raw-finger": appearAt("X+0.25"),
    }),
  );

  // 12. Zerplatzende Trennscheibe
  define(
    "flex-scheibe",
    "Flex ohne Schutzhaube: Splitter ins Gesicht",
    "Die Trennscheibe einer Flex ohne Schutzhaube zerplatzt. Die Bruchstücke fliegen ins Gesicht.",
    () =>
      `${
        floor() + figure() + grinder()
      }<g class="pg-sparks">${stroke("M152 122 L166 138 M148 124 L152 142 M156 120 L174 130", 3)}</g>` +
      `<g class="pg-shards">
        <g class="pg-shard1" style="${origin([154, 96])}"><polygon class="pg-fill" points="150,92 160,96 152,102"/></g>
        <g class="pg-shard2" style="${origin([142, 102])}"><polygon class="pg-fill" points="140,98 148,104 138,106"/></g>
        <g class="pg-shard3" style="${origin([160, 108])}"><polygon class="pg-fill" points="158,104 166,110 156,112"/></g>
      </g>${burst(
        108,
        50,
        1,
        "pg-burst pg-hit",
      )}<g class="pg-neck-cut">${stroke("M100 60 L116 66", 5, "pg-danger-line")}</g>`,
    motion(walkLegs(), enter("translateX(-12px)"), {
      ".pg-body": {
        hold: "rotate(15deg)",
        frames: [
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.4), { t: "rotate(-30deg)" }],
          ["E", { t: "rotate(-30deg)" }],
        ],
      },
      ".pg-arm--front": { hold: "rotate(-38deg)" },
      ".pg-forearm--front": { hold: "rotate(-50deg)" },
      ".pg-arm--back": { hold: "rotate(-30deg)" },
      ".pg-forearm--back": { hold: "rotate(-55deg)" },
      ".pg-grinder": {
        hold: "translateX(-12px)",
        frames: [
          [0, { t: "translateX(-72px)", o: 0, e: "in" }],
          [0.5, { t: "hold", o: 1 }],
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.4), { t: "translate(-20px, 60px) rotate(40deg)" }],
        ],
      },
      ".pg-disc": {
        frames: [
          [0, { o: 1 }],
          [at("H", -0.05), { o: 1 }],
          ["H", { o: 0 }],
        ],
        opacity: 0,
      },
      ".pg-sparks": {
        frames: [
          [0, { o: 0 }],
          [0.4, { o: 1 }],
          [at("H", -0.05), { o: 1 }],
          ["H", { o: 0 }],
        ],
        opacity: 0,
      },
      ".pg-shard1": {
        hold: "translate(-18px, -26px) rotate(90deg)",
        frames: [
          [0, { o: 0 }],
          [at("H", -0.05), { o: 0, t: "none" }],
          ["H", { o: 1, t: "hold" }],
          ["X", { o: 1, t: "hold", e: "out" }],
          [at("X", 0.2), { t: "translate(-44px, -46px) rotate(200deg)" }],
          [at("X", 0.3), { o: 0 }],
          ["E", { o: 0 }],
        ],
      },
      ".pg-shard2": {
        hold: "translate(-22px, -10px) rotate(-60deg)",
        frames: [
          [0, { o: 0 }],
          [at("H", -0.05), { o: 0, t: "none" }],
          ["H", { o: 1, t: "hold" }],
          ["X", { o: 1, t: "hold", e: "out" }],
          [at("X", 0.2), { t: "translate(-36px, -38px) rotate(-200deg)" }],
          [at("X", 0.3), { o: 0 }],
          ["E", { o: 0 }],
        ],
      },
      ".pg-shard3": {
        hold: "translate(-6px, -30px) rotate(120deg)",
        frames: [
          [0, { o: 0 }],
          [at("H", -0.05), { o: 0, t: "none" }],
          ["H", { o: 1, t: "hold" }],
          ["X", { o: 1, t: "hold", e: "out" }],
          [at("X", 0.2), { t: "translate(-50px, -44px) rotate(260deg)" }],
          [at("X", 0.3), { o: 0 }],
          ["E", { o: 0 }],
        ],
      },
      ".pg-hit": appearAt("X+0.2"),
      ".pg-neck-cut": appearAt("X+0.25"),
    }),
  );

  // 13. Funken in der Werkstatt
  define(
    "flex-funken",
    "Flexen in der Werkstatt: Werkstattbrand",
    "In der Werkstatt wird geflext. Funken fliegen auf Harzlappen, es entsteht ein Brand.",
    () =>
      `<g class="pg-house">${stroke("M12 176 V70 L100 20 L188 70 V176", 4)}</g>${floor()}<g class="pg-rags">${block(150, 164, 32, 12, 6)}</g>${figure()}${grinder()}<g class="pg-sparks">${stroke("M156 120 Q164 132 160 156 M152 122 Q158 140 150 158 M160 118 Q174 130 170 154", 3, "pg-line", 'stroke-dasharray="5 5"')}</g>${flame(
        166,
        166,
        0.5,
        "pg-flame-small",
      )}${flame(
        166,
        168,
        2.2,
        "pg-flame-big",
      )}${flame(48, 168, 1.4, "pg-flame-big2")}`,
    motion(walkLegs(), enter("translateX(-30px)"), {
      ".pg-body": { hold: "rotate(15deg)" },
      ".pg-arm--front": { hold: "rotate(-38deg)" },
      ".pg-forearm--front": { hold: "rotate(-50deg)" },
      ".pg-arm--back": { hold: "rotate(-30deg)" },
      ".pg-forearm--back": { hold: "rotate(-55deg)" },
      ".pg-grinder": {
        hold: "translateX(-30px)",
        frames: [
          [0, { t: "translateX(-90px)", e: "in" }],
          [0.5, { t: "hold" }],
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.6), { t: "translateX(-160px)" }],
        ],
      },
      ".pg-figure": {
        hold: "translateX(-30px)",
        frames: [
          [0, { t: "translateX(-90px)", e: "in" }],
          [0.5, { t: "hold" }],
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.6), { t: "translateX(-160px)" }],
        ],
      },
      ".pg-sparks": {
        frames: [
          [0, { o: 0 }],
          [0.4, { o: 1 }],
          ["X", { o: 1 }],
          [at("X", 0.1), { o: 0 }],
          ["E", { o: 0 }],
        ],
      },
      ".pg-flame-small": visibleFromHold(0.1),
      ".pg-flame-big": appearAt("X+0.2", 1.1),
      ".pg-flame-big2": appearAt("X+0.5", 1.1),
    }),
  );

  // 14. Carbonstaub in der Lunge – Frontansicht
  //
  // Eigene Figur von vorn (symmetrisch), damit die Lunge im Brustkorb sichtbar ist. Phase 1: Die
  // Figur schleift ein Carbonteil, Staub steigt zum Mund. Phase 2: Die Lunge im Brustkorb ist voller
  // schwarzer Faserpunkte. Phase 3: Die Figur verschwindet, die Lunge wird groß und steht allein im
  // Bild, an ihr wächst ein Tumor (Krebsverdacht).

  /** Lunge von vorn, Mittelpunkt (100, 88), mit Faserpunkten in mehreren Stufen. */
  function lungs() {
    /** Eine Stufe der Schwärzung (Gruppe von Faserpunkten). */
    function stage(className, points) {
      return `<g class="${className}">${dots(points, 2.4, "pg-soot")}</g>`;
    }
    return `<g class="pg-lungs" style="${origin([100, 90])}">
      ${stroke("M100 62 V76 M100 76 L93 82 M100 76 L107 82", 4, "pg-airway")}
      <path class="pg-gap-fill" d="M96 74 C84 70 72 86 72 102 C72 114 82 118 96 112 Z"/>
      <path class="pg-gap-fill" d="M104 74 C116 70 128 86 128 102 C128 114 118 118 104 112 Z"/>
      <path class="pg-lung" d="M95 77 C85 74 75 88 75 102 C75 111 83 114 95 109 Z"/>
      <path class="pg-lung" d="M105 77 C115 74 125 88 125 102 C125 111 117 114 105 109 Z"/>
      ${stage("pg-soot-1", [
        [84, 90],
        [116, 92],
        [88, 102],
        [112, 100],
      ])}
      ${stage("pg-soot-2", [
        [80, 98],
        [92, 86],
        [120, 98],
        [108, 86],
        [84, 106],
        [116, 106],
      ])}
      ${stage("pg-soot-3", [
        [90, 94],
        [110, 94],
        [78, 104],
        [122, 104],
        [92, 106],
        [108, 106],
        [86, 84],
        [114, 84],
      ])}
      <g class="pg-tumor" style="${origin([116, 98])}">
        <path class="pg-danger" d="M116 90 C122 88 126 94 123 99 C127 103 121 108 116 105 C112 109 106 104 109 99 C106 94 111 89 116 90 Z"/>
      </g>
    </g>`;
  }

  /** Figur von vorn: Kopf, Rumpf, Arme, Beine, Hände halten ein Carbonteil vor dem Bauch. */
  function frontFigure() {
    return `<g class="pg-front">
      ${capsule([92, 118], [90, 170], "pg-limb")}${capsule([108, 118], [110, 170], "pg-limb")}
      ${capsule([100, 66], [100, 112], "pg-torso")}
      <g class="pg-front-arms">
        ${capsule([82, 70], [76, 96], "pg-limb")}${capsule([76, 96], [88, 118], "pg-limb")}
        ${capsule([118, 70], [124, 96], "pg-limb")}${capsule([124, 96], [112, 118], "pg-limb")}
      </g>
      <g class="pg-panel" style="${origin([100, 122])}">${block(80, 118, 40, 8, 2, "pg-carbon")}</g>
      <circle class="pg-gap-fill" cx="100" cy="40" r="17"/><circle class="pg-fill" cx="100" cy="40" r="14"/>
      <g class="pg-mouth"><circle class="pg-gap-fill" cx="100" cy="47" r="3"/></g>
    </g>`;
  }

  define(
    "carbon-lunge",
    "Carbonstaub eingeatmet: Fasern in der Lunge, Krebsverdacht",
    "Eine Figur schleift Carbon ohne Atemschutz und atmet den Staub ein. Die Lunge füllt sich mit schwarzen Faserpunkten, dann wächst ein Tumor.",
    () =>
      `${floor()}${frontFigure()}${lungs()}<g class="pg-dust" style="${origin([100, 110])}">${dots(
        [
          [92, 108],
          [108, 106],
          [100, 100],
          [86, 98],
          [114, 96],
          [96, 90],
          [104, 88],
        ],
        2.6,
        "pg-soot-light",
      )}</g>`,
    motion({
      ".pg-front": {
        frames: [
          [0, { o: 0, t: "translateY(20px)", e: "in" }],
          [0.5, { o: 1, t: "none" }],
          ["X", { o: 1, e: "out" }],
          [at("X", 0.5), { o: 0 }],
          ["E", { o: 0 }],
        ],
      },
      ".pg-floor": {
        frames: [
          [0, { o: 0 }],
          [0.4, { o: 1 }],
          ["X", { o: 1 }],
          [at("X", 0.5), { o: 0 }],
          ["E", { o: 0 }],
        ],
      },
      // Schleifbewegung: Carbonteil reibt hin und her.
      ".pg-panel": {
        frames: [
          [0, { t: "none" }],
          [0.25, { t: "translateX(-4px)" }],
          [0.5, { t: "translateX(4px)" }],
          [0.75, { t: "translateX(-4px)" }],
          ["H", { t: "none" }],
        ],
      },
      // Staub steigt vom Carbonteil zum Mund und wird eingeatmet.
      ".pg-dust": {
        hold: "translateY(-56px) scale(0.35)",
        opacity: 0.9,
        frames: [
          [0, { o: 0, t: "none" }],
          [0.3, { o: 1, t: "none", e: "in" }],
          ["H", { o: 0.9, t: "hold" }],
          [at("H", 0.6), { o: 0, t: "translateY(-60px) scale(0.1)" }],
          [at("H", 0.61), { o: 0, t: "none" }],
          [at("H", 0.9), { o: 1, t: "none", e: "in" }],
          [at("H", 1.5), { o: 0.9, t: "hold" }],
          ["X", { o: 0, t: "translateY(-60px) scale(0.1)" }],
          ["E", { o: 0 }],
        ],
      },
      // Lunge schwärzt sich nach und nach (drei Stufen Faserpunkte).
      ".pg-soot-1": {
        frames: [
          [0, { o: 0 }],
          [0.5, { o: 0 }],
          ["H", { o: 1 }],
        ],
      },
      ".pg-soot-2": {
        frames: [
          [0, { o: 0 }],
          [at("H", 0.3), { o: 0 }],
          [at("H", 0.7), { o: 1 }],
        ],
      },
      ".pg-soot-3": {
        opacity: 0,
        frames: [
          [0, { o: 0 }],
          [at("H", 1.2), { o: 0 }],
          [at("H", 1.6), { o: 1 }],
          ["E", { o: 1 }],
        ],
      },
      // Phase 3: Lunge allein, groß in der Bildmitte; Tumor wächst.
      ".pg-lungs": {
        frames: [
          [0, { o: 0 }],
          [0.4, { o: 1 }],
          ["X", { t: "none", e: "in" }],
          [at("X", 0.7), { t: "translateY(8px) scale(2.3)" }],
          ["E", { t: "translateY(8px) scale(2.3)" }],
        ],
      },
      ".pg-tumor": {
        opacity: 0,
        frames: [
          [0, { o: 0, t: "scale(0)" }],
          [at("X", 0.8), { o: 0, t: "scale(0)", e: "in" }],
          [at("X", 1.3), { o: 1, t: "scale(1)" }],
          [at("X", 1.55), { o: 1, t: "scale(1.15)" }],
          [at("X", 1.8), { o: 1, t: "scale(1)" }],
          ["E", { o: 1, t: "scale(1.1)" }],
        ],
      },
      ".pg-airway": {
        frames: [
          ["X", { o: 1 }],
          [at("X", 0.4), { o: 1 }],
        ],
      },
    }),
    [0.8, 1.8, 2.4],
  );

  // 15. Carbonstaub nach Hause getragen
  define(
    "carbon-zuhause",
    "Ohne Schutzanzug: Staub bis nach Hause",
    "Die Figur arbeitet ohne Schutzanzug. Der Staub bleibt an Kleidung und Haut und landet zu Hause.",
    () =>
      `${floor()}<g class="pg-home">${stroke("M134 176 V112 L162 88 L190 112 V176", 5)}</g>${figure(
        {
          handFront: `<g class="pg-rash">${dots(
            [
              [100, 104],
              [96, 96],
              [104, 112],
            ],
            3,
            "pg-danger",
          )}</g>`,
        },
      )}<g class="pg-body-dust">${dots(
        [
          [94, 80],
          [104, 92],
          [98, 100],
          [92, 70],
          [106, 74],
          [96, 130],
          [104, 150],
        ],
        3,
      )}</g>` +
      `<g class="pg-home-dust">${dots(
        [
          [146, 160],
          [158, 150],
          [172, 164],
          [178, 140],
          [150, 132],
          [166, 124],
        ],
        3,
      )}</g>`,
    motion(walkLegs("X"), {
      ".pg-figure": {
        hold: "translateX(-30px)",
        frames: [
          [0, { t: "translateX(-90px)", e: "in" }],
          [0.5, { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.6), { t: "translateX(40px)" }],
        ],
      },
      ".pg-body-dust": {
        hold: "translateX(-30px)",
        frames: [
          [0, { t: "translateX(-90px)", o: 0, e: "in" }],
          [0.5, { t: "hold", o: 1 }],
          ["X", { t: "hold" }],
          [at("X", 0.6), { t: "translateX(40px)", o: 0 }],
        ],
      },
      ".pg-home-dust": appearAt("X+0.5", 1),
      ".pg-rash": appearAt("X+0.2"),
      ".pg-arm--back": {
        hold: "rotate(-25deg)",
        frames: [
          [0, { t: "rotate(25deg)" }],
          [0.2, { t: "rotate(-25deg)" }],
          [0.4, { t: "rotate(20deg)" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.3), { t: "rotate(25deg)" }],
          [at("X", 0.6), { t: "rotate(-25deg)" }],
        ],
      },
      ".pg-arm--front": { hold: "rotate(-60deg)" },
      ".pg-forearm--front": { hold: "rotate(-60deg)" },
      ".pg-leg--front": {
        hold: "rotate(-20deg)",
        frames: [
          [0, { t: "rotate(28deg)" }],
          [0.2, { t: "rotate(-28deg)" }],
          [0.4, { t: "rotate(20deg)" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.3), { t: "rotate(25deg)" }],
          [at("X", 0.6), { t: "rotate(-25deg)" }],
        ],
      },
      ".pg-leg--back": {
        hold: "rotate(20deg)",
        frames: [
          [0, { t: "rotate(-28deg)" }],
          [0.2, { t: "rotate(28deg)" }],
          [0.4, { t: "rotate(-20deg)" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.3), { t: "rotate(-25deg)" }],
          [at("X", 0.6), { t: "rotate(25deg)" }],
        ],
      },
    }),
  );

  // 16. Harz auf der Haut
  define(
    "harz-haut",
    "Harz ohne Handschuhe: Allergie ein Leben lang",
    "Die Figur fasst Harz ohne Nitrilhandschuhe an. Die Haut entzündet sich, es entsteht eine bleibende Allergie.",
    () =>
      `${floor()}<g class="pg-table">${block(118, 120, 56, 6, 2)}${block(166, 126, 6, 50, 2)}</g>` +
      `<g class="pg-cup">${block(128, 96, 26, 24, 4)}<rect class="pg-gap-fill" x="131" y="100" width="20" height="5"/></g>${figure(
        {
          handFront: `<g class="pg-resin" style="${origin([100, 118])}"><circle class="pg-fill" cx="100" cy="122" r="4"/></g>
          <g class="pg-hand-rash">${dots(
            [
              [100, 112],
              [96, 104],
              [104, 100],
              [98, 118],
            ],
            3,
            "pg-danger",
          )}</g>`,
        },
      )}`,
    motion(walkLegs(), enter("translateX(-8px)"), {
      ".pg-body": { hold: "rotate(15deg)" },
      ".pg-arm--front": {
        hold: "rotate(-30deg)",
        frames: [
          [0, { t: "none" }],
          [0.5, { t: "rotate(-20deg)", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.3), { t: "rotate(-20deg)" }],
        ],
      },
      ".pg-forearm--front": {
        hold: "rotate(-50deg)",
        frames: [
          ["X", { t: "hold" }],
          [at("X", 0.3), { t: "rotate(-80deg)" }],
        ],
      },
      ".pg-arm--back": {
        frames: [
          ["X", { t: "none" }],
          [at("X", 0.35), { t: "rotate(-40deg)" }],
          [at("X", 0.5), { t: "rotate(-30deg)" }],
          [at("X", 0.65), { t: "rotate(-40deg)" }],
          [at("X", 0.8), { t: "rotate(-30deg)" }],
        ],
      },
      ".pg-forearm--back": {
        frames: [
          ["X", { t: "none" }],
          [at("X", 0.35), { t: "rotate(-80deg)" }],
        ],
      },
      ".pg-resin": visibleFromHold(0.1),
      ".pg-hand-rash": appearAt("X+0.2"),
    }),
  );

  // 17. Zu viel Harz angemischt
  define(
    "harz-hitze",
    "Zu viel Harz angemischt: Qualm und Brand",
    "Ein großer Becher Harz wird angemischt. Er wird immer heißer, qualmt und fängt Feuer.",
    () =>
      `${floor()}<g class="pg-table">${block(110, 132, 70, 6, 2)}${block(172, 138, 6, 38, 2)}</g>` +
      `<g class="pg-cup pg-bigcup" style="${origin([136, 130])}">${block(118, 90, 36, 40, 5)}<rect class="pg-gap-fill" x="121" y="96" width="30" height="5"/></g>` +
      `<g class="pg-thermo">${block(164, 70, 8, 52, 4)}<g class="pg-thermo-level" style="${origin([168, 120])}"><rect class="pg-danger" x="165" y="72" width="6" height="48" rx="3"/></g></g>${cloud(
        136,
        66,
        0.9,
        "pg-cloud pg-smoke",
      )}${flame(136, 92, 1.3, "pg-flame-big")}${figure()}`,
    motion(walkLegs(), enter("translateX(-34px)"), {
      ".pg-arm--front": {
        hold: "rotate(-60deg)",
        frames: [
          [0, { t: "none" }],
          [0.5, { t: "rotate(-50deg)" }],
          [0.7, { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.3), { t: "rotate(-150deg)" }],
        ],
      },
      ".pg-forearm--front": {
        hold: "rotate(-30deg)",
        frames: [
          ["X", { t: "hold" }],
          [at("X", 0.3), { t: "rotate(60deg)" }],
        ],
      },
      ".pg-thermo-level": {
        hold: "scaleY(0.85)",
        frames: [
          [0, { t: "scaleY(0.15)" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold" }],
          [at("X", 0.2), { t: "scaleY(1)" }],
        ],
      },
      ".pg-smoke": visibleFromHold(0.2),
      ".pg-flame-big": appearAt("X+0.15", 1.1),
      ".pg-bigcup": {
        frames: [
          ["X", { t: "none" }],
          [at("X", 0.6), { t: "scale(1.1, 0.75)" }],
          ["E", { t: "scale(1.1, 0.75)" }],
        ],
      },
      ".pg-figure": {
        hold: "translateX(-34px)",
        frames: [
          [0, { t: "translateX(-94px)", e: "in" }],
          [0.5, { t: "hold" }],
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.5), { t: "translateX(-60px)" }],
        ],
      },
    }),
  );

  // 18. Gefahrstoff in der Getränkeflasche
  define(
    "getraenkeflasche",
    "Gefahrstoff in der Getränkeflasche: Vergiftung",
    "Ein Gefahrstoff wird in eine Getränkeflasche gefüllt. Jemand trinkt daraus und vergiftet sich.",
    () =>
      `${floor()}<g class="pg-table">${block(118, 132, 60, 6, 2)}${block(170, 138, 6, 38, 2)}</g>` +
      `<g class="pg-bottle" style="${origin([148, 130])}">
        <path class="pg-gap-fill" d="M139 76 V92 Q132 98 132 108 V133 H164 V108 Q164 98 157 92 V76 Z"/>
        <path class="pg-line" d="M142 78 V94 Q135 100 135 108 V130 H161 V108 Q161 100 154 94 V78 Z" fill="none" stroke-width="4"/>
        <g class="pg-bottle-fill" style="${origin([148, 130])}"><rect class="pg-fill" x="137" y="106" width="22" height="24"/></g>
        <g class="pg-bottle-skull">${skull(148, 116, 0.3, "pg-mini-skull")}</g>
      </g>${figure({
        handFront: `<g class="pg-canister">${block(98, 104, 18, 24, 3)}</g>`,
      })}<g class="pg-pour">${stroke("M126 82 Q140 76 148 96", 4, "pg-line", 'pathLength="1"')}</g>${skull(
        70,
        34,
        0.8,
        "pg-skull",
      )}`,
    motion(walkLegs(), enter("translateX(-14px)"), {
      ".pg-arm--front": {
        hold: "rotate(-80deg)",
        frames: [
          [0, { t: "none" }],
          [0.5, { t: "rotate(-40deg)", e: "in" }],
          ["H", { t: "hold" }],
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.35), { t: "rotate(-41deg)" }],
          [at("X", 0.8), { t: "rotate(-41deg)" }],
          [at("X", 1.1), { t: "rotate(25deg)" }],
          ["E", { t: "rotate(25deg)" }],
        ],
      },
      ".pg-forearm--front": {
        hold: "rotate(-60deg)",
        frames: [
          ["X", { t: "hold", e: "out" }],
          [at("X", 0.35), { t: "rotate(-107deg)" }],
          [at("X", 0.8), { t: "rotate(-107deg)" }],
          [at("X", 1.1), { t: "rotate(-10deg)" }],
          ["E", { t: "rotate(-10deg)" }],
        ],
      },
      ".pg-pour": {
        frames: [
          [0, { o: 0 }],
          [0.4, { o: 1 }],
          ["X", { o: 1 }],
          [at("X", 0.1), { o: 0 }],
          ["E", { o: 0 }],
        ],
      },
      ".pg-pour .pg-line": {
        dash: 0,
        frames: [
          [0, { d: 1 }],
          [0.4, { d: 1 }],
          [0.7, { d: 0 }],
        ],
      },
      ".pg-bottle-fill": {
        hold: "none",
        frames: [
          [0, { t: "scaleY(0)" }],
          [0.5, { t: "scaleY(0)" }],
          ["H", { t: "none" }],
        ],
      },
      ".pg-mini-skull": visibleFromHold(0.05),
      ".pg-bottle": {
        frames: [
          ["X", { t: "none", e: "out" }],
          [at("X", 0.35), { t: "translate(-14px, -42px) rotate(-45deg)" }],
          [at("X", 0.8), { t: "translate(-14px, -42px) rotate(-45deg)" }],
          [at("X", 1.1), { t: "translate(-40px, 40px) rotate(-90deg)" }],
          ["E", { t: "translate(-40px, 40px) rotate(-90deg)" }],
        ],
      },
      ".pg-canister": {
        frames: [
          ["X", { o: 1 }],
          [at("X", 0.1), { o: 0 }],
          ["E", { o: 0 }],
        ],
        opacity: 1,
      },
      ".pg-head": {
        frames: [
          ["X", { t: "none" }],
          [at("X", 0.35), { t: "rotate(-22deg)" }],
          [at("X", 0.8), { t: "rotate(-22deg)" }],
          [at("X", 1.1), { t: "rotate(-35deg)" }],
          ["E", { t: "rotate(-35deg)" }],
        ],
      },
      ".pg-skull": appearAt("X+0.85"),
      ".pg-body": {
        frames: [
          [at("X", 0.8), { t: "none", e: "out" }],
          [at("X", 1.1), { t: "rotate(-60deg)" }],
          ["E", { t: "rotate(-60deg)" }],
        ],
      },
    }),
  );
})();
