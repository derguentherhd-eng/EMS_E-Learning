/*
 * pictograms-graphics.js – weitere animierte Grafiken des Teamonboardings
 *
 * Statische Disziplinen (Engineering Design, Cost & Manufacturing, Business Plan) und die
 * Schritt-Grafiken der Slack-Anleitung (Bestätigungscode, Profil, Channels), Querformat 800 × 400.
 * Aufbau wie die bisherigen Grafiken; die Animation baut sie in drei Phasen auf:
 *   1. Auftritt  Rahmen und Grundformen erscheinen.
 *   2. Ablauf    Die Grafik „passiert“: Jury tritt auf, Liste füllt sich, Balken wachsen,
 *                ein Mauszeiger klickt die nummerierten Schritte nacheinander an.
 *   3. Ergebnis  Kurz das fertige Bild, dann blendet alles aus.
 * Grundzustand (ohne Bewegung, vor dem Abspielen) ist das fertige Bild – wie die bisherige Grafik.
 *
 * Wenn du hier etwas ändern willst …
 *   – Zeitpunkte: Sekundenangaben in den motion-Objekten (Format: installMotion() in pictograms.js).
 */

(function () {
  "use strict";

  const { registerPictogram, origin } = EM.require("js/ui/pictograms.js");

  const VIEWBOX = "0 0 800 400";
  const TIMING = [0.6, 3.6, 1.2];
  const PURPLE = "#534495";
  const SLACK = {
    sidebar: "#3F0E40",
    panel: "#5C2C5D",
    line: "#B79BB8",
    blue: "#1264A3",
    green: "#007A5A",
  };

  // ───────────────────────── Baukasten ─────────────────────────

  /** Text in fester Farbe oder als Beschriftung (hell bzw. Figurfarbe). */
  function text(
    x,
    y,
    value,
    size,
    { fill, cls, anchor = "start", bold = false } = {},
  ) {
    const paint = fill ? `fill="${fill}"` : `class="${cls ?? "pg-label"}"`;
    return `<text ${paint} x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}"${bold ? ' font-weight="700"' : ""}>${value}</text>`;
  }

  /** Nummer eines Schritts (gelber Kreis mit violettem Rand). */
  function badge(x, y, number) {
    return `<g class="pg-badge pg-badge-${number}" style="${origin([x, y])}">
      <circle cx="${x}" cy="${y}" r="15" class="pg-fill" stroke="${PURPLE}" stroke-width="3"/>
      ${text(x, y + 6, number, 17, { fill: "#1e1e1e", anchor: "middle", bold: true })}</g>`;
  }

  /** Person (Kopf + Oberkörper), für Jury und Vortragende. */
  function person(x, y, paint, scale = 1) {
    return `<circle cx="${x}" cy="${y}" r="${16 * scale}" ${paint}/>
      <path d="M${x - 28 * scale},${y + 62 * scale} C${x - 28 * scale},${y + 22 * scale} ${x + 28 * scale},${y + 22 * scale} ${x + 28 * scale},${y + 62 * scale} Z" ${paint}/>`;
  }

  /** Rennwagen von oben (Nase nach rechts) um den Ursprung. */
  function car() {
    return `<rect class="pg-fill" x="-48" y="-23" width="9" height="46" rx="2"/>
      <rect class="pg-car-tyre" x="-36" y="-27" width="20" height="11" rx="3"/>
      <rect class="pg-car-tyre" x="-36" y="16" width="20" height="11" rx="3"/>
      <rect class="pg-car-tyre" x="16" y="-26" width="18" height="10" rx="3"/>
      <rect class="pg-car-tyre" x="16" y="16" width="18" height="10" rx="3"/>
      <path class="pg-car-body" d="M-40,-10 L18,-8 L46,-3 L46,3 L18,8 L-40,10 Z"/>
      <ellipse class="pg-car-tyre" cx="-8" cy="0" rx="10" ry="5"/>
      <rect class="pg-fill" x="42" y="-25" width="7" height="50" rx="2"/>`;
  }

  /**
   * Pfeilspitze an (x, y) in Richtung angle (Bogenmaß).
   * @returns {string}
   */
  function arrowHead(x, y, angle) {
    const ax = -10 * Math.cos(angle - 0.45);
    const ay = -10 * Math.sin(angle - 0.45);
    const bx = -10 * Math.cos(angle + 0.45);
    const by = -10 * Math.sin(angle + 0.45);
    return `<path class="pg-fill" d="M${x},${y} l${ax.toFixed(1)},${ay.toFixed(1)} l${(bx - ax).toFixed(1)},${(by - ay).toFixed(1)} Z"/>`;
  }

  /** Doppelpfeil (Maßlinie). */
  function dimension(x1, y1, x2, y2) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    return `<path class="pg-lane" d="M${x1},${y1} L${x2},${y2}" stroke-width="2"/>${arrowHead(x2, y2, angle)}${arrowHead(x1, y1, angle + Math.PI)}`;
  }

  /** Programmfenster (weiß mit grauer Titelleiste). */
  function windowFrame(x, y, width, height) {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="#fff"/>
      <rect x="${x}" y="${y}" width="${width}" height="34" rx="12" fill="#e8e8e8"/>
      <rect x="${x}" y="${y + 22}" width="${width}" height="12" fill="#e8e8e8"/>`;
  }

  /** Mauszeiger (Spitze im Ursprung). */
  function cursor() {
    return `<g class="pg-cursor"><path d="M0,0 L0,26 L7,20 L12,31 L17,29 L12,18 L21,18 Z" fill="#fff" stroke="#1e1e1e" stroke-width="2" stroke-linejoin="round"/></g>`;
  }

  /** Teil erscheint (aufpoppen) zum Zeitpunkt; im Grundzustand sichtbar. */
  function pop(time) {
    return {
      frames: [
        [0, { o: 0, t: "scale(0)" }],
        [time, { o: 0, t: "scale(0)", e: "in" }],
        [time + 0.25, { o: 1, t: "scale(1.15)" }],
        [time + 0.4, { o: 1, t: "none" }],
      ],
    };
  }

  /** Teil wächst aus seinem Drehpunkt (scaleX oder scaleY) zum Zeitpunkt. */
  function grow(time, axis = "X", duration = 0.4) {
    return {
      frames: [
        [0, { t: `scale${axis}(0)` }],
        [time, { t: `scale${axis}(0)`, e: "in" }],
        [time + duration, { t: "none" }],
      ],
    };
  }

  /** Teil blendet ein. */
  function fadeIn(time, duration = 0.3) {
    return {
      frames: [
        [0, { o: 0 }],
        [time, { o: 0 }],
        [time + duration, { o: 1 }],
      ],
    };
  }

  /** Teil ist nur in einem Zeitfenster zu sehen (im Grundzustand unsichtbar). */
  function between(from, to) {
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

  /**
   * Mauszeiger, der nacheinander Punkte anklickt.
   * @param {Array<[number, number, number]>} stops  [Zeit, x, y] – Ankunft am Klickpunkt
   */
  function cursorPath(stops) {
    const frames = [
      [
        0,
        { o: 0, t: `translate(${stops[0][1] + 60}px, ${stops[0][2] + 60}px)` },
      ],
    ];
    frames.push([
      0.6,
      { o: 0, t: `translate(${stops[0][1] + 60}px, ${stops[0][2] + 60}px)` },
    ]);
    stops.forEach(([time, x, y], index) => {
      if (index === 0) {
        frames.push([time - 0.4, { o: 1, e: "ease-in-out" }]);
      }
      frames.push([time, { o: 1, t: `translate(${x}px, ${y}px)` }]);
      // Klick: kurz kleiner werden
      frames.push([
        time + 0.08,
        { t: `translate(${x}px, ${y}px) scale(0.85)` },
      ]);
      frames.push([
        time + 0.16,
        { t: `translate(${x}px, ${y}px)`, e: "ease-in-out" },
      ]);
    });
    const last = stops[stops.length - 1];
    frames.push(["X", { o: 1, t: `translate(${last[1]}px, ${last[2]}px)` }]);
    frames.push(["X+0.3", { o: 0 }]);
    frames.push(["E", { o: 0 }]);
    return { opacity: 0, frames };
  }

  /** Ganze Szene ein- und ausblenden. */
  const SCENE = {
    ".pg-scene": {
      frames: [
        [0, { o: 0 }],
        [0.3, { o: 1 }],
        ["E-0.4", { o: 1 }],
        ["E", { o: 0 }],
      ],
    },
  };

  /** Motiv anmelden. */
  function define(name, label, description, svg, motion) {
    registerPictogram(name, {
      label,
      description,
      viewBox: VIEWBOX,
      timing: TIMING,
      svg: () => `<g class="pg-scene">${svg()}</g>`,
      motion: { ...SCENE, ...motion },
    });
  }

  // ───────────────────────── Engineering Design ─────────────────────────

  define(
    "engineering-design",
    "Engineering Design: Konzept und Technik erklären",
    "Ein Rennwagen erscheint als Konstruktionszeichnung, eine dreiköpfige Jury tritt auf und fragt: Warum so gelöst?",
    () => {
      let grid = "";
      for (let x = 60; x < 460; x += 25) {
        grid += `<path d="M${x},112 L${x},358" stroke="#3a3360" stroke-width="1"/>`;
      }
      for (let y = 130; y < 360; y += 25) {
        grid += `<path d="M42,${y} L458,${y}" stroke="#3a3360" stroke-width="1"/>`;
      }
      const grey = 'class="pg-label-fill"';
      return `
        <g class="pg-board" style="${origin([250, 235])}"><rect x="40" y="110" width="420" height="250" rx="10" fill="#262626" stroke="${PURPLE}" stroke-width="2"/><g class="pg-grid">${grid}</g></g>
        <g class="pg-design-car" style="${origin([250, 235])}"><g transform="translate(250 235) scale(1.9)">${car()}</g></g>
        <g class="pg-dim-x" style="${origin([250, 330])}">${dimension(160, 330, 340, 330)}</g>
        <g class="pg-dim-y" style="${origin([420, 235])}">${dimension(420, 190, 420, 280)}</g>
        <g class="pg-juror-1" style="${origin([560, 280])}">${person(560, 250, grey)}</g>
        <g class="pg-juror-2" style="${origin([650, 280])}">${person(650, 250, 'class="pg-fill"')}</g>
        <g class="pg-juror-3" style="${origin([740, 280])}">${person(740, 250, grey)}</g>
        <g class="pg-bubble" style="${origin([590, 225])}"><path d="M500,175 C500,150 520,140 545,140 L700,140 C725,140 740,150 740,175 C740,200 725,210 700,210 L600,210 L585,232 L585,210 L545,210 C520,210 500,200 500,175 Z" fill="${PURPLE}"/>${text(620, 182, "Warum so gelöst?", 19, { fill: "#fff", anchor: "middle", bold: true })}</g>
        ${text(650, 345, "Jury", 18, { anchor: "middle" })}`;
    },
    {
      ".pg-board": pop(0.2),
      ".pg-grid": fadeIn(0.5, 0.4),
      ".pg-design-car": {
        frames: [
          [0, { o: 0, t: "translateX(-240px)" }],
          [0.7, { o: 0, t: "translateX(-240px)", e: "in" }],
          [1.4, { o: 1, t: "none" }],
        ],
      },
      ".pg-dim-x": grow(1.5, "X"),
      ".pg-dim-y": grow(1.7, "Y"),
      ".pg-juror-1": pop(2),
      ".pg-juror-2": {
        frames: [
          [0, { o: 0, t: "scale(0)" }],
          [2.2, { o: 0, t: "scale(0)", e: "in" }],
          [2.45, { o: 1, t: "scale(1.15)" }],
          [2.6, { o: 1, t: "none" }],
          [3.3, { t: "none" }],
          [3.45, { t: "translateY(4px)" }],
          [3.6, { t: "none" }],
          [3.75, { t: "translateY(4px)" }],
          [3.9, { t: "none" }],
        ],
      },
      ".pg-juror-3": pop(2.4),
      ".pg-bubble": pop(2.8),
    },
  );

  // ───────────────────────── Cost & Manufacturing ─────────────────────────

  const ROW_TIMES = [1, 1.45, 1.9, 2.35, 2.8];

  define(
    "cost-manufacturing",
    "Cost & Manufacturing: Kosten und Emissionen jedes Bauteils",
    "Eine Stückliste füllt sich Zeile für Zeile: jedes Bauteil mit Kosten in Euro und CO₂-Emissionen.",
    () => {
      const rows = [0, 1, 2, 3, 4]
        .map((index) => {
          const y = 195 + index * 34;
          return `<g class="pg-row pg-row-${index}">
            <circle cx="198" cy="${y - 6}" r="9" fill="none" stroke="${PURPLE}" stroke-width="4"/>
            <g class="pg-tick pg-tick-${index}" style="${origin([198, y - 6])}"><path d="M192,${y - 6} l4,5 l8,-10" fill="none" class="pg-lane" stroke-width="3"/></g>
            <g class="pg-bar-name-${index}" style="${origin([220, y - 7])}"><rect x="220" y="${y - 13}" width="${150 - (index % 3) * 25}" height="12" rx="6" fill="#8a8a8a"/></g>
            <g class="pg-bar-euro-${index}" style="${origin([440, y - 7])}"><rect x="440" y="${y - 13}" width="60" height="12" rx="6" fill="#8a8a8a"/></g>
            <g class="pg-bar-co2-${index}" style="${origin([550, y - 7])}"><rect x="550" y="${y - 13}" width="60" height="12" rx="6" fill="#8a8a8a"/></g>
          </g>`;
        })
        .join("");
      return `
        <g class="pg-sheet" style="${origin([400, 240])}">
          <rect x="150" y="100" width="500" height="270" rx="12" fill="#2b2b2b" class="pg-sheet-frame"/>
          <rect x="330" y="86" width="140" height="28" rx="8" class="pg-label-fill"/>
          ${text(190, 150, "Bauteil", 18, { cls: "pg-label-strong", bold: true })}
          ${text(470, 150, "€", 22, { cls: "pg-label-strong", anchor: "middle", bold: true })}
          ${text(580, 150, "CO₂", 20, { cls: "pg-label-strong", anchor: "middle", bold: true })}
          <path d="M180,165 L620,165" class="pg-label-line"/>
        </g>
        ${rows}`;
    },
    {
      ".pg-sheet": pop(0.2),
      ...Object.fromEntries(
        ROW_TIMES.flatMap((time, index) => [
          [`.pg-row-${index}`, fadeIn(time - 0.1, 0.2)],
          [`.pg-bar-name-${index}`, grow(time, "X", 0.35)],
          [`.pg-bar-euro-${index}`, grow(time + 0.15, "X", 0.3)],
          [`.pg-bar-co2-${index}`, grow(time + 0.25, "X", 0.3)],
          [`.pg-tick-${index}`, pop(time + 0.3)],
        ]),
      ),
    },
  );

  // ───────────────────────── Business Plan ─────────────────────────

  const BARS = [50, 80, 115, 160];

  define(
    "business-plan",
    "Business Plan: eine Geschäftsidee pitchen",
    "Eine Person präsentiert, die Balken eines Diagramms wachsen und eine Linie steigt nach oben.",
    () => `
      <g class="pg-screen" style="${origin([515, 225])}"><rect x="300" y="110" width="430" height="230" rx="10" fill="#2b2b2b" class="pg-sheet-frame"/></g>
      ${BARS.map((height, index) => `<g class="pg-chart-bar-${index}" style="${origin([372 + index * 70, 310])}"><rect x="${350 + index * 70}" y="${310 - height}" width="44" height="${height}" rx="4" fill="${PURPLE}"/></g>`).join("")}
      <g class="pg-trend"><path d="M360,270 L430,240 L500,205 L580,150 L655,132" class="pg-lane" stroke-width="5" fill="none" pathLength="1"/></g>
      <g class="pg-trend-head" style="${origin([668, 128])}"><path class="pg-fill" d="M672,128 l-17,-6 l3,14 Z"/></g>
      <g class="pg-presenter" style="${origin([180, 270])}">${person(180, 210, 'class="pg-fill"', 1.4)}</g>
      <g class="pg-pointer" style="${origin([214, 262])}"><path d="M214,262 L300,200" class="pg-lane" stroke-width="6"/></g>`,
    {
      ".pg-presenter": pop(0.2),
      ".pg-screen": pop(0.5),
      ".pg-chart-bar-0": grow(1.1, "Y", 0.35),
      ".pg-chart-bar-1": grow(1.4, "Y", 0.35),
      ".pg-chart-bar-2": grow(1.7, "Y", 0.35),
      ".pg-chart-bar-3": grow(2, "Y", 0.35),
      ".pg-trend .pg-lane": {
        dash: 0,
        frames: [
          [0, { d: 1 }],
          [2.4, { d: 1, e: "ease-out" }],
          [3.2, { d: 0 }],
        ],
      },
      ".pg-trend-head": pop(3.15),
      ".pg-pointer": {
        frames: [
          [0, { o: 0, t: "rotate(40deg)" }],
          [0.9, { o: 0, t: "rotate(40deg)" }],
          [1.1, { o: 1, t: "rotate(25deg)", e: "ease-in-out" }],
          [2.2, { t: "rotate(-5deg)", e: "ease-in-out" }],
          [3.2, { t: "none" }],
        ],
      },
    },
  );

  // ───────────────────────── Slack: Bestätigungscode ─────────────────────────

  const DIGITS = ["4", "8", "2", "9", "1", "7"];
  /** x-Position des Kästchens i. */
  function boxX(index) {
    return 395 + index * 54 + (index > 2 ? 24 : 0);
  }

  define(
    "bestaetigungscode",
    "Vereinfachte Darstellung: Code aus der E-Mail eingeben",
    "Eine E-Mail von Slack kommt an, der sechsstellige Code wird Kästchen für Kästchen eingetippt.",
    () => `
      <g class="pg-mail" style="${origin([145, 225])}">
        <rect x="50" y="160" width="190" height="130" rx="10" fill="none" class="pg-mail-line"/>
        <path d="M50,170 L145,240 L240,170" fill="none" class="pg-mail-line"/>
      </g>
      ${text(145, 325, "E-Mail von Slack", 18, { anchor: "middle" })}${text(145, 349, "mit deinem Code", 18, { anchor: "middle" })}
      <g class="pg-code-note" style="${origin([145, 190])}"><rect x="95" y="172" width="100" height="34" rx="6" fill="#fff"/>${text(145, 196, "482 917", 18, { fill: "#1e1e1e", anchor: "middle", bold: true })}</g>
      <g class="pg-mail-arrow" style="${origin([265, 225])}"><path d="M265,225 L318,225" class="pg-lane" stroke-width="5"/><path class="pg-fill" d="M330,225 l-14,-8 v16 Z"/></g>
      <g class="pg-code-window" style="${origin([555, 240])}">
        ${windowFrame(350, 110, 410, 260)}
        ${text(555, 195, "Code eingeben", 26, { fill: "#1e1e1e", anchor: "middle", bold: true })}
        ${DIGITS.map((_, index) => `<rect x="${boxX(index)}" y="225" width="44" height="58" rx="8" fill="#fff" stroke="#8a8a8a" stroke-width="2"/>`).join("")}
        <rect x="551" y="252" width="12" height="4" rx="2" fill="#8a8a8a"/>
        <g class="pg-focus" style="${origin([boxX(0) + 22, 254])}"><rect x="${boxX(0)}" y="225" width="44" height="58" rx="8" fill="none" stroke="${SLACK.blue}" stroke-width="3"/></g>
        ${DIGITS.map((digit, index) => `<g class="pg-digit pg-digit-${index}" style="${origin([boxX(index) + 22, 254])}">${text(boxX(index) + 22, 265, digit, 28, { fill: "#1e1e1e", anchor: "middle", bold: true })}</g>`).join("")}
        ${text(555, 325, "Code aus der E-Mail abtippen", 17, { fill: "#555", anchor: "middle" })}
        <g class="pg-done" style="${origin([730, 140])}"><circle cx="730" cy="140" r="16" fill="${SLACK.green}"/><path d="M722,140 l6,6 l10,-12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>
      </g>`,
    {
      ".pg-mail": {
        frames: [
          [0, { o: 0, t: "translateX(-80px)" }],
          [0.3, { o: 0, t: "translateX(-80px)", e: "in" }],
          [0.9, { o: 1, t: "none" }],
        ],
      },
      ".pg-code-window": pop(0.6),
      ".pg-code-note": {
        opacity: 0,
        frames: [
          [0, { o: 0, t: "none" }],
          [1.1, { o: 0, t: "none", e: "in" }],
          [1.3, { o: 1, t: "translateY(-30px)" }],
          [1.6, { o: 1, t: "translateY(-30px)", e: "ease-in-out" }],
          [2.1, { o: 0.9, t: "translate(410px, 30px) scale(0.6)" }],
          [2.2, { o: 0 }],
          ["E", { o: 0 }],
        ],
      },
      ".pg-mail-arrow": grow(1.6, "X", 0.3),
      // Blauer Rahmen springt von Kästchen zu Kästchen, Ziffern erscheinen.
      ".pg-focus": {
        frames: [
          [0, { o: 0 }],
          [2.1, { o: 1, t: "none" }],
          ...DIGITS.slice(1).map((_, index) => [
            2.4 + index * 0.25,
            { o: 1, t: `translateX(${boxX(index + 1) - boxX(0)}px)` },
          ]),
          [3.6, { o: 1, t: `translateX(${boxX(5) - boxX(0)}px)` }],
          [3.7, { o: 0 }],
          ["E", { o: 0 }],
        ],
      },
      ...Object.fromEntries(
        DIGITS.map((_, index) => [
          `.pg-digit-${index}`,
          pop(2.2 + index * 0.25),
        ]),
      ),
      ".pg-done": pop(3.75),
    },
  );

  // ───────────────────────── Slack: Profil ─────────────────────────

  define(
    "profil",
    "Vereinfachte Darstellung: Profilbild → Profil → Bearbeiten → Foto hochladen",
    "Ein Mauszeiger klickt nacheinander auf das Profilbild, auf Profil, auf Bearbeiten und auf Foto hochladen; dann erscheint das neue Foto.",
    () => `
      ${windowFrame(40, 100, 720, 280)}
      <rect x="40" y="134" width="70" height="246" fill="${SLACK.sidebar}"/><rect x="110" y="134" width="170" height="246" fill="${SLACK.panel}"/>
      ${[0, 1, 2, 3].map((index) => `<rect x="128" y="${160 + index * 34}" width="${110 - index * 12}" height="12" rx="6" fill="${SLACK.line}"/>`).join("")}
      <circle cx="75" cy="340" r="20" fill="#c9c9c9" class="pg-avatar-ring" stroke-width="4"/>
      <circle cx="75" cy="334" r="7" fill="#8a8a8a"/><path d="M62,352 C62,340 88,340 88,352 Z" fill="#8a8a8a"/>
      <g class="pg-menu" style="${origin([120, 350])}">
        <rect x="120" y="230" width="190" height="120" rx="10" fill="#fff" stroke="#8a8a8a" stroke-width="2"/>
        <rect x="128" y="240" width="174" height="34" rx="6" fill="${SLACK.blue}"/>
        ${text(144, 263, "Profil", 18, { fill: "#fff", bold: true })}${text(144, 300, "Einstellungen", 17, { fill: "#555" })}${text(144, 332, "Abmelden", 17, { fill: "#555" })}
      </g>
      <g class="pg-menu-arrow" style="${origin([318, 262])}"><path d="M318,262 L388,243" class="pg-lane"/><path class="pg-fill" d="M400,240 l-15,-3 l5,13 Z"/></g>
      <g class="pg-profile" style="${origin([580, 255])}">
        <rect x="420" y="150" width="320" height="210" rx="10" fill="#f6f6f6" stroke="#c9c9c9" stroke-width="2"/>
        <rect x="440" y="170" width="90" height="90" rx="10" fill="#c9c9c9"/>
        <circle cx="485" cy="203" r="18" fill="#8a8a8a"/><path d="M455,256 C455,226 515,226 515,256 Z" fill="#8a8a8a"/>
        <g class="pg-photo" style="${origin([485, 215])}"><rect x="440" y="170" width="90" height="90" rx="10" fill="${PURPLE}"/><circle cx="485" cy="203" r="18" class="pg-fill"/><path d="M455,256 C455,226 515,226 515,256 Z" class="pg-fill"/></g>
        ${text(548, 200, "Vorname Nachname", 18, { fill: "#1e1e1e", bold: true })}
        <rect x="548" y="214" width="150" height="10" rx="5" fill="#c9c9c9"/>
        <rect x="548" y="250" width="120" height="36" rx="8" fill="#fff" stroke="#8a8a8a" stroke-width="2"/>${text(608, 274, "Bearbeiten", 16, { fill: "#1e1e1e", anchor: "middle", bold: true })}
        <rect x="440" y="306" width="150" height="36" rx="8" fill="${SLACK.green}"/>${text(515, 330, "Foto hochladen", 16, { fill: "#fff", anchor: "middle", bold: true })}
      </g>
      ${badge(105, 310, "1")}${badge(300, 257, "2")}${badge(676, 250, "3")}${badge(598, 306, "4")}
      ${cursor()}`,
    {
      ".pg-badge-1": pop(1),
      ".pg-menu": pop(1.2),
      ".pg-badge-2": pop(1.75),
      ".pg-menu-arrow": grow(1.9, "X", 0.3),
      ".pg-profile": pop(2.1),
      ".pg-badge-3": pop(2.65),
      ".pg-badge-4": pop(3.15),
      ".pg-photo": pop(3.45),
      ".pg-cursor": cursorPath([
        [1, 80, 344],
        [1.75, 200, 258],
        [2.65, 620, 270],
        [3.15, 520, 326],
      ]),
    },
  );

  // ───────────────────────── Slack: Channels ─────────────────────────

  define(
    "channels",
    "Vereinfachte Darstellung: Home → Verzeichnisse → Channels → beitreten",
    "Ein Mauszeiger klickt auf Home, auf Verzeichnisse, auf den Reiter Channels und tritt einem Channel bei.",
    () => `
      ${windowFrame(40, 100, 720, 280)}
      <rect x="40" y="134" width="70" height="246" fill="${SLACK.sidebar}"/>
      <rect x="52" y="146" width="46" height="40" rx="8" fill="#6b3a6c"/><path d="M64,170 L75,158 L86,170 L86,180 L64,180 Z" fill="#fff"/>
      ${text(75, 204, "Home", 13, { fill: "#fff", anchor: "middle" })}
      <rect x="110" y="134" width="190" height="246" fill="${SLACK.panel}"/>
      <g class="pg-dir" style="${origin([205, 172])}"><rect x="120" y="156" width="170" height="32" rx="6" fill="${SLACK.blue}"/></g>
      ${text(134, 178, "Verzeichnisse", 17, { fill: "#fff", bold: true })}
      ${[0, 1, 2].map((index) => `<rect x="132" y="${214 + index * 30}" width="${120 - index * 15}" height="12" rx="6" fill="${SLACK.line}"/>`).join("")}
      <g class="pg-tabs">${text(330, 170, "Personen", 17, { fill: "#555" })}${text(440, 170, "Channels", 17, { fill: "#1e1e1e", bold: true })}</g>
      <g class="pg-tab-line" style="${origin([476, 180])}"><rect x="436" y="178" width="80" height="4" rx="2" fill="${SLACK.blue}"/></g>
      <g class="pg-list">${[
        "# 01_allgemein",
        "# 02_testfahrten",
        "# 03_workshops",
      ]
        .map((name, index) => {
          const y = 210 + index * 52;
          return `<g class="pg-item-${index}"><rect x="320" y="${y}" width="420" height="44" rx="8" fill="${index === 0 ? "#f2f2f2" : "#fff"}" stroke="#c9c9c9" stroke-width="1.5"/>${text(336, y + 28, name, 17, { fill: "#1e1e1e", bold: index === 0 })}</g>`;
        })
        .join("")}</g>
      <g class="pg-join" style="${origin([663, 232])}"><rect x="596" y="216" width="134" height="32" rx="6" fill="${SLACK.green}"/>${text(663, 237, "Beitreten", 15, { fill: "#fff", anchor: "middle", bold: true })}</g>
      <g class="pg-joined" style="${origin([663, 232])}"><rect x="596" y="216" width="134" height="32" rx="6" fill="#fff" stroke="${SLACK.green}" stroke-width="2"/>${text(663, 237, "✓ Beigetreten", 15, { fill: SLACK.green, anchor: "middle", bold: true })}</g>
      ${badge(104, 150, "1")}${badge(288, 172, "2")}${badge(530, 162, "3")}${badge(735, 214, "4")}
      ${cursor()}`,
    {
      ".pg-badge-1": pop(1),
      ".pg-dir": grow(1.5, "X", 0.3),
      ".pg-badge-2": pop(1.6),
      ".pg-tab-line": grow(2.15, "X", 0.25),
      ".pg-badge-3": pop(2.2),
      ".pg-item-0": fadeIn(2.35, 0.2),
      ".pg-item-1": fadeIn(2.45, 0.2),
      ".pg-item-2": fadeIn(2.55, 0.2),
      ".pg-join": pop(2.6),
      ".pg-badge-4": pop(2.95),
      ".pg-joined": between(3.25, 4.3),
      ".pg-cursor": cursorPath([
        [1, 78, 168],
        [1.6, 200, 175],
        [2.2, 478, 168],
        [2.95, 660, 236],
      ]),
    },
  );
})();
