/*
 * pictograms-disciplines.js – animierte Grafiken der dynamischen Disziplinen (Teamonboarding)
 *
 * Skidpad, Acceleration, Autocross, Endurance und Efficiency, im Querformat (viewBox 800 × 400).
 * Aufbau wie die bisherigen statischen Grafiken, dazu Bewegung in drei Phasen:
 *   1. Auftritt  Strecke und Pylonen erscheinen, das Auto steht am Start.
 *   2. Lauf      Das Auto fährt die Disziplin – auf der echten Fahrlinie (SVG <animateMotion>,
 *                Richtung folgt der Bahn: rotate="auto"). Beschriftungen zeigen Runde, Fahrer, Zeit.
 *   3. Ergebnis  Kurzes Halten am Ziel, dann blendet alles aus.
 * Ohne Bewegung (prefers-reduced-motion, vor dem Abspielen) steht das Auto am Start – das Bild
 * entspricht dann der bisherigen statischen Grafik.
 *
 * Zeitsteuerung: Die Bahnbewegung läuft mit derselben Gesamtdauer wie die CSS-Animation
 * (timing in Sekunden). keyTimes/keyPoints halten das Auto während Auftritt und Ergebnis an Start
 * bzw. Ziel. Start und Stopp regelt setupPlayback() in js/ui/pictograms.js.
 *
 * Wenn du hier etwas ändern willst …
 *   – Fahrlinie: die Pfade COURSE (Autocross), LOOP (Endurance), Kreise beim Skidpad.
 *   – Dauer: timing des Motivs; keyTimes werden daraus berechnet (motionPath()).
 */

