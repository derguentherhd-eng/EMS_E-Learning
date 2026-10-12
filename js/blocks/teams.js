/*
 * teams.js – Baustein „teams": Team-Steckbriefe als aufklappbare Karten mit Filter
 *
 * Kursdown (ein Eintrag pro Team, beginnend mit „# Teamname"):
 *   :::teams Unsere Subteams
 *   # Chassis
 *   bereich: Technik
 *   kurz: Rahmen, Aerodynamik und alles, was das Auto zusammenhält.
 *   aufgaben: Konstruktion des Monocoques, Fertigung, Crashtests.
 *   passt-zu-dir-wenn: du gern mit CAD arbeitest und keine Angst vor Faserverbund hast.
 *   ansprechrolle: Teamleitung Chassis
 *   bild: assets/bilder/chassis.jpg
 *   bild-alt: Zwei Teammitglieder laminieren ein Bauteil.
 *   :::
 *
 * Felder: bereich (für den Filter), kurz, aufgaben, passt-zu-dir-wenn, ansprechrolle,
 * bild, bild-alt. Alle optional außer kurz. Unbekannte Felder bleiben beim Speichern erhalten.
 *
 * Bedienung: Filterknöpfe (aria-pressed) für die Bereiche, jede Karte ist ein <details>.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neues Feld: in FIELDS ergänzen (Reihenfolge = Reihenfolge in Datei und Karte).
 *   – Aussehen: Abschnitt „teams" in css/blocks.css.
 */

import { el } from '../dom.js';
import { blockError, blockSection, formatBlock, formatHeader, oneLine, parseEntries } from './block-utils.js';

/** Bekannte Felder: Schlüssel in der Datei → Beschriftung auf der Karte (null = nicht als Text zeigen). */
const FIELDS = [
  ['bereich', null],
  ['kurz', null],
  ['aufgaben', 'Aufgaben'],
  ['passt-zu-dir-wenn', 'Passt zu dir, wenn …'],
  ['ansprechrolle', 'Ansprechpartner*in'],
  ['bild', null],
  ['bild-alt', null],
];
const KNOWN = FIELDS.map(([key]) => key);

/**
 * @typedef {{name: string, fields: Object<string, string>}} Team
 * @typedef {{title: string, teams: Team[]}} TeamsData
 *   Die Felder stehen unter team.fields (Schlüssel wie in der Datei), damit unbekannte
 *   Felder verlustfrei erhalten bleiben.
 */

