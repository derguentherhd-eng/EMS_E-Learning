/*
 * tests-blocks.js – Selbsttests: Kapitelstruktur, Prüfung fehlerhafter Dateien, Bausteine (Parser und Round-Trip)
 *
 * Zusammenspiel: registriert beim Laden Testfälle über js/tests/test-utils.js;
 * ausgeführt und angezeigt werden sie von js/pages/tests.js.
 * Geprüfter Code: js/content/documents.js, serialize.js, validate.js, js/blocks/*.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Logik: einen test(...)-Block in der passenden group(...) ergänzen.
 *   – Neuer Baustein: in tests-blocks.js (BLOCK_SAMPLES) ein gültiges und ein
 *     ungültiges Beispiel ergänzen; Parser- und Round-Trip-Tests entstehen daraus.
 */

(function () {
  "use strict";

  const { normalizeText, parseBlockHeader, parseChapter } = EM.require(
    "js/content/documents.js",
  );
  const { serializeChapter, serializeElement } = EM.require(
    "js/content/serialize.js",
  );
  const { validateChapter } = EM.require("js/content/validate.js");
  const { getBlock, listBlocks } = EM.require("js/blocks/registry.js");
  const { escapePipes, splitPipes } = EM.require("js/blocks/block-utils.js");
  const {
    assert,
    assertEqual,
    assertChapterRoundTrip,
    group,
    parseSingleElement,
    stripVolatile,
    test,
  } = EM.require("js/tests/test-utils.js");

  // ───────────────────────────── Kapitelstruktur ─────────────────────────────

  group("Kapitelstruktur");

  const SAMPLE_CHAPTER = `---
titel: Test
kurztitel: T
dauer: 5
version: 2
unbekannt: bleibt
lernziele:
  - Ziel
---

## Seite eins

Absatz eins.

Absatz zwei.

![Ein Bild](assets/bilder/a.svg)

:::info Titel
Hinweis
:::

## Seite zwei

:::quiz anzahl=1
? Frage
- [x] Ja
- [ ] Nein
> Weil.
~ Seite eins
:::
`;

  test("Seiten, Elemente und Quiz werden erkannt", () => {
    const chapter = parseChapter(SAMPLE_CHAPTER, "07-test.md");
    assertEqual(chapter.id, "07-test");
    assertEqual(
      chapter.pages.map((page) => page.title),
      ["Seite eins", "Seite zwei"],
    );
    assertEqual(
      chapter.pages[0].elements.map((element) => element.type),
      ["text", "image", "block"],
    );
    assertEqual(
      chapter.pages[0].elements[0].markdown,
      "Absatz eins.\n\nAbsatz zwei.",
    );
    assertEqual(chapter.pages[1].elements, []);
    assertEqual(chapter.quiz?.data.questions.length, 1);
    assertEqual(chapter.meta.unbekannt, "bleibt");
  });

  test("Baustein-Kopfzeile: Titel und Attribute", () => {
    assertEqual(parseBlockHeader(' Unser Drive bild="a b.svg" x=1'), {
      title: "Unser Drive",
      attrs: { bild: "a b.svg", x: "1" },
    });
  });

  test("Windows-Zeilenenden und BOM werden vereinheitlicht", () => {
    assertEqual(normalizeText("\uFEFFa\r\nb\rc"), "a\nb\nc");
    assertChapterRoundTrip(SAMPLE_CHAPTER.replace(/\n/g, "\r\n"));
  });

  test("Round-Trip Beispielkapitel", () =>
    assertChapterRoundTrip(SAMPLE_CHAPTER));

  test("Unfertiges Bild ohne Pfad bleibt ein Bild-Element", () => {
    const text = "---\ntitel: X\n---\n\n## S\n\nText.\n\n![]()\n";
    const chapter = parseChapter(text, "x.md");
    assertEqual(
      chapter.pages[0].elements.map((element) => element.type),
      ["text", "image"],
    );
    assertChapterRoundTrip(text);
  });

  test("Unbekannter Baustein bleibt als nicht lesbarer Abschnitt erhalten", () => {
    const text =
      "---\ntitel: X\n---\n\n## S\n\n:::gibtsnicht Titel\nInhalt bleibt\n:::\n";
    const chapter = parseChapter(text, "x.md");
    const raw = chapter.pages[0].elements[0];
    assertEqual(raw.type, "raw");
    assertEqual(raw.text, ":::gibtsnicht Titel\nInhalt bleibt\n:::");
    assert(
      serializeChapter(chapter).includes(
        ":::gibtsnicht Titel\nInhalt bleibt\n:::",
      ),
      "Rohtext fehlt beim Speichern",
    );
  });

  test("Nicht geschlossener Baustein: Meldung mit Zeile, Inhalt bleibt erhalten", () => {
    const text = "---\ntitel: X\n---\n\n## S\n\n:::info\nOffen\n\nNoch Text\n";
    const chapter = parseChapter(text, "x.md");
    const raw = chapter.pages[0].elements[0];
    assertEqual(raw.type, "raw");
    assertEqual(raw.errors[0].line, 7);
    assert(
      serializeChapter(chapter).includes(":::info\nOffen\n\nNoch Text"),
      "Inhalt verloren",
    );
  });

  // ───────────────────────── Fehlerhafte Testdatei ─────────────────────────

  group("Prüfung einer absichtlich fehlerhaften Datei");

  const BROKEN_CHAPTER = [
    "---", //                                   1
    "titel: Kaputt", //                         2
    "dauer: viel", //                           3  ← keine Zahl
    "version: 1", //                            4
    "---", //                                   5
    "", //                                      6
    "## Seite", //                              7
    "", //                                      8
    "Begriff [[Gibtsnicht]] und ![](assets/bilder/x.svg)", // 9 ← Glossar, Alternativtext
    "", //                                      10
    ":::karten", //                             11 ← (noch) unbekannt oder kaputt
    "ohne Trenner", //                          12
    ":::", //                                   13
    "", //                                      14
    ":::quiz anzahl=3", //                      15 ← Pool zu klein
    "? Frage ohne richtige Antwort", //         16
    "- [ ] A", //                               17
    "- [ ] B", //                               18
    "~ Gibt es nicht", //                       19 ← Verweis falsch, Erklärung fehlt
    ":::", //                                   20
  ].join("\n");

  test("Meldungen haben Klartext und richtige Zeilennummern", () => {
    const chapter = parseChapter(BROKEN_CHAPTER, "99-kaputt.md");
    const errors = validateChapter(chapter, { glossary: [], meta: {} });
    function find(part) {
      return errors.find((error) => error.message.includes(part));
    }
    assertEqual(find("kurztitel")?.severity, "fehler", "kurztitel fehlt");
    assertEqual(find('„dauer: viel"')?.line, 1, "dauer ungültig");
    assertEqual(find("Gibtsnicht")?.line, 9, "Glossar");
    assertEqual(find("Alternativtext")?.line, 9, "Alternativtext");
    assertEqual(find("keine richtige Antwort")?.line, 16, "richtige Antwort");
    assertEqual(find("keine Erklärung")?.line, 16, "Erklärung");
    assertEqual(find("Gibt es nicht")?.line, 19, "Seitenverweis");
    assertEqual(find("anzahl=3")?.line, 15, "Pool");
    assert(
      errors.some((error) => error.line === 11 && error.severity === "fehler"),
      "Baustein Zeile 11",
    );
    assert(
      errors.every((error) => error.fix !== undefined),
      "Jede Meldung braucht einen Lösungsvorschlag",
    );
  });

  // ───────────────────────────── Bausteine ─────────────────────────────

  group("Bausteine: Trenner und Glossar");

  test("| innerhalb von [[Begriff|Text]] trennt keine Spalten", () => {
    assertEqual(
      splitPipes(
        "Herbst | Konzept | Ziele, [[Lastenheft|Lastenhefte]] schreiben",
      ),
      ["Herbst", "Konzept", "Ziele, [[Lastenheft|Lastenhefte]] schreiben"],
    );
    assertEqual(splitPipes("a \\| b | c"), ["a | b", "c"]);
  });

  test("Maskieren lässt Glossarbegriffe unverändert", () => {
    assertEqual(
      escapePipes("A|B [[Hochvolt|HV-Technik]]"),
      "A\\|B [[Hochvolt|HV-Technik]]",
    );
  });

  test("Zeitstrahl und Lernkarten: Glossar mit Anzeigetext bleibt beim Speichern gleich", () => {
    for (const text of [
      ":::zeitstrahl\nHerbst | Konzept | [[Lastenheft|Lastenhefte]] schreiben.\n:::",
      ":::karten\nElektro || Mit [[Hochvolt|Hochvolt-Technik]].\n:::",
    ]) {
      assertEqual(serializeElement(parseSingleElement(text)), text);
    }
  });

  group("Bausteine: Parser und Round-Trip");

  /**
   * Beispiele je Baustein: valid = gültiger Text (muss lesbar sein und den Round-Trip bestehen),
   * invalid = Text mit Syntaxfehler (muss als nicht lesbarer Abschnitt erhalten bleiben).
   * Bausteine ohne mögliche Syntaxfehler haben invalid: null.
   */
  const BLOCK_SAMPLES = {
    info: {
      valid:
        ":::info Titel\nText mit **fett** und [[Begriff]].\n\n- Liste\n:::",
      invalid: null,
    },
    tipp: { valid: ":::tipp\nEin Tipp.\n:::", invalid: null },
    achtung: {
      valid: ":::achtung Hochvolt\nNie ohne Freigabe.\n:::",
      invalid: null,
    },
    aufklappen: {
      valid: ":::aufklappen Mehr dazu\nVertiefung.\n:::",
      invalid: null,
    },
    karten: {
      valid: ":::karten Titel\nVorne || Hinten mit **fett**\nA \\| B || C\n:::",
      invalid: ":::karten\nohne Trenner\n:::",
    },
    zuordnen: {
      valid:
        ":::zuordnen Statisch oder dynamisch?\nSkidpad => Dynamisch | Das Auto fährt.\nCost => Statisch\n:::",
      invalid: ":::zuordnen\nSkidpad ohne Pfeil\n:::",
    },
    reihenfolge: {
      valid: ":::reihenfolge Frage\nEins\nZwei\nDrei\n> Weil.\n:::",
      invalid: null,
    },
    szenario: {
      valid:
        ":::szenario Öl am Boden\nDu siehst Öl.\n\nWas nun?\n- [ ] Ignorieren > Gefährlich.\n- [x] Absichern > Richtig, weil > sicher.\n:::",
      invalid:
        ":::szenario X\nSituation\n- [x] A > a\nText nach den Optionen\n:::",
    },
    hotspot: {
      valid:
        ':::hotspot Auto bild="assets/bilder/auto.svg" alt="Ein Auto"\n18% 62% | Vorderachse | Lenkung vorn.\n72.5% 40% | Akku\n:::',
      invalid: ':::hotspot bild="a.svg" alt="x"\nlinks oben | Titel\n:::',
    },
    ordner: {
      valid:
        ":::ordner Drive\n- 📁 01 Organisation | Protokolle\n  - 📁 Protokolle\n    - 📄 2026-10-01 Teamsitzung\n- 02 Technik\n  - Chassis\n? Wo liegen Protokolle? => 01 Organisation/Protokolle\n:::",
      invalid: ":::ordner\nkein Listeneintrag\n:::",
    },
    teams: {
      valid:
        ":::teams Unsere Teams\n# Chassis\nbereich: Technik\nkurz: Rahmen.\nunbekannt: bleibt\n\n# Marketing\nbereich: Organisation\nkurz: Sichtbarkeit.\n:::",
      invalid: ":::teams\nkurz: ohne Teamname\n:::",
    },
    zeitstrahl: {
      valid:
        ":::zeitstrahl Saison\nHerbst | Konzept | Ideen.\nWinter | Konstruktion\n:::",
      invalid: ":::zeitstrahl\nOhne Trenner\n:::",
    },
    checkliste: {
      valid: ":::checkliste Start\n- [ ] Eins\n- [ ] Zwei\n:::",
      invalid: ":::checkliste\nEins\n:::",
    },
    quiz: {
      valid:
        ":::quiz anzahl=1\n? Frage | mit Pipe\n- [x] Ja\n- [ ] Nein\n> Erklärung\n> zweite Zeile\n~ Seite\n\n?! Kritisch\n- [ ] A\n- [x] B\n- [x] C\n> Weil\n:::",
      invalid: ":::quiz anzahl=1\n- [x] Antwort ohne Frage\n:::",
    },
  };

  for (const block of listBlocks()) {
    const sample = BLOCK_SAMPLES[block.name];
    test(`${block.name}: Beispiel vorhanden`, () =>
      assert(
        sample,
        `In BLOCK_SAMPLES fehlt ein Beispiel für „${block.name}"`,
      ));
    if (!sample) {
      continue;
    }

    test(`${block.name}: gültiges Beispiel wird gelesen`, () => {
      const element = parseSingleElement(sample.valid);
      assertEqual(
        element.type,
        "block",
        `Fehler: ${JSON.stringify(element.errors ?? [])}`,
      );
    });

    test(`${block.name}: Round-Trip`, () => {
      const element = parseSingleElement(sample.valid);
      const again = parseSingleElement(serializeElement(element));
      assertEqual(stripVolatile(again), stripVolatile(element));
    });

    test(`${block.name}: Round-Trip der Startdaten aus dem Editor`, () => {
      const data = block.editor.createDefault();
      const element = parseSingleElement(getBlock(block.name).serialize(data));
      assertEqual(stripVolatile(element.data), stripVolatile(data));
    });

    if (sample.invalid) {
      test(`${block.name}: ungültiges Beispiel → nicht lesbarer Abschnitt mit Zeile`, () => {
        const element = parseSingleElement(sample.invalid);
        assertEqual(element.type, "raw");
        assert(
          element.errors.length > 0 && element.errors[0].line > 0,
          "Meldung mit Zeilennummer fehlt",
        );
        assertEqual(element.text, sample.invalid);
      });
    }

    test(`${block.name}: Editor-Schema vollständig`, () => {
      const schema = block.editor;
      assert(
        schema.label && schema.description && schema.icon,
        "label, description und icon sind Pflicht",
      );
      assert(Array.isArray(schema.fields), "fields fehlt");
      assert(typeof schema.createDefault === "function", "createDefault fehlt");
    });
  }

  EM.define("js/tests/tests-blocks.js", {});
})();
