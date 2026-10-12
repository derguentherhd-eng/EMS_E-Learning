/*
 * _vorlage-baustein.js – kommentierte VORLAGE für einen neuen Baustein
 *
 * Diese Datei ist nicht eingebunden. Sie zeigt an einem kleinen Beispiel („merksatz": ein
 * hervorgehobener Satz mit optionaler Quelle), wie ein Baustein aufgebaut ist.
 *
 * ── So legst du einen neuen Baustein an ──────────────────────────────────────────────────
 *  1. Diese Datei kopieren und umbenennen, z. B. js/blocks/key-sentence.js
 *     (Dateiname englisch, Baustein-Name im Inhalt deutsch – siehe registry.js).
 *  2. Unten alle Stellen mit „ANPASSEN" ausfüllen.
 *  3. In js/blocks/registry.js eine import-Zeile und einen Eintrag in BLOCKS ergänzen.
 *     → Der Baustein funktioniert jetzt im Kurs, wird geprüft und erscheint im Editor.
 *  4. Aussehen: in css/blocks.css einen Abschnitt „merksatz" mit Klassen .key-sentence…
 *  5. Symbol für die Editor-Palette: assets/icons/merksatz.svg (24×24, eine Farbe).
 *  6. In js/tests.js in BLOCK_SAMPLES ein gültiges und (falls möglich) ein ungültiges Beispiel
 *     ergänzen → tests.html prüft Parser und Round-Trip automatisch.
 *  7. In docs/BAUSTEINE.md einen Abschnitt mit Kopiervorlage schreiben.
 * Ausführlich mit Erklärungen: docs/ENTWICKLER.md, „Neuen Baustein anlegen".
 *
 * ── Die vier Pflichtteile ────────────────────────────────────────────────────────────────
 *  parse      Text aus der Datei → Daten (+ Syntaxfehler mit Zeilennummer)
 *  render     Daten → HTML-Elemente für den Kurs (nur über el(), nie innerHTML!)
 *  serialize  Daten → Text für die Datei. Muss zu parse passen: parse(serialize(d)) = d
 *  editor     Beschreibung für den Editor: Name, Symbol, Startdaten, Formularfelder
 * Optional: validate (inhaltliche Prüfung), images (Bildpfade für die Existenzprüfung).
 *
 * Kursdown dieses Beispiels:
 *   :::merksatz Quelle: Werkstattordnung
 *   Wer allein arbeitet, arbeitet nicht.
 *   :::
 */

import { el } from '../dom.js';
import { blockError, formatBlock, formatHeader, joinLines } from './block-utils.js';

/**
 * Form der Daten dieses Bausteins. ANPASSEN.
 * @typedef {{source: string, sentence: string}} KeySentenceData
 */

/** @type {import('./registry.js').BlockDefinition} */
export default {
  // ANPASSEN: Name, wie er nach ::: in den Inhaltsdateien steht. Kleinbuchstaben, deutsch.
  name: 'merksatz',

  // ANPASSEN: true, wenn der Baustein zum Nachdenken/Handeln auffordert (zuordnen,
  // entscheiden …). Die Prüfung zählt diese Bausteine (mindestens zwei pro Kapitel).
  interactive: false,

  /**
   * Liest den Baustein.
   * raw.title  = Text nach dem Namen in der Kopfzeile
   * raw.attrs  = Attribute aus der Kopfzeile, z. B. { bild: 'assets/…' }
   * raw.lines  = Zeilen dazwischen als { text, line }
   * Fehler mit severity 'fehler' sind Syntaxfehler: Der Abschnitt bleibt dann unverändert
   * erhalten und erscheint im Editor als „nicht lesbar". Alles andere besser in validate().
   * @param {import('./block-utils.js').RawBlock} raw
   */
  parse(raw) {
    return { data: { source: raw.title, sentence: joinLines(raw.lines) }, errors: [] };
  },

  /**
   * Inhaltliche Prüfung (optional). Meldungen erscheinen auf der Prüfseite und im Editor.
   * @param {KeySentenceData} data
   */
  validate(data, raw) {
    if (data.sentence === '') {
      return [blockError(raw, raw.line, 'Der Merksatz ist leer.', 'Schreibe den Satz zwischen Kopfzeile und :::.')];
    }
    return [];
  },

  /**
   * Baut die Darstellung. context bietet u. a.:
   *   context.renderInline(text)   – eine Zeile mit **fett**, [[Glossar]] … darstellen
   *   context.renderMarkdown(text) – mehrere Absätze darstellen
   *   context.uid('präfix')        – eindeutige ID für label/aria-controls
   *   context.store / chapterId    – Fortschritt speichern (siehe checklist.js)
   * @param {KeySentenceData} data
   * @param {import('./block-utils.js').BlockContext} context
   */
  render(data, context) {
    return el(
      'figure',
      { class: 'key-sentence' },
      el('blockquote', { class: 'key-sentence__text' }, el('p', {}, context.renderInline(data.sentence))),
      data.source ? el('figcaption', { class: 'key-sentence__source' }, data.source) : null,
    );
  },

  /**
   * Schreibt den Baustein zurück. formatHeader(name, titel, [[attr, wert], …]) baut die
   * Kopfzeile, formatBlock fügt Inhalt und die Schlusszeile ::: an.
   * @param {KeySentenceData} data
   */
  serialize(data) {
    return formatBlock(formatHeader('merksatz', data.source), data.sentence.split('\n'));
  },

  /**
   * Beschreibung für den Editor. Aus `fields` baut der Editor automatisch das Formular.
   * Feldtypen: text, markdown, number, select (mit options), boolean, image, list (mit
   * itemFields). Für Listen aus reinen Texten: itemFields mit genau einem Feld, key 'value'.
   * Verschachtelte Werte erreicht man mit Punkt: key: 'fields.kurz'.
   */
  editor: {
    label: 'Merksatz',
    description: 'Ein einzelner Satz, der hängen bleiben soll.',
    icon: 'assets/icons/merksatz.svg',
    createDefault: () => ({ source: '', sentence: 'Der Satz, der hängen bleiben soll.' }),
    fields: [
      { key: 'sentence', type: 'text', label: 'Merksatz', required: true },
      { key: 'source', type: 'text', label: 'Quelle (optional)' },
    ],
  },
};
