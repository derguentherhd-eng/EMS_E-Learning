/*
 * safety-record.js – PDF-Nachweis „Sicherheitsunterweisung"
 *
 * Nach bestandenem Quiz eines Sicherheitskapitels (Kapitel mit dem Feld „freigegeben") kann man
 * einen Nachweis herunterladen: Name, Datum des Bestehens, Anzahl der Anläufe, bestes Ergebnis
 * und ein Prüfcode. Der Nachweis wird bei der Projektleitung abgegeben und dort unterschrieben.
 *
 * Erzeugt wird das PDF komplett im Browser (jsPDF, wie das Onboarding-Zertifikat). Schrift,
 * Logo und Prüfcode kommen aus js/course/certificate.js.
 *
 * Zusammenspiel: Die Anläufe zählt js/core/store.js (recordQuizResult); angezeigt wird der
 * Knopf von js/views/safety-record-view.js.
 *
 * Wenn du hier etwas ändern willst …
 *   – Texte und Aufbau des PDFs: buildSafetyRecordPdf().
 *   – Hinweis zur Abgabe: HANDOVER_NOTE.
 */

(function () {
  "use strict";

  /**
   * Seitenaufbau des PDFs in Millimetern (A4 hochkant). Alle y-Werte zählen von oben.
   * Wenn sich ein Abstand ändert, hier anpassen – nicht im Text von buildSafetyRecordPdf().
   */
  const LAYOUT = {
    pageWidth: 210,
    pageHeight: 297,
    margin: 20,
    // Kopfstreifen mit Logo und gelber Linie darunter
    headerHeight: 38,
    stripeHeight: 2,
    logoY: 5,
    logoWidth: 30,
    logoHeight: 28,
    headerTitleY: 18,
    headerTeamY: 25,
    // Titel, Bestätigung und Name
    titleY: 62,
    subtitleY: 71,
    confirmY: 90,
    nameY: 103,
    confirmDetailY: 114,
    // Angaben (Liste aus Beschriftung und Wert)
    factsY: 136,
    factsStep: 13,
    factsValueOffset: 5.5,
    // Hinweis zur Abgabe (gelbe Box)
    boxY: 207,
    boxHeight: 24,
    boxRadius: 2,
    boxPadding: 6,
    boxTitleOffset: 9,
    boxTextOffset: 16,
    // Unterschriftenlinien
    signY: 262,
    signGap: 10,
    signLabelOffset: 5,
  };

  const {
    createVerificationCode,
    formatGermanDate,
    loadFonts,
    loadJsPdf,
    rasterizeLogo,
    safeFileName,
    setupFonts,
  } = EM.require("js/course/certificate.js");

  /** Hinweis auf jedem Nachweis: wohin damit. */
  const HANDOVER_NOTE =
    "Bitte diesen Nachweis ausdrucken oder als PDF an die Projektleitung geben.";

  /**
   * @typedef {Object} SafetyRecordData
   * @property {string} name           Name der Person
   * @property {string} date           Datum des ersten Bestehens (JJJJ-MM-TT)
   * @property {number} attempts       Im wievielten Anlauf bestanden
   * @property {number} percent        Bestes Ergebnis in Prozent
   * @property {string} chapterTitle   z. B. „Arbeitssicherheit"
   * @property {number} chapterVersion Version des Kapitels
   * @property {string} team           z. B. „Einstein Motorsport"
   */

  /**
   * Dateiname, z. B. „Nachweis-Sicherheitsunterweisung-Kim-Beispiel-2026-10-13.pdf".
   * @param {string} name
   * @param {string} date  JJJJ-MM-TT
   * @returns {string}
   */
  function safetyRecordFileName(name, date) {
    return `Nachweis-Sicherheitsunterweisung-${safeFileName(name) || "Teilnehmende"}-${date}.pdf`;
  }

  /**
   * Zeichnet den Nachweis (A4 hoch).
   * @param {any} JsPDF  der jsPDF-Konstruktor
   * @param {SafetyRecordData} data
   * @param {import("./certificate.js").CertificateAssets} assets
   * @returns {any} das jsPDF-Dokument
   */
  function buildSafetyRecordPdf(JsPDF, data, assets) {
    const doc = new JsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });
    const font = setupFonts(doc, assets.fonts);
    const W = LAYOUT.pageWidth;
    const H = LAYOUT.pageHeight;
    const M = LAYOUT.margin;
    const YELLOW = [255, 237, 0];
    const PURPLE = [83, 68, 149];
    const DARK = [30, 30, 30];
    const GREY = [87, 87, 87];

    // ── Kopf: schwarzer Streifen mit Logo, wie Kopfleiste und Zertifikat ──
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, W, LAYOUT.headerHeight, "F");
    if (assets.logo) {
      doc.addImage(
        assets.logo,
        "PNG",
        M,
        LAYOUT.logoY,
        LAYOUT.logoWidth,
        LAYOUT.logoHeight,
      );
    }
    doc.setTextColor(255, 255, 255);
    font("bold");
    doc.setFontSize(16);
    doc.text("Nachweis", W - M, LAYOUT.headerTitleY, { align: "right" });
    font("regular");
    doc.setFontSize(10);
    doc.text(data.team, W - M, LAYOUT.headerTeamY, { align: "right" });
    doc.setFillColor(...YELLOW);
    doc.rect(0, LAYOUT.headerHeight, W, LAYOUT.stripeHeight, "F");

    // ── Titel und Bestätigung ──
    doc.setTextColor(...DARK);
    font("bold");
    doc.setFontSize(24);
    doc.text("Sicherheitsunterweisung", M, LAYOUT.titleY);
    font("medium");
    doc.setFontSize(13);
    doc.text(`Online-Unterweisung „${data.chapterTitle}“`, M, LAYOUT.subtitleY);

    font("regular");
    doc.setFontSize(12);
    doc.text("Hiermit wird bestätigt, dass", M, LAYOUT.confirmY);
    font("medium");
    doc.setFontSize(24);
    doc.text(data.name, M, LAYOUT.nameY, { maxWidth: W - 2 * M });
    font("regular");
    doc.setFontSize(12);
    doc.text(
      `die Sicherheitsunterweisung „${data.chapterTitle}“ am ${formatGermanDate(data.date)} erfolgreich abgeschlossen hat.`,
      M,
      LAYOUT.confirmDetailY,
      { maxWidth: W - 2 * M },
    );

    // ── Angaben ──
    const facts = [
      ["Abgeschlossen am", formatGermanDate(data.date)],
      [
        "Benötigte Anläufe",
        `${data.attempts} ${data.attempts === 1 ? "Anlauf" : "Anläufe"} bis zum Bestehen`,
      ],
      ["Bestes Ergebnis", `${data.percent} %`],
      ["Version der Unterweisung", String(data.chapterVersion)],
      [
        "Prüfcode",
        createVerificationCode(
          data.name,
          data.date,
          `S${data.chapterVersion}-${data.attempts}`,
        ),
      ],
    ];
    facts.forEach(([label, value], index) => {
      const y = LAYOUT.factsY + index * LAYOUT.factsStep;
      font("medium");
      doc.setFontSize(9);
      doc.setTextColor(...GREY);
      doc.text(label, M, y);
      font("regular");
      doc.setFontSize(12);
      doc.setTextColor(...DARK);
      doc.text(value, M, y + LAYOUT.factsValueOffset);
    });

    // ── Hinweis zur Abgabe (gelbe Fläche mit dunkler Schrift, wie der Hauptknopf) ──
    const boxY = LAYOUT.boxY;
    doc.setFillColor(...YELLOW);
    doc.setDrawColor(...PURPLE);
    doc.setLineWidth(0.5);
    doc.roundedRect(
      M,
      boxY,
      W - 2 * M,
      LAYOUT.boxHeight,
      LAYOUT.boxRadius,
      LAYOUT.boxRadius,
      "FD",
    );
    doc.setTextColor(...DARK);
    font("bold");
    doc.setFontSize(12);
    doc.text(
      "Bei der Projektleitung abgeben",
      M + LAYOUT.boxPadding,
      boxY + LAYOUT.boxTitleOffset,
    );
    font("regular");
    doc.setFontSize(10);
    doc.text(
      HANDOVER_NOTE,
      M + LAYOUT.boxPadding,
      boxY + LAYOUT.boxTextOffset,
      { maxWidth: W - 2 * M - 2 * LAYOUT.boxPadding },
    );

    // ── Unterschriften ──
    const signY = LAYOUT.signY;
    const half = (W - 2 * M - LAYOUT.signGap) / 2;
    doc.setDrawColor(...DARK);
    doc.setLineWidth(0.3);
    doc.line(M, signY, M + half, signY);
    doc.line(W - M - half, signY, W - M, signY);
    font("regular");
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.text(
      "Datum, Unterschrift Teilnehmerin/Teilnehmer",
      M,
      signY + LAYOUT.signLabelOffset,
    );
    doc.text(
      "Datum, Unterschrift Projektleitung",
      W - M - half,
      signY + LAYOUT.signLabelOffset,
    );

    // ── Fuß ──
    doc.setFontSize(8);
    doc.text(
      "Maschinenbezogene Einweisungen (z. B. Fräs- und Drehmaschine, Niedervolt-System) erfolgen zusätzlich vor Ort.",
      M,
      H - 12,
      { maxWidth: W - 2 * M },
    );
    doc.setFillColor(...YELLOW);
    doc.rect(0, H - 4, W, 4, "F");
    return doc;
  }

  /**
   * Erzeugt den Nachweis und startet den Download.
   * @param {SafetyRecordData} data
   * @param {string} logoPath
   * @returns {Promise<string>} Dateiname
   * @throws {Error} wenn jsPDF nicht geladen werden kann
   */
  async function downloadSafetyRecord(data, logoPath) {
    const JsPDF = await loadJsPdf();
    const [fonts, logo] = await Promise.all([
      loadFonts(),
      rasterizeLogo(logoPath),
    ]);
    const fileName = safetyRecordFileName(data.name, data.date);
    buildSafetyRecordPdf(JsPDF, data, { fonts, logo }).save(fileName);
    return fileName;
  }

  EM.define("js/course/safety-record.js", {
    buildSafetyRecordPdf,
    downloadSafetyRecord,
    safetyRecordFileName,
    HANDOVER_NOTE,
  });
})();
