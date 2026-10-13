/*
 * certificate.js – PDF-Zertifikat „Onboarding abgeschlossen"
 *
 * Ablauf beim Klick auf „Zertifikat herunterladen":
 *   1. jsPDF nachladen (vendor/jspdf/jspdf.umd.min.js). Die Bibliothek wird NUR hier geladen,
 *      nicht beim Kursstart – sie ist groß und wird nur einmal gebraucht.
 *   2. Schrift Lato laden (assets/fonts/pdf/lato-pdf.js, Base64 der TTF-Dateien) und einbetten. Die OFL-Lizenz
 *      erlaubt das. Dadurch erscheinen Umlaute und ß korrekt (Test: „Jürgen Weiß-Özdemir").
 *      Klappt das nicht, nimmt jsPDF Helvetica (Umlaute gehen dort auch, sehen aber anders aus).
 *   3. Logo (SVG) in ein Bild umwandeln, PDF zeichnen (A4 quer), herunterladen.
 * Lädt jsPDF nicht (Datei fehlt, alter Browser), zeigt die Zertifikatsseite eine
 * Druckansicht: „Drucken → Als PDF sichern" (Gestaltung in css/views/print.css).
 *
 * Prüfcode: ein kurzer Code aus Name, Datum und Kursversion (einfacher Hash). Er hilft beim
 * Zuordnen, ist aber NICHT fälschungssicher – dafür bräuchte es einen Server. Siehe
 * docs/ENTWICKLER.md, „Bekannte Grenzen".
 *
 * buildCertificatePdf() ist bewusst eine reine Funktion (bekommt jsPDF, Schriften und Logo
 * übergeben). So lässt sie sich auch außerhalb des Browsers testen.
 *
 * Wenn du hier etwas ändern willst …
 *   – Layout: buildCertificatePdf(). Maße in Millimetern, Ursprung oben links, A4 quer = 297 × 210.
 *   – Pflichthinweis zur Sicherheitsunterweisung: SAFETY_NOTE – nicht entfernen!
 */