(function () {
  "use strict";

  const { registerPictogram, origin } = EM.require("js/ui/pictograms.js");

  const VIEWBOX = "0 0 800 400";

  // ───────────────────────── Baukasten ─────────────────────────

  /** Beschriftung: hell (Nebeninfo) oder in Figurfarbe und fett (Hauptinfo). */
  function label(x, y, text, size = 18, strong = false, anchor = "start") {
    return `<text class="${strong ? "pg-label-strong" : "pg-label"}" x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}"${strong ? ' font-weight="700"' : ""}>${text}</text>`;
  }

  /** Pylone. */
  function cone(x, y, radius = 4.5) {
    return `<circle class="pg-fill" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius}"/>`;
  }

  /** Pylonen auf einem Kreis (optional mit Lücke). */
  function coneCircle(cx, cy, radius, count, skip = () => false) {
    let out = "";
    for (let i = 0; i < count; i += 1) {
      const angle = (2 * Math.PI * i) / count;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      if (!skip(x, y)) {
        out += cone(x, y, 3.5);
      }
    }
    return out;
  }

  /** Rennwagen von oben, Nase zeigt nach rechts (+x), Mittelpunkt im Ursprung. */
  function carShape(scale) {
    return `<g transform="scale(${scale})">
      <rect class="pg-fill" x="-48" y="-23" width="9" height="46" rx="2"/>
      <rect class="pg-car-tyre" x="-36" y="-27" width="20" height="11" rx="3"/>
      <rect class="pg-car-tyre" x="-36" y="16" width="20" height="11" rx="3"/>
      <rect class="pg-car-tyre" x="16" y="-26" width="18" height="10" rx="3"/>
      <rect class="pg-car-tyre" x="16" y="16" width="18" height="10" rx="3"/>
      <path class="pg-car-body" d="M-40,-10 L18,-8 L46,-3 L46,3 L18,8 L-40,10 Z"/>
      <ellipse class="pg-car-tyre" cx="-8" cy="0" rx="10" ry="5"/>
      <rect class="pg-fill" x="42" y="-25" width="7" height="50" rx="2"/>
    </g>`;
  }

  /**
   * Auto, das einer Bahn folgt. Während des Auftritts steht es am Anfang der Bahn, während des
   * Ergebnisses am Ende (bzw. an Haltepunkten: stops).
   * @param {string} path  SVG-Pfad der Fahrlinie
   * @param {number[]} timing  [Auftritt, Lauf, Ergebnis] in Sekunden
   * @param {number} scale
   * @param {Array<[number, number]>} [points]  zusätzliche [Zeitanteil 0–1, Bahnanteil 0–1]
   *   innerhalb des Laufs (z. B. Boxenstopp: zwei Punkte mit gleichem Bahnanteil)
   */
  function motionPath(path, timing, scale, points = []) {
    const [entry, run, exit] = timing;
    const total = entry + run + exit;
    const times = [0, entry / total];
    const progress = [0, 0];
    for (const [time, distance] of points) {
      times.push((entry + time * run) / total);
      progress.push(distance);
    }
    times.push((entry + run) / total, 1);
    progress.push(1, 1);
    return `<g class="pg-car">${carShape(scale)}
      <animateMotion dur="${total}s" repeatCount="indefinite" rotate="auto" calcMode="linear"
        keyTimes="${times.map((t) => t.toFixed(4)).join(";")}" keyPoints="${progress.join(";")}"
        path="${path}"/>
    </g>`;
  }

  /** Teil erscheint zum Zeitpunkt (Sekunden) und bleibt bis kurz vor Schluss. */
  function showFrom(time, until = "E") {
    return {
      frames: [
        [0, { o: 0 }],
        [time, { o: 0 }],
        [time + 0.2, { o: 1 }],
        [until, { o: 1 }],
      ],
    };
  }

  /** Teil ist nur in einem Zeitfenster zu sehen (Sekunden). */
  function showBetween(from, to) {
    return {
      opacity: 0,
      frames: [
        [0, { o: 0 }],
        [from, { o: 0 }],
        [from + 0.15, { o: 1 }],
        [to - 0.15, { o: 1 }],
        [to, { o: 0 }],
        ["E", { o: 0 }],
      ],
    };
  }

  /** Ganze Szene ein- und ausblenden, Strecke wächst beim Auftritt auf. */
  const SCENE = {
    ".pg-scene": {
      frames: [
        [0, { o: 0 }],
        [0.3, { o: 1 }],
        ["E-0.4", { o: 1 }],
        ["E", { o: 0 }],
      ],
    },
    ".pg-track": {
      frames: [
        [0, { t: "scale(0.92)", e: "in" }],
        ["H", { t: "none" }],
      ],
    },
  };

  /** Motiv anmelden. */
  function define(name, label_, description, timing, svg, motion) {
    registerPictogram(name, {
      label: label_,
      description,
      viewBox: VIEWBOX,
      timing,
      svg: () => `<g class="pg-scene">${svg(timing)}</g>`,
      motion: { ...SCENE, ...motion },
    });
  }

  // ───────────────────────── Skidpad ─────────────────────────
  // Fahrlinie: von unten zur Mitte, rechter Kreis zweimal im Uhrzeigersinn, linker Kreis zweimal
  // gegen den Uhrzeigersinn, dann nach oben hinaus. Gewertet wird jeweils die zweite Runde.

  const SKIDPAD_TIMING = [0.8, 8, 1];
  const RIGHT = "A110 110 0 1 1 660 200 A110 110 0 1 1 440 200";
  const LEFT = "A110 110 0 1 0 220 200 A110 110 0 1 0 440 200";
  const SKIDPAD_PATH = `M440 380 L440 200 ${RIGHT} ${RIGHT} ${LEFT} ${LEFT} L440 20`;
  // Anteile der Strecke: Einfahrt 180, je Runde 2π·110 ≈ 691, Ausfahrt 180.
  const SKIDPAD_LENGTH = 180 + 4 * 691.15 + 180;
  /** Startzeit (Sekunden) von Runde n (1–4) bzw. der Ausfahrt (5). */
  function lapStart(lap) {
    const [entry, run] = SKIDPAD_TIMING;
    return entry + (run * (180 + (lap - 1) * 691.15)) / SKIDPAD_LENGTH;
  }

  define(
    "skidpad",
    "Skidpad: zwei Runden rechts im Uhrzeigersinn, dann zwei Runden links gegen den Uhrzeigersinn",
    "Das Auto fährt von unten ein, umrundet zweimal den rechten Kreis im Uhrzeigersinn, dann zweimal den linken gegen den Uhrzeigersinn und fährt oben hinaus.",
    SKIDPAD_TIMING,
    (timing) => `
      <g class="pg-track" style="${origin([440, 200])}">
        <path class="pg-guide" d="M440 385 V15"/>
        <circle class="pg-lane" cx="330" cy="200" r="110"/>
        <circle class="pg-lane" cx="550" cy="200" r="110"/>
        ${coneCircle(330, 200, 82, 20)}${coneCircle(550, 200, 82, 20)}
        ${coneCircle(330, 200, 140, 28, (x) => Math.abs(x - 440) < 60)}
        ${coneCircle(550, 200, 140, 28, (x) => Math.abs(x - 440) < 60)}
      </g>
      ${label(460, 380, "Einfahrt")}${label(460, 34, "Ausfahrt")}
      <g class="pg-side pg-side-right">${label(550, 196, "Runde 1 + 2", 18, true, "middle")}${label(550, 218, "im", 15, false, "middle")}${label(550, 236, "Uhrzeigersinn", 15, false, "middle")}</g>
      <g class="pg-side pg-side-left">${label(330, 196, "Runde 3 + 4", 18, true, "middle")}${label(330, 218, "gegen den", 15, false, "middle")}${label(330, 236, "Uhrzeigersinn", 15, false, "middle")}</g>
      <g class="pg-static-note">${label(40, 318, "Liegende Acht", 24, true)}${label(40, 346, "erst zweimal rechts,")}${label(40, 370, "dann zweimal links")}</g>
      ${[1, 2, 3, 4]
        .map(
          (lap) =>
            `<g class="pg-lap pg-lap-${lap}">${label(40, 318, `Runde ${lap}`, 24, true)}${label(40, 346, lap % 2 === 0 ? "wird gewertet" : "Einfahren", 18, lap % 2 === 0)}${label(40, 370, lap <= 2 ? "rechts, im Uhrzeigersinn" : "links, gegen den Uhrzeigersinn")}</g>`,
        )
        .join("")}
      ${label(760, 380, "Gelbe Punkte = Pylonen", 15, false, "end")}
      ${motionPath(SKIDPAD_PATH, timing, 0.55)}`,
    {
      // Während der Runden ersetzt der Rundenzähler den Merksatz unten links.
      ".pg-static-note": {
        frames: [
          [0, { o: 1 }],
          [lapStart(1) - 0.1, { o: 1 }],
          [lapStart(1), { o: 0 }],
          [lapStart(5), { o: 0 }],
          [lapStart(5) + 0.3, { o: 1 }],
        ],
      },
      ".pg-lap-1": showBetween(lapStart(1), lapStart(2)),
      ".pg-lap-2": showBetween(lapStart(2), lapStart(3)),
      ".pg-lap-3": showBetween(lapStart(3), lapStart(4)),
      ".pg-lap-4": showBetween(lapStart(4), lapStart(5)),
      // Der Kreis, auf dem das Auto gerade fährt, ist hervorgehoben.
      ".pg-side-left": {
        frames: [
          [0, { o: 1 }],
          [lapStart(1), { o: 0.35 }],
          [lapStart(3) - 0.1, { o: 0.35 }],
          [lapStart(3), { o: 1 }],
        ],
      },
      ".pg-side-right": {
        frames: [
          [0, { o: 1 }],
          [lapStart(3) - 0.1, { o: 1 }],
          [lapStart(3), { o: 0.35 }],
          [lapStart(5), { o: 1 }],
        ],
      },
    },
  );

  // ───────────────────────── Acceleration ─────────────────────────

  const ACC_TIMING = [0.8, 2.4, 1];
  const RUN_START = 1.0;
  const RUN_END = 2.5;

  define(
    "acceleration",
    "Acceleration: 75 Meter aus dem Stand",
    "Das Auto beschleunigt aus dem Stand über 75 Meter, die Stoppuhr läuft bis zur Ziellinie.",
    ACC_TIMING,
    () => {
      let cones = "";
      for (let x = 80; x < 740; x += 30) {
        cones += cone(x, 140, 4) + cone(x, 260, 4);
      }
      let flag = "";
      for (let i = 0; i < 12; i += 1) {
        for (let j = 0; j < 2; j += 1) {
          if ((i + j) % 2 === 0) {
            flag += `<rect class="pg-white" x="${676 + j * 8}" y="${140 + i * 10}" width="8" height="10"/>`;
          }
        }
      }
      return `
        <g class="pg-track" style="${origin([400, 200])}">
          <rect class="pg-asphalt" x="60" y="140" width="680" height="120" rx="8"/>
          ${cones}<rect class="pg-white" x="128" y="140" width="6" height="120"/>${flag}
        </g>
        <g class="pg-speed">${[185, 200, 215]
          .map(
            (y, i) =>
              `<path class="pg-speed-line" d="M${70 + i * 6},${y} L${135 - i * 4},${y}"/>`,
          )
          .join("")}</g>
        <g class="pg-acc-car" style="${origin([185, 200])}"><g transform="translate(185 200)">${carShape(0.8)}</g></g>
        <path class="pg-lane-arrow" d="M140,310 L670,310"/>
        <path class="pg-fill" d="M140,310 l12,-7 v14 Z M670,310 l-12,-7 v14 Z"/>
        ${label(405, 345, "75 Meter", 26, true, "middle")}${label(131, 120, "Start", 18, false, "middle")}${label(684, 120, "Ziel", 18, false, "middle")}
        <circle class="pg-lane" cx="700" cy="62" r="30"/>
        <rect class="pg-fill" x="693" y="22" width="14" height="8" rx="2"/>
        <g class="pg-watch-hand" style="${origin([700, 62])}"><path class="pg-hand-line" d="M700,62 L700,40"/></g>
        <g class="pg-time" style="${origin([640, 62])}">${label(652, 70, "3,5 s", 26, true, "end")}</g>`;
    },
    {
      // Beschleunigen: erst langsam, dann immer schneller bis über die Ziellinie, dann ausrollen.
      ".pg-acc-car": {
        frames: [
          [0, { t: "none" }],
          [RUN_START, { t: "none", e: "cubic-bezier(0.55, 0, 0.9, 0.55)" }],
          [
            RUN_END,
            { t: "translateX(499px)", e: "cubic-bezier(0.2, 0.7, 0.4, 1)" },
          ],
          [RUN_END + 0.5, { t: "translateX(545px)" }],
          ["E", { t: "translateX(545px)" }],
        ],
      },
      ".pg-speed": {
        frames: [
          [0, { o: 1 }],
          [RUN_START, { o: 1 }],
          [RUN_START + 0.15, { o: 0 }],
          ["E", { o: 0 }],
        ],
      },
      ".pg-watch-hand": {
        frames: [
          [0, { t: "none" }],
          [RUN_START, { t: "none", e: "linear" }],
          [RUN_END, { t: "rotate(1260deg)" }],
          ["E", { t: "rotate(1260deg)" }],
        ],
      },
      ".pg-time": {
        opacity: 0,
        frames: [
          [0, { o: 0, t: "scale(0)" }],
          [RUN_END, { o: 0, t: "scale(0)", e: "in" }],
          [RUN_END + 0.25, { o: 1, t: "scale(1.2)" }],
          [RUN_END + 0.4, { o: 1, t: "none" }],
          ["E", { o: 1, t: "none" }],
        ],
      },
    },
  );

  // ───────────────────────── Autocross ─────────────────────────

  const COURSE =
    "M150,300 C90,300 80,220 130,200 C190,175 170,120 230,100 C300,80 330,160 390,150 C450,140 440,80 520,80 C610,80 650,150 610,200 C575,245 680,250 660,310 C640,360 560,330 500,320 C430,308 400,350 330,340 C260,330 230,300 150,300";
  const AUTOCROSS_TIMING = [0.8, 5, 1.2];
  const AUTOCROSS_CONES = [
    [120, 245],
    [190, 160],
    [260, 118],
    [340, 130],
    [430, 112],
    [520, 108],
    [600, 130],
    [628, 190],
    [655, 280],
    [560, 300],
    [470, 300],
    [380, 320],
    [300, 320],
    [220, 310],
  ];

  define(
    "autocross",
    "Autocross: eine Runde auf Zeit",
    "Das Auto fährt eine Runde auf dem engen, kurvigen Kurs, die Zeit läuft von Start bis Ziel.",
    AUTOCROSS_TIMING,
    (timing) => `
      <g class="pg-track" style="${origin([400, 210])}">
        <path class="pg-road" d="${COURSE} Z" stroke-width="44"/>
        <path class="pg-centerline" d="${COURSE} Z"/>
        ${AUTOCROSS_CONES.map(([x, y]) => cone(x, y, 4)).join("")}
        <rect class="pg-white" x="146" y="278" width="6" height="44"/>
      </g>
      ${label(150, 362, "Start / Ziel", 17, false, "middle")}
      <g class="pg-round-label">${label(700, 60, "1 Runde", 22, true, "end")}${label(700, 84, "auf Zeit", 17, false, "end")}</g>
      <g class="pg-finish" style="${origin([150, 250])}">${label(150, 262, "Ziel!", 22, true, "middle")}</g>
      ${motionPath(COURSE, timing, 0.5)}`,
    {
      ".pg-finish": {
        opacity: 0,
        frames: [
          [0, { o: 0, t: "scale(0)" }],
          ["X", { o: 0, t: "scale(0)", e: "in" }],
          ["X+0.25", { o: 1, t: "scale(1.2)" }],
          ["X+0.4", { o: 1, t: "none" }],
          ["E", { o: 1, t: "none" }],
        ],
      },
    },
  );

  // ───────────────────────── Endurance ─────────────────────────
  // Vier Runden stehen für die 22 km, nach der zweiten Runde Fahrerwechsel an der Box.

  const LOOP =
    "C120,290 110,170 190,150 C260,132 300,190 360,170 C430,146 420,90 520,90 C620,90 660,160 640,220 C620,290 560,300 480,300 L200,290";
  const ENDURANCE_PATH = `M200,290 ${LOOP} ${LOOP} ${LOOP} ${LOOP}`;
  const ENDURANCE_TIMING = [0.8, 8, 1.2];
  // Haltepunkt nach zwei Runden (Bahnanteil 0,5) von 40 % bis 55 % der Laufzeit.
  const PIT = [
    [0.4, 0.5],
    [0.55, 0.5],
  ];
  const PIT_FROM = 0.8 + 8 * 0.4;
  const PIT_TO = 0.8 + 8 * 0.55;

  define(
    "endurance",
    "Endurance: 22 Kilometer, zwei Fahrer, Fahrerwechsel in der Mitte",
    "Das Auto fährt Runde um Runde. Nach der Hälfte hält es zum Fahrerwechsel, dann fährt der zweite Fahrer weiter.",
    ENDURANCE_TIMING,
    (timing) => `
      <g class="pg-track" style="${origin([380, 200])}">
        <path class="pg-road" d="M200,290 ${LOOP} Z" stroke-width="40"/>
        <path class="pg-centerline" d="M200,290 ${LOOP} Z"/>
      </g>
      <path class="pg-lap-arrow" d="M430,250 A50,32 0 1 1 530,250"/>
      ${label(480, 278, "Runde um Runde", 16, false, "middle")}
      ${label(700, 330, "22 km", 44, true, "end")}${label(700, 360, "2 Fahrer, je ca. 11 km", 18, false, "end")}
      <g class="pg-driver-1">${label(200, 350, "Fahrer 1", 20, true, "middle")}</g>
      <g class="pg-pit" style="${origin([200, 250])}">${label(200, 350, "Fahrerwechsel", 20, true, "middle")}${label(200, 372, "höchstens 3 Minuten", 15, false, "middle")}</g>
      <g class="pg-driver-2">${label(200, 350, "Fahrer 2", 20, true, "middle")}</g>
      ${motionPath(ENDURANCE_PATH, timing, 0.5, PIT)}`,
    {
      ".pg-driver-1": showBetween(0.8, PIT_FROM),
      ".pg-pit": showBetween(PIT_FROM, PIT_TO),
      ".pg-driver-2": showBetween(PIT_TO, 9.8),
    },
  );

  // ───────────────────────── Efficiency ─────────────────────────
  // Der Akku leert sich während der 22 km. Zweimal holt die Bremsenergie etwas zurück.

  const EFF_TIMING = [0.8, 5, 1.4];

  /** Akku mit Füllstand (Gruppe .pg-level skaliert von unten). */
  function battery(x, y, name, text) {
    return `
      <rect class="pg-battery-frame" x="${x}" y="${y}" width="110" height="200" rx="12"/>
      <rect class="pg-battery-cap" x="${x + 35}" y="${y - 16}" width="40" height="16" rx="4"/>
      <g class="${name}" style="${origin([x + 55, y + 190])}"><rect class="pg-fill" x="${x + 10}" y="${y + 10}" width="90" height="180" rx="6"/></g>
      <path class="pg-bolt" d="M${x + 62},${y + 70} L${x + 42},${y + 110} L${x + 58},${y + 110} L${x + 48},${y + 145} L${x + 72},${y + 98} L${x + 56},${y + 98} Z"/>
      ${label(x + 55, y + 234, text, 18, false, "middle")}`;
  }

  define(
    "efficiency",
    "Efficiency: Wie viel Energie das Auto während der Endurance verbraucht",
    "Der volle Akku leert sich über 22 Kilometer, beim Bremsen fließt etwas Energie zurück. Verbraucht ist der Unterschied – je weniger, desto besser.",
    EFF_TIMING,
    () => `
      ${battery(200, 120, "pg-level-full", "vor der Endurance")}
      ${battery(490, 120, "pg-level-drain", "nach der Endurance")}
      <path class="pg-lane-arrow" d="M340,220 L450,220"/><path class="pg-fill" d="M462,220 l-14,-8 v16 Z"/>
      <g class="pg-mini-car" style="${origin([345, 220])}"><g transform="translate(345 220)">${carShape(0.32)}</g></g>
      ${label(400, 205, "22 km", 18, true, "middle")}
      <g class="pg-recup" style="${origin([545, 110])}">${label(545, 104, "+ Bremsenergie", 15, true, "middle")}</g>
      <g class="pg-used"><path class="pg-bracket" d="M620,130 L640,130 L640,215 L620,215"/>${label(652, 170, "verbraucht", 17, true)}${label(652, 192, "– je weniger,")}${label(652, 214, "desto besser")}</g>`,
    {
      // Pose (Grundzustand): rechter Akku zu 35 % voll, wie in der bisherigen Grafik.
      ".pg-level-drain": {
        hold: "scaleY(0.35)",
        frames: [
          [0, { t: "none" }],
          [0.8, { t: "none" }],
          [2.4, { t: "scaleY(0.62)" }],
          [2.6, { t: "scaleY(0.68)" }],
          [4.2, { t: "scaleY(0.42)" }],
          [4.4, { t: "scaleY(0.47)" }],
          [5.8, { t: "scaleY(0.35)" }],
          ["E", { t: "scaleY(0.35)" }],
        ],
      },
      ".pg-mini-car": {
        frames: [
          [0, { t: "none" }],
          [0.8, { t: "none" }],
          [5.8, { t: "translateX(95px)" }],
          ["E", { t: "translateX(95px)" }],
        ],
      },
      ".pg-recup": {
        opacity: 0,
        frames: [
          [0, { o: 0 }],
          [2.35, { o: 0, t: "translateY(10px)" }],
          [2.5, { o: 1, t: "none" }],
          [2.9, { o: 0, t: "translateY(-8px)" }],
          [4.15, { o: 0, t: "translateY(10px)" }],
          [4.3, { o: 1, t: "none" }],
          [4.7, { o: 0, t: "translateY(-8px)" }],
          ["E", { o: 0 }],
        ],
      },
      ".pg-used": showFrom(5.8),
    },
  );
})();
