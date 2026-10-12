/*
 * certificate-view.js – Zertifikat (#/zertifikat)
 *
 * Erst nach bestandenem Qualifying erreichbar. Hier – und nur hier – wird nach dem Namen
 * gefragt. Er bleibt im Browser (Fortschritt, Feld name) und wird nirgends hingeschickt.
 * Das PDF baut js/certificate.js. Klappt das nicht (jsPDF fehlt), erscheint eine
 * Druckansicht mit dem Hinweis „Drucken → Als PDF sichern".
 *
 * Wenn du hier etwas ändern willst …
 *   – Titel, Unterschrift und Rolle: content/kurs.md (zertifikat-…), nicht hier.
 *   – Layout des PDFs: js/certificate.js. Druckansicht: css/print.css + renderPrintable().
 */

import { el } from '../dom.js';
import { isoDate, getChapterStatus, isCertificateUnlocked } from '../store.js';
import { SAFETY_NOTE, certificateFileName, createVerificationCode, downloadCertificate, formatGermanDate } from '../certificate.js';

/**
 * @param {import('./view-types.js').ViewContext} context
 * @returns {import('./view-types.js').ViewResult}
 */
export function renderCertificate({ course, store }) {
  const state = store.get();
  if (!isCertificateUnlocked(state, course.meta.kursversion)) {
    return {
      title: 'Zertifikat',
      node: el(
        'div',
        { class: 'stack' },
        el('h1', {}, 'Zertifikat'),
        el('p', { class: 'lead' }, 'Dein Zertifikat wartet auf dich, sobald du das Qualifying bestanden hast.'),
        el('p', {}, el('a', { class: 'button button--primary', href: '#/qualifying' }, 'Zum Qualifying')),
      ),
    };
  }

  const status = el('p', { class: 'certificate__status', role: 'status' });
  const error = el('p', { class: 'field__error', id: 'cert-name-error', hidden: true }, 'Bitte gib deinen Namen ein – er steht später auf dem Zertifikat.');
  const input = el('input', {
    type: 'text',
    id: 'cert-name',
    name: 'name',
    autocomplete: 'name',
    required: true,
    value: state.name,
    'aria-describedby': 'cert-name-hint cert-name-error',
    class: 'field__input',
  });
  const printArea = el('div', { class: 'certificate__print-area' });

  const data = () => buildData(course, store, input.value.trim());

  const form = el(
    'form',
    { class: 'certificate__form stack no-print', novalidate: true },
    el(
      'div',
      { class: 'field' },
      el('label', { for: 'cert-name' }, 'Dein Name'),
      el('p', { class: 'field__hint', id: 'cert-name-hint' }, 'So, wie er auf dem Zertifikat stehen soll. Der Name bleibt nur in diesem Browser.'),
      input,
      error,
    ),
    el('div', { class: 'block__actions' }, el('button', { type: 'submit', class: 'button button--primary button--large' }, 'Zertifikat herunterladen')),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (name === '') {
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    error.hidden = true;
    input.removeAttribute('aria-invalid');
    store.update((draft) => {
      draft.name = name;
    });
    status.textContent = 'Zertifikat wird erstellt …';
    try {
      await downloadCertificate(data(), course.meta.logo ?? '');
      status.textContent = `Fertig: ${certificateFileName(name)} wurde heruntergeladen.`;
    } catch {
      // jsPDF fehlt oder ist kaputt → Druckansicht als Ersatz.
      status.textContent = 'Das PDF konnte nicht erzeugt werden. Unten steht eine Druckansicht: Wähle „Drucken" und dann „Als PDF sichern".';
      printArea.replaceChildren(renderPrintable(data(), course.meta.logo));
    }
  });

  return {
    title: 'Zertifikat',
    node: el(
      'div',
      { class: 'stack certificate' },
      el('h1', { class: 'no-print' }, 'Dein Zertifikat'),
      el('p', { class: 'lead no-print' }, 'Glückwunsch – du hast das Onboarding geschafft! Trag deinen Namen ein und lade die Bestätigung herunter.'),
      form,
      status,
      el('p', { class: 'notice no-print' }, el('strong', {}, 'Wichtig: '), SAFETY_NOTE, ' Wer die Unterweisung durchführt, steht im Sektor Arbeitssicherheit.'),
      printArea,
    ),
  };
}

/**
 * Sammelt die Daten fürs Zertifikat aus Kurs und Fortschritt.
 * @returns {import('../certificate.js').CertificateData}
 */
function buildData(course, store, name) {
  const state = store.get();
  const signature = String(course.meta['zertifikat-unterschrift-name'] ?? '');
  return {
    name,
    date: isoDate(),
    courseTitle: String(course.meta.titel ?? 'Onboarding'),
    team: String(course.meta.team ?? ''),
    title: String(course.meta['zertifikat-titel'] ?? 'Onboarding abgeschlossen'),
    version: String(course.meta.kursversion ?? ''),
    // Ein Platzhalter {{TODO …}} gehört nicht aufs Zertifikat → leere Unterschriftszeile.
    signatureName: /\{\{/.test(signature) ? '' : signature,
    signatureRole: String(course.meta['zertifikat-unterschrift-rolle'] ?? ''),
    chapters: course.chapters.map((chapter, index) => ({
      number: index + 1,
      title: String(chapter.meta.titel),
      best: getChapterStatus(state, chapter) === 'bestzeit',
    })),
  };
}

/**
 * Druckbare Fassung des Zertifikats (Ersatz, wenn das PDF nicht erzeugt werden kann).
 * @param {import('../certificate.js').CertificateData} data
 * @param {string} [logo]
 * @returns {HTMLElement}
 */
function renderPrintable(data, logo) {
  const printButton = el('button', { type: 'button', class: 'button button--primary no-print' }, 'Drucken');
  printButton.addEventListener('click', () => window.print());
  return el(
    'div',
    { class: 'stack' },
    printButton,
    el(
      'article',
      { class: 'print-certificate', 'aria-label': 'Druckansicht des Zertifikats' },
      el(
        'header',
        { class: 'print-certificate__head' },
        logo ? el('img', { src: logo, alt: data.team, class: 'print-certificate__logo' }) : null,
        el('p', { class: 'print-certificate__course' }, data.courseTitle, el('span', {}, data.team)),
      ),
      el('p', { class: 'print-certificate__title' }, data.title),
      el('p', {}, 'Hiermit bestätigen wir, dass'),
      el('p', { class: 'print-certificate__name' }, data.name),
      el('p', {}, `das ${data.courseTitle} von ${data.team} erfolgreich abgeschlossen hat.`),
      el(
        'div',
        { class: 'print-certificate__columns' },
        el('div', {}, el('p', { class: 'print-certificate__label' }, 'Abgeschlossene Sektoren'), el('ul', {}, data.chapters.map((chapter) => el('li', {}, `S${chapter.number} ${chapter.title}${chapter.best ? ' (Bestzeit)' : ''}`)))),
        el(
          'dl',
          {},
          el('dt', {}, 'Datum'),
          el('dd', {}, formatGermanDate(data.date)),
          el('dt', {}, 'Kursversion'),
          el('dd', {}, data.version),
          el('dt', {}, 'Prüfcode'),
          el('dd', {}, createVerificationCode(data.name, data.date, data.version)),
        ),
      ),
      el('p', { class: 'print-certificate__signature' }, el('span', {}, data.signatureName || ' '), el('span', {}, data.signatureRole)),
      el('p', { class: 'print-certificate__note' }, SAFETY_NOTE),
    ),
  );
}
