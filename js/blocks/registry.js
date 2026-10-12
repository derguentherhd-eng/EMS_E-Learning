/*
 * registry.js – zentrale Liste aller Bausteine
 *
 * Jeder Baustein, der hier eingetragen ist,
 *   – wird in Inhaltsdateien erkannt (:::name …),
 *   – im Kurs dargestellt,
 *   – auf der Prüfseite geprüft und
 *   – erscheint AUTOMATISCH in der Baukasten-Palette des Editors.
 *
 * Zuordnung Baustein-Name (deutsch, im Inhaltsformat) → Modul (englisch, Code-Konvention):
 *   info, tipp, achtung → callouts.js     aufklappen  → details.js
 *   karten              → flashcards.js   zuordnen    → matching.js
 *   reihenfolge         → ordering.js     hotspot     → hotspot.js
 *   szenario            → scenario.js     ordner      → file-tree.js
 *   teams               → teams.js        zeitstrahl  → timeline.js
 *   checkliste          → checklist.js    quiz        → quiz-block.js
 *
 * Wenn du hier etwas ändern willst …
 *   – Neuen Baustein anlegen: js/blocks/_vorlage-baustein.js kopieren, ausfüllen, dann HIER
 *     eine import-Zeile und einen Eintrag in BLOCKS ergänzen. Schritt-für-Schritt-Anleitung:
 *     docs/ENTWICKLER.md, Abschnitt „Neuen Baustein anlegen".
 *   – Die Reihenfolge in BLOCKS ist die Reihenfolge in der Editor-Palette.
 */

import { createCallout } from './callouts.js';
import details from './details.js';
import quiz from './quiz-block.js';

/**
 * @typedef {Object} FieldSchema
 * @property {string} key           Schlüssel im Datenobjekt
 * @property {'text'|'markdown'|'number'|'select'|'boolean'|'image'|'list'} type
 * @property {string} label         Beschriftung im Formular
 * @property {string} [help]        Hilfetext unter dem Feld
 * @property {boolean} [required]
 * @property {string[]} [options]   Für 'select'
 * @property {FieldSchema[]} [itemFields]  Für 'list': Felder jedes Listeneintrags
 * @property {number} [min] @property {number} [max]  Zahlenbereich bzw. Anzahl Listeneinträge
 * @property {string} [itemLabel]   Für 'list': Name eines Eintrags, z. B. „Karte"
 */

/**
 * @typedef {Object} EditorSchema
 * @property {string} label         Name in der Baukasten-Palette, z. B. „Lernkarten"
 * @property {string} description   Ein Satz: wofür ist der Baustein gut?
 * @property {string} icon          Pfad zu einem kleinen SVG-Symbol
 * @property {() => any} createDefault  Startdaten für ein frisch eingefügtes Element
 * @property {FieldSchema[]} fields Formularfelder
 * @property {string} [customEditor]  Spezialeditor statt Formular ('quiz' oder 'hotspot')
 */

/**
 * @typedef {Object} BlockDefinition
 * @property {string} name           Name im Inhaltsformat, z. B. „karten"
 * @property {boolean} interactive   Zählt als Interaktion, die Denken verlangt (Didaktik-Prüfung)
 * @property {(raw: import('./block-utils.js').RawBlock) => {data: any, errors: Object[]}} parse
 *           Rohtext → Daten. Fehler mit severity 'fehler' sind Syntaxfehler: Der Abschnitt wird
 *           dann als „nicht lesbar" behandelt und unverändert erhalten.
 * @property {(data: any, raw: import('./block-utils.js').RawBlock) => Object[]} [validate]
 *           Inhaltliche Prüfung (Daten sind lesbar, aber z. B. unvollständig).
 * @property {(data: any, context: import('./block-utils.js').BlockContext) => HTMLElement} render
 * @property {(data: any) => string} serialize
 *           Daten → Kursdown. parse(serialize(data)) muss wieder dieselben Daten ergeben.
 * @property {EditorSchema} editor
 */

/** Alle Bausteine in Palettenreihenfolge. */
const BLOCKS = [
  createCallout('info'),
  createCallout('tipp'),
  createCallout('achtung'),
  details,
  quiz,
];

const byName = new Map(BLOCKS.map((block) => [block.name, block]));

/**
 * Sucht einen Baustein über seinen Namen.
 * @param {string} name
 * @returns {BlockDefinition|undefined}
 */
export function getBlock(name) {
  return byName.get(name);
}

/**
 * Alle Bausteine (z. B. für die Editor-Palette).
 * @returns {BlockDefinition[]}
 */
export function listBlocks() {
  return [...BLOCKS];
}