(function () {
  "use strict";

  /** Pflichttext auf jedem Zertifikat (Arbeitsschutz). */
  const SAFETY_NOTE =
    "Diese Bestätigung ersetzt nicht die verpflichtende Sicherheitsunterweisung in der Werkstatt.";

  const JSPDF_PATH = "vendor/jspdf/jspdf.umd.min.js";
  const FONT_SCRIPT = "assets/fonts/pdf/lato-pdf.js";
  const FONTS = [
    { file: "Lato-Regular.ttf", family: "Lato", style: "normal" },
    { file: "Lato-Medium.ttf", family: "LatoMedium", style: "normal" },
    { file: "Lato-Bold.ttf", family: "Lato", style: "bold" },
  ];

  // ───────────────────────────── Prüfcode und Dateiname ─────────────────────────────

  const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // ohne I, L, O, U – nicht verwechselbar

  /**
   * Erzeugt den Prüfcode, z. B. „7K2M-QX9D". Gleiche Eingaben ergeben immer denselben Code.
   * NICHT fälschungssicher (siehe Dateikopf).
   * @param {string} name
   * @param {string} date           JJJJ-MM-TT
   * @param {string|number} version Kursversion
   * @returns {string}
   */
  function createVerificationCode(name, date, version) {
    const input = `${name.trim().replace(/\s+/g, " ").toLocaleLowerCase("de")}|${date}|${version}`;
    // Zwei FNV-1a-Durchläufe mit verschiedenen Startwerten → 64 Bit, davon 40 Bit = 8 Zeichen.
    function fnv(seed) {
      let hash = seed;
      for (const char of input) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
      return hash;
    }
    let bits = (BigInt(fnv(0x811c9dc5)) << 32n) | BigInt(fnv(0x01000193));
    let code = "";
    for (let i = 0; i < 8; i += 1) {
      code = CROCKFORD[Number(bits & 31n)] + code;
      bits >>= 5n;
    }
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  }

  /**
   * Macht aus einem Namen einen sicheren Dateinamen.
   * @param {string} name
   * @returns {string}  z. B. „Onboarding-Zertifikat-Juergen-Weiss-Oezdemir.pdf"
   */
  function certificateFileName(name) {
    const safe = name
      .trim()
      .replace(/Ä/g, "Ae")
      .replace(/Ö/g, "Oe")
      .replace(/Ü/g, "Ue")
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return `Onboarding-Zertifikat-${safe || "Teilnehmende"}.pdf`;
  }

  /**
   * Datum für das Zertifikat, z. B. „13. Oktober 2026".
   * @param {string} isoDate  JJJJ-MM-TT
   * @returns {string}
   */
  function formatGermanDate(isoDate) {
    const [year, month, day] = isoDate.split("-").map(Number);
    const months = [
      "Januar",
      "Februar",
      "März",
      "April",
      "Mai",
      "Juni",
      "Juli",
      "August",
      "September",
      "Oktober",
      "November",
      "Dezember",
    ];
    return `${day}. ${months[month - 1]} ${year}`;
  }

  // ───────────────────────────── PDF zeichnen ─────────────────────────────

  /**
   * @typedef {Object} CertificateData
   * @property {string} name
   * @property {string} date             JJJJ-MM-TT
   * @property {string} courseTitle      z. B. „Rookie-Onboarding"
   * @property {string} team             z. B. „Einstein Motorsport"
   * @property {string} title            z. B. „Onboarding abgeschlossen" (zertifikat-titel)
   * @property {string} version          Kursversion
   * @property {{number: number, title: string, best: boolean}[]} chapters  abgeschlossene Kapitel
   * @property {string} signatureName    leer = Unterschriftszeile ohne Namen
   * @property {string} signatureRole
   */

  /**
   * @typedef {Object} CertificateAssets
   * @property {{file: string, family: string, style: string, base64: string}[]} fonts  leer = Helvetica
   * @property {string|null} logo  PNG als Data-URL
   */

  /**
   * Zeichnet das Zertifikat.
   * @param {any} JsPDF  der jsPDF-Konstruktor (window.jspdf.jsPDF)
   * @param {CertificateData} data
   * @param {CertificateAssets} assets
   * @returns {any} das jsPDF-Dokument
   */
  function buildCertificatePdf(JsPDF, data, assets) {
    const doc = new JsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
      compress: true,
    });
    const hasLato = assets.fonts.length === FONTS.length;
    for (const embedded of assets.fonts) {
      doc.addFileToVFS(embedded.file, embedded.base64);
      doc.addFont(embedded.file, embedded.family, embedded.style);
    }
    // Schriftschnitte wie im Designsystem: Überschrift Bold, Unterüberschrift/Hervorhebung Medium.
    function font(weight) {
      if (!hasLato) {
        doc.setFont("helvetica", weight === "regular" ? "normal" : "bold");
      } else if (weight === "medium") {
        doc.setFont("LatoMedium", "normal");
      } else {
        doc.setFont("Lato", weight === "bold" ? "bold" : "normal");
      }
    }

    const W = 297;
    const H = 210;
    const M = 20; // Rand
    const YELLOW = [255, 237, 0];
    const PURPLE = [83, 68, 149];
    const GREY = [87, 87, 87];

    // ── Kopf: schwarzer Streifen wie Kopfleiste und Sektoranzeige im Kurs ──
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, W, 46, "F");
    if (assets.logo) {
      doc.addImage(assets.logo, "PNG", M, 6, 36, 34);
    }
    doc.setTextColor(255, 255, 255);
    font("bold");
    doc.setFontSize(20);
    doc.text(data.courseTitle, W - M, 20, { align: "right" });
    font("regular");
    doc.setFontSize(11);
    doc.text(data.team, W - M, 27, { align: "right" });

    // Sektoren als abgerundete Kacheln wie in der Sektoranzeige (gelb = bestanden,
    // lila mit gelbem Rand = Bestzeit)
    const count = Math.max(data.chapters.length, 1);
    const stripLeft = 70;
    const stripWidth = W - M - stripLeft;
    const gap = 1.5;
    const segment = (stripWidth - gap * (count - 1)) / count;
    data.chapters.forEach((chapter, index) => {
      const x = stripLeft + index * (segment + gap);
      doc.setFillColor(...(chapter.best ? PURPLE : YELLOW));
      doc.setDrawColor(...YELLOW);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, 33, segment, 6, 1.2, 1.2, chapter.best ? "FD" : "F");
    });

    // ── Titel und Name ──
    doc.setTextColor(30, 30, 30);
    font("bold");
    doc.setFontSize(32);
    doc.text(data.title, M, 70);
    font("regular");
    doc.setFontSize(13);
    doc.text("Hiermit bestätigen wir, dass", M, 84);
    font("medium");
    doc.setFontSize(30);
    doc.text(data.name, M, 98, { maxWidth: W - 2 * M });
    font("regular");
    doc.setFontSize(13);
    doc.text(
      `das ${data.courseTitle} von ${data.team} erfolgreich abgeschlossen hat.`,
      M,
      108,
      { maxWidth: W - 2 * M },
    );

    // ── Links: abgeschlossene Sektoren ──
    font("medium");
    doc.setFontSize(10);
    doc.text("Abgeschlossene Sektoren", M, 124);
    font("regular");
    doc.setFontSize(10);
    data.chapters.forEach((chapter, index) => {
      const y = 131 + index * 6;
      // Kachel wie in der Sektoranzeige; lila Kontur, weil Gelb auf Weiß kaum sichtbar ist.
      doc.setFillColor(...(chapter.best ? PURPLE : YELLOW));
      doc.setDrawColor(...PURPLE);
      doc.setLineWidth(0.3);
      doc.roundedRect(M, y - 3.2, 3.6, 3.6, 0.7, 0.7, "FD");
      doc.text(
        `S${chapter.number}  ${chapter.title}${chapter.best ? "  (Bestzeit)" : ""}`,
        M + 6,
        y,
      );
    });

    // ── Rechts: Datum, Version, Prüfcode ──
    const right = 190;
    const facts = [
      ["Datum", formatGermanDate(data.date)],
      ["Kursversion", String(data.version)],
      ["Prüfcode", createVerificationCode(data.name, data.date, data.version)],
    ];
    facts.forEach(([label, value], index) => {
      const y = 124 + index * 12;
      font("medium");
      doc.setFontSize(9);
      doc.setTextColor(...GREY);
      doc.text(label, right, y);
      font("regular");
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(value, right, y + 5.5);
    });

    // ── Unterschrift ──
    const signY = 178;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(right, signY, W - M, signY);
    font("medium");
    doc.setFontSize(10);
    if (data.signatureName) {
      doc.text(data.signatureName, right, signY + 5);
    }
    font("regular");
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.text(data.signatureRole, right, signY + (data.signatureName ? 10 : 5));

    // ── Pflichthinweis ──
    doc.setFillColor(...YELLOW);
    doc.rect(0, H - 4, W, 4, "F");
    doc.setTextColor(...GREY);
    font("regular");
    doc.setFontSize(8);
    doc.text(SAFETY_NOTE, M, H - 9);
    return doc;
  }

  // ───────────────────────────── Laden im Browser ─────────────────────────────

  /**
   * Lädt ein klassisches Skript nach (funktioniert auch ohne Server, anders als fetch).
   * @param {string} src
   * @returns {Promise<void>}
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.addEventListener("load", () => resolve());
      script.addEventListener("error", () =>
        reject(new Error(`${src} konnte nicht geladen werden`)),
      );
      document.head.append(script);
    });
  }

  /**
   * Lädt jsPDF einmalig nach.
   * @returns {Promise<any>} der jsPDF-Konstruktor
   */
  async function loadJsPdf() {
    if (!window.jspdf?.jsPDF) {
      await loadScript(JSPDF_PATH);
    }
    if (!window.jspdf?.jsPDF) {
      throw new Error("jsPDF nicht gefunden");
    }
    return window.jspdf.jsPDF;
  }

  /**
   * Lädt die Schrift Lato (Base64 aus assets/fonts/pdf/lato-pdf.js). Fehlt die Datei, nimmt das
   * PDF Helvetica.
   * @returns {Promise<CertificateAssets['fonts']>}
   */
  async function loadFonts() {
    try {
      if (!window.EM.pdfSchriften) {
        await loadScript(FONT_SCRIPT);
      }
      return FONTS.map((font) => {
        const base64 = window.EM.pdfSchriften?.[font.file];
        if (!base64) {
          throw new Error(font.file);
        }
        return { ...font, base64 };
      });
    } catch {
      return [];
    }
  }

  /**
   * Wandelt das SVG-Logo in ein PNG um (jsPDF kann kein SVG).
   *
   * Ohne Server würde ein Bild von der Festplatte die Zeichenfläche „sperren" (Browser-Sicherheit).
   * Deshalb wird das Logo dann aus der Offline-Datei (content/inhalte.js) als Daten-URL benutzt.
   * @param {string} path
   * @returns {Promise<string|null>}
   */
  function rasterizeLogo(path) {
    return new Promise((resolve) => {
      if (!path) {
        resolve(null);
        return;
      }
      const svgText = window.EM.inhalte?.dateien?.[path];
      const image = new Image();
      image.addEventListener("load", () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 720;
          canvas.height = Math.round(
            (720 * (image.naturalHeight || 1)) / (image.naturalWidth || 1),
          );
          canvas
            .getContext("2d")
            .drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(null); // Zertifikat dann ohne Logo
        }
      });
      image.addEventListener("error", () => resolve(null));
      image.src = svgText
        ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`
        : path;
    });
  }

  /**
   * Erzeugt das Zertifikat und startet den Download.
   * @param {CertificateData} data
   * @param {string} logoPath
   * @returns {Promise<void>}
   * @throws {Error} wenn jsPDF nicht geladen werden kann (→ Druckansicht anbieten)
   */
  async function downloadCertificate(data, logoPath) {
    const JsPDF = await loadJsPdf();
    const [fonts, logo] = await Promise.all([
      loadFonts(),
      rasterizeLogo(logoPath),
    ]);
    const doc = buildCertificatePdf(JsPDF, data, { fonts, logo });
    doc.save(certificateFileName(data.name));
  }

  EM.define("js/course/certificate.js", {
    createVerificationCode,
    certificateFileName,
    formatGermanDate,
    buildCertificatePdf,
    loadJsPdf,
    downloadCertificate,
    SAFETY_NOTE,
  });
})();
