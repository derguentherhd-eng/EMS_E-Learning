/*
 * hotspot.js – Baustein „hotspot": Bild mit anklickbaren Punkten
 *
 * Kursdown (Position in Prozent von links und von oben, dann Titel und Erklärung):
 *   :::hotspot Die wichtigsten Baugruppen bild="assets/bilder/fahrzeug.svg" alt="Schematische Seitenansicht eines Rennwagens"
 *   18% 62% | Vorderachse | Lenkung und Radaufhängung vorn.
 *   72% 40% | Akku | Herz des Elektroautos – Hochvolt!
 *   :::
 *
 * Bedienung: Die Punkte auf dem Bild sind nummerierte Knöpfe. Unter dem Bild steht dieselbe
 * Information als Liste zum Aufklappen – so ist alles auch ohne Bild (Screenreader) und ohne
 * genaues Zielen (Handy) erreichbar. Knopf auf dem Bild und Listeneintrag sind gekoppelt.
 *
 * Im Editor gibt es einen Spezialeditor (js/editor/hotspot-editor.js): Punkte per Klick setzen.
 *
 * Wenn du hier etwas ändern willst …
 *   – Aussehen: Abschnitt „hotspot" in css/blocks.css.
 */

(function () {
  'use strict';

const { el } = EM.require('js/dom.js');
const { blockError, blockSection, escapePipes, formatBlock, formatHeader, splitPipes, trimLines } = EM.require('js/blocks/block-utils.js');

/**
 * @typedef {{x: number, y: number, title: string, text: string}} HotspotPoint
 * @typedef {{title: string, image: string, alt: string, points: HotspotPoint[]}} HotspotData
 */

const POINT = /^(\d+(?:\.\d+)?)\s*%\s+(\d+(?:\.\d+)?)\s*%\s*\|(.*)$/;

/** @type {import('./registry.js').BlockDefinition} */
const definition = {
  name: 'hotspot',
  interactive: true,

  parse(raw) {
    const errors = [];
    const points = [];
    for (const { text, line } of trimLines(raw.lines)) {
      const trimmed = text.trim();
      if (trimmed === '') continue;
      const match = trimmed.match(POINT);
      if (!match) {
        errors.push(blockError(raw, line, `Diese Zeile verstehe ich nicht: „${trimmed}"`, 'Format: „35% 60% | Titel | Erklärung" – zuerst Abstand von links, dann von oben, jeweils in Prozent.'));
        continue;
      }
      const [title = '', ...rest] = splitPipes(match[3]);
      points.push({ x: Number(match[1]), y: Number(match[2]), title, text: rest.join(' | ') });
    }
    return { data: { title: raw.title, image: raw.attrs.bild ?? '', alt: raw.attrs.alt ?? '', points }, errors };
  },

  validate(data, raw) {
    const errors = [];
    if (!data.image) errors.push(blockError(raw, raw.line, 'Es ist kein Bild angegeben.', 'Ergänze in der Kopfzeile bild="assets/bilder/…".'));
    if (!data.alt) errors.push(blockError(raw, raw.line, 'Der Alternativtext fehlt.', 'Ergänze in der Kopfzeile alt="Beschreibung des Bildes".'));
    if (data.points.length === 0) errors.push(blockError(raw, raw.line, 'Es gibt keine Punkte.', 'Ergänze Zeilen der Form „35% 60% | Titel | Erklärung".'));
    data.points.forEach((point, index) => {
      if (point.x > 100 || point.y > 100) {
        errors.push(blockError(raw, raw.line, `Punkt ${index + 1} liegt außerhalb des Bildes (${point.x}% ${point.y}%).`, 'Werte zwischen 0 und 100 verwenden.'));
      }
      if (!point.title) errors.push(blockError(raw, raw.line, `Punkt ${index + 1} hat keinen Titel.`, 'Schreibe nach den Prozentwerten „| Titel | Erklärung".'));
    });
    return errors;
  },

  /** Bildpfade dieses Bausteins (für die Prüfung, ob die Datei existiert). */
  images(data) {
    return data.image ? [data.image] : [];
  },

  /**
   * @param {HotspotData} data
   * @param {import('./block-utils.js').BlockContext} context
   */
  render(data, context) {
    const { section } = blockSection('hotspot', data.title, context, 'Bild mit Erklärpunkten');
    const stage = el('div', { class: 'hotspot__stage' }, el('img', { class: 'hotspot__image', src: data.image, alt: data.alt, loading: 'lazy' }));
    const list = el('ol', { class: 'hotspot__list' });

    const entries = data.points.map((point, index) => {
      const panelId = context.uid('hotspot');
      const marker = el('button', { type: 'button', class: 'hotspot__marker', 'aria-expanded': 'false', 'aria-controls': panelId, 'aria-label': `${index + 1}: ${point.title}` }, String(index + 1));
      // Position als CSS-Variablen; das eigentliche Layout steht in blocks.css.
      marker.style.setProperty('--x', `${point.x}%`);
      marker.style.setProperty('--y', `${point.y}%`);
      const toggle = el('button', { type: 'button', class: 'hotspot__toggle', 'aria-expanded': 'false', 'aria-controls': panelId }, el('span', { class: 'hotspot__number', 'aria-hidden': 'true' }, String(index + 1)), context.renderInline(point.title, { plainGlossary: true }));
      const panel = el('div', { class: 'hotspot__panel', id: panelId, hidden: true }, el('p', {}, context.renderInline(point.text)));
      stage.append(marker);
      list.append(el('li', { class: 'hotspot__item' }, toggle, panel));
      return { marker, toggle, panel };
    });

    const setOpen = (entry, open) => {
      entry.panel.hidden = !open;
      entry.marker.setAttribute('aria-expanded', String(open));
      entry.toggle.setAttribute('aria-expanded', String(open));
      entry.marker.classList.toggle('is-active', open);
    };

    for (const entry of entries) {
      entry.toggle.addEventListener('click', () => setOpen(entry, entry.panel.hidden));
      // Klick auf den Punkt im Bild: Erklärung öffnen und in der Liste zeigen.
      entry.marker.addEventListener('click', () => {
        const open = entry.panel.hidden;
        setOpen(entry, open);
        if (open) entry.panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }

    section.append(
      el('p', { class: 'block__hint' }, 'Tippe auf die Nummern im Bild oder öffne die Punkte in der Liste.'),
      el('figure', { class: 'hotspot__figure' }, stage),
      list,
    );
    return section;
  },

  /** @param {HotspotData} data */
  serialize(data) {
    const lines = data.points.map((point) => `${round(point.x)}% ${round(point.y)}% | ${escapePipes(point.title)}${point.text ? ` | ${escapePipes(point.text)}` : ''}`);
    return formatBlock(formatHeader('hotspot', data.title, [['bild', data.image], ['alt', data.alt]]), lines);
  },

  editor: {
    label: 'Bild mit Punkten',
    description: 'Bild mit nummerierten Punkten, die beim Antippen eine Erklärung zeigen.',
    icon: 'assets/icons/hotspot.svg',
    customEditor: 'hotspot',
    createDefault: () => ({
      title: '',
      image: '',
      alt: '',
      points: [{ x: 50, y: 50, title: 'Punkt 1', text: 'Erklärung zu Punkt 1.' }],
    }),
    fields: [
      { key: 'title', type: 'text', label: 'Überschrift' },
      { key: 'image', type: 'image', label: 'Bild', required: true },
      { key: 'alt', type: 'text', label: 'Alternativtext (was ist zu sehen?)', required: true },
      {
        key: 'points',
        type: 'list',
        label: 'Punkte',
        itemLabel: 'Punkt',
        min: 1,
        itemFields: [
          { key: 'x', type: 'number', label: 'Von links (%)', min: 0, max: 100 },
          { key: 'y', type: 'number', label: 'Von oben (%)', min: 0, max: 100 },
          { key: 'title', type: 'text', label: 'Titel', required: true },
          { key: 'text', type: 'text', label: 'Erklärung' },
        ],
      },
    ],
  },
};

/** Prozentwerte auf eine Nachkommastelle runden (Klick im Editor liefert krumme Werte). */
function round(value) {
  return String(Math.round(Number(value) * 10) / 10);
}

EM.define('js/blocks/hotspot.js', { default: definition });
})();
