/*
 * icons.js – kleine Symbole der Oberfläche als Inline-SVG
 *
 * Warum Inline-SVG statt Bilddateien? Inline-SVG übernimmt die Textfarbe (currentColor).
 * So ist dasselbe Häkchen auf gelbem Sektor schwarz und im Text hellgrau – ohne Varianten.
 *
 * Alle Symbole sind dekorativ (aria-hidden). Die Bedeutung steht IMMER zusätzlich als Text
 * daneben oder als versteckter Text für Screenreader. Ein Symbol allein trägt nie Information.
 *
 * Stil laut Designsystem: kräftige Linien mit runden Enden. Als Kachel (lila Fläche, gelber
 * Rand, gelbes Symbol) erscheinen sie über CSS – siehe .icon-button und .icon-tile in
 * css/components/icon-button.css.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neues Symbol: Eintrag in PATHS ergänzen (Pfaddaten für ein 24×24-Raster, Linienstil).
 *     Symbole für die Baustein-Palette des Editors liegen dagegen als Dateien in assets/icons/.
 */

(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  /** Pfaddaten im 24×24-Raster, gezeichnet als Linie (stroke), nicht als Fläche. */
  const PATHS = {
    check: "M4 12.5l5 5L20 6.5",
    cross: "M6 6l12 12M18 6L6 18",
    star: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z",
    refresh: "M19 8a8 8 0 1 0 1 6M19 3v5h-5",
    lock: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z",
    sun: "M12 4V2M12 22v-2M4 12H2M22 12h-2M6.3 6.3L4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
    menu: "M4 7h16M4 12h16M4 17h16",
    external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
    info: "M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
    warning: "M12 3L2 20h20L12 3zM12 10v4M12 17h.01",
    flag: "M5 21V4M5 4h13l-2 4 2 4H5",
    arrowUp: "M12 19V5M5.5 11.5L12 5l6.5 6.5",
    arrowDown: "M12 5v14M5.5 12.5L12 19l6.5-6.5",
  };

  /**
   * Erzeugt ein Symbol.
   * @param {keyof typeof PATHS} name
   * @param {string} [className]
   * @returns {SVGSVGElement}
   */
  function icon(name, className = "icon") {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.6");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", className);
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", PATHS[name] ?? "");
    svg.append(path);
    return svg;
  }

  EM.define("js/ui/icons.js", { icon });
})();