/** @type {import('./registry.js').BlockDefinition} */
export default {
  name: 'teams',
  interactive: true,

  parse(raw) {
    const { entries, errors } = parseEntries(raw.lines, raw);
    return { data: { title: raw.title, teams: entries.map((entry) => ({ name: entry.name, fields: entry.fields })) }, errors };
  },

  validate(data, raw) {
    const errors = [];
    if (data.teams.length === 0) errors.push(blockError(raw, raw.line, 'Es gibt keine Teams.', 'Beginne jeden Eintrag mit „# Teamname".'));
    for (const team of data.teams) {
      if (!team.fields.kurz) errors.push(blockError(raw, raw.line, `Bei „${team.name}" fehlt „kurz:".`, 'Ein Satz, was das Team macht.', 'warnung'));
      if (team.fields.bild && !team.fields['bild-alt']) {
        errors.push(blockError(raw, raw.line, `Das Bild von „${team.name}" hat keinen Alternativtext.`, 'Ergänze „bild-alt: Was ist auf dem Bild zu sehen?".'));
      }
      for (const key of Object.keys(team.fields)) {
        if (!KNOWN.includes(key)) {
          errors.push(blockError(raw, raw.line, `Unbekanntes Feld „${key}" bei „${team.name}" – es wird nicht angezeigt.`, `Bekannte Felder: ${KNOWN.join(', ')}.`, 'hinweis'));
        }
      }
    }
    return errors;
  },

  images(data) {
    return data.teams.map((team) => team.fields.bild).filter(Boolean);
  },

  /**
   * @param {TeamsData} data
   * @param {import('./block-utils.js').BlockContext} context
   */
  render(data, context) {
    const { section } = blockSection('teams', data.title, context, 'Teams');
    const areas = [...new Set(data.teams.map((team) => team.fields.bereich).filter(Boolean))];
    const count = el('p', { class: 'teams__count', 'aria-live': 'polite' }, teamCount(data.teams.length));

    const cards = data.teams.map((team) => {
      const fields = team.fields;
      const card = el(
        'li',
        { class: 'teams__item' },
        el(
          'details',
          { class: 'teams__card' },
          el(
            'summary',
            { class: 'teams__summary' },
            el('span', { class: 'teams__name' }, team.name),
            fields.bereich ? el('span', { class: 'teams__area' }, fields.bereich) : null,
            fields.kurz ? el('span', { class: 'teams__short' }, context.renderInline(fields.kurz, { plainGlossary: true })) : null,
          ),
          el(
            'div',
            { class: 'teams__body' },
            fields.bild ? el('img', { class: 'teams__image', src: fields.bild, alt: fields['bild-alt'] ?? '', loading: 'lazy' }) : null,
            el(
              'dl',
              { class: 'teams__facts' },
              FIELDS.filter(([key, label]) => label && fields[key]).map(([key, label]) => [el('dt', {}, label), el('dd', {}, context.renderInline(fields[key]))]),
            ),
          ),
        ),
      );
      return { team, card };
    });

    if (areas.length > 1) {
      const buttons = ['Alle', ...areas].map((area) =>
        el('button', { type: 'button', class: 'button button--small teams__filter', 'aria-pressed': String(area === 'Alle') }, area),
      );
      for (const button of buttons) {
        button.addEventListener('click', () => {
          const area = button.textContent;
          for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
          let visible = 0;
          for (const { team, card } of cards) {
            const match = area === 'Alle' || team.fields.bereich === area;
            card.hidden = !match;
            if (match) visible += 1;
          }
          count.textContent = teamCount(visible);
        });
      }
      section.append(el('div', { class: 'teams__filters', role: 'group', 'aria-label': 'Nach Bereich filtern' }, buttons));
    }
    section.append(count, el('ul', { class: 'teams__list' }, cards.map((entry) => entry.card)));
    return section;
  },

  /** @param {TeamsData} data */
  serialize(data) {
    const lines = [];
    data.teams.forEach((team, index) => {
      if (index > 0) lines.push('');
      lines.push(`# ${oneLine(team.name)}`);
      const keys = [...KNOWN.filter((key) => key in team.fields), ...Object.keys(team.fields).filter((key) => !KNOWN.includes(key))];
      for (const key of keys) {
        if (team.fields[key] !== undefined && team.fields[key] !== '') lines.push(`${key}: ${oneLine(team.fields[key])}`);
      }
    });
    return formatBlock(formatHeader('teams', data.title), lines);
  },

  editor: {
    label: 'Team-Steckbriefe',
    description: 'Aufklappbare Karten mit Aufgaben und Ansprechrolle je Team, filterbar nach Bereich.',
    icon: 'assets/icons/teams.svg',
    createDefault: () => ({
      title: 'Unsere Teams',
      teams: [{ name: 'Neues Team', fields: { bereich: 'Technik', kurz: 'Was macht das Team in einem Satz?' } }],
    }),
    fields: [
      { key: 'title', type: 'text', label: 'Überschrift' },
      {
        key: 'teams',
        type: 'list',
        label: 'Teams',
        itemLabel: 'Team',
        min: 1,
        itemFields: [
          { key: 'name', type: 'text', label: 'Teamname', required: true },
          { key: 'fields.bereich', type: 'text', label: 'Bereich (für den Filter)', help: 'z. B. Technik oder Organisation' },
          { key: 'fields.kurz', type: 'text', label: 'Kurzbeschreibung', required: true },
          { key: 'fields.aufgaben', type: 'text', label: 'Aufgaben' },
          { key: 'fields.passt-zu-dir-wenn', type: 'text', label: 'Passt zu dir, wenn …' },
          { key: 'fields.ansprechrolle', type: 'text', label: 'Ansprechrolle', help: 'Eine Rolle, keine Person – Namen ändern sich jede Saison.' },
          { key: 'fields.bild', type: 'image', label: 'Bild (optional)' },
          { key: 'fields.bild-alt', type: 'text', label: 'Alternativtext zum Bild' },
        ],
      },
    ],
  },
};

function teamCount(count) {
  return count === 1 ? '1 Team' : `${count} Teams`;
}
