/*
 * hotspot-editor.js – Spezialeditor für den Baustein „hotspot" (Bild mit Punkten)
 *
 * Bedienung:
 *   – Klick aufs Bild setzt einen neuen Punkt (Prozentwerte werden berechnet).
 *   – Punkte lassen sich ziehen (Maus/Touch) oder – ohne Maus – auswählen und mit den
 *     Pfeiltasten verschieben (1 %, mit Umschalttaste 5 %).
 *   – Darunter stehen alle Punkte zusätzlich als Formular mit Zahlenfeldern für x/y.
 *
 * Wenn du hier etwas ändern willst …
 *   – Darstellung im Kurs: js/blocks/hotspot.js. Hier geht es nur ums Bearbeiten.
 */

(function () {
  'use strict';

const { el } = EM.require('js/dom.js');
const { renderFields } = EM.require('js/editor/field-renderers.js');

/** Prozentwert auf eine Nachkommastelle begrenzen (so wird er auch gespeichert). */
const clampPercent = (value) => Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;

/**
 * @param {import('../blocks/hotspot.js').HotspotData} data
 * @param {import('./field-renderers.js').FieldContext} context
 * @param {import('../blocks/registry.js').FieldSchema[]} fields  Schema des Bausteins
 * @returns {HTMLElement}
 */
function renderHotspotEditor(data, context, fields) {
  const baseFields = fields.filter((field) => field.key !== 'points');
  const pointField = fields.find((field) => field.key === 'points');

  const stage = el('div', { class: 'hotspot-editor__stage' });
  if (data.image) {
    const image = el('img', { src: context.imageUrl(data.image), alt: '', class: 'hotspot-editor__image', draggable: 'false' });
    stage.append(image);

    // Klick aufs Bild: neuen Punkt anlegen.
    image.addEventListener('click', (event) => {
      const rect = image.getBoundingClientRect();
      const x = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
      const y = clampPercent(((event.clientY - rect.top) / rect.height) * 100);
      context.change(() => data.points.push({ x, y, title: `Punkt ${data.points.length + 1}`, text: '' }), { structural: true });
    });

    data.points.forEach((point, index) => {
      const marker = el('button', {
        type: 'button',
        id: `${context.idPrefix}-marker-${index}`,
        class: 'hotspot-editor__marker',
        'aria-label': `Punkt ${index + 1}: ${point.title} (${point.x} % / ${point.y} %) – mit Pfeiltasten verschieben`,
      }, String(index + 1));
      const place = () => {
        marker.style.setProperty('--x', `${point.x}%`);
        marker.style.setProperty('--y', `${point.y}%`);
      };
      place();

      // Tastatur: Pfeiltasten verschieben den Punkt.
      marker.addEventListener('keydown', (event) => {
        const step = event.shiftKey ? 5 : 1;
        const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
        if (!delta) return;
        event.preventDefault();
        context.change(() => {
          point.x = clampPercent(point.x + delta[0]);
          point.y = clampPercent(point.y + delta[1]);
        }, { structural: true, key: marker.id });
      });

      // Maus/Touch: ziehen. Während des Ziehens nur die Anzeige bewegen, am Ende speichern.
      marker.addEventListener('pointerdown', (event) => {
        marker.setPointerCapture(event.pointerId);
        let moved = false;
        const start = { x: point.x, y: point.y };
        const rect = image.getBoundingClientRect();
        const onMove = (moveEvent) => {
          moved = true;
          point.x = clampPercent(((moveEvent.clientX - rect.left) / rect.width) * 100);
          point.y = clampPercent(((moveEvent.clientY - rect.top) / rect.height) * 100);
          place();
        };
        const onUp = () => {
          marker.removeEventListener('pointermove', onMove);
          marker.removeEventListener('pointerup', onUp);
          if (moved) {
            // Für „Rückgängig": erst Startposition herstellen, dann die Änderung melden.
            const end = { x: point.x, y: point.y };
            Object.assign(point, start);
            context.change(() => Object.assign(point, end), { structural: true });
          }
        };
        marker.addEventListener('pointermove', onMove);
        marker.addEventListener('pointerup', onUp);
      });
      stage.append(marker);
    });
  }

  return el(
    'div',
    { class: 'stack' },
    renderFields(baseFields, data, context),
    data.image
      ? el('div', { class: 'field' }, el('p', { class: 'field__hint' }, 'Klicke ins Bild, um einen Punkt zu setzen. Punkte lassen sich ziehen oder mit den Pfeiltasten verschieben.'), stage)
      : el('p', { class: 'notice' }, 'Wähle zuerst ein Bild, dann kannst du Punkte setzen.'),
    pointField ? renderFields([pointField], data, context) : null,
  );
}

EM.define('js/editor/hotspot-editor.js', { renderHotspotEditor });
})();
