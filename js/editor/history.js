/*
 * history.js – Rückgängig / Wiederholen für den Editor
 *
 * Funktionsweise: Vor jeder Änderung wird ein Schnappschuss (vollständige Kopie) des
 * Datenmodells abgelegt. „Rückgängig" holt den letzten Schnappschuss zurück, „Wiederholen"
 * geht wieder vor. Höchstens 50 Schritte, nur im Arbeitsspeicher (nach dem Neuladen weg).
 *
 * Tippen: Damit nicht jeder Buchstabe ein eigener Schritt ist, werden Änderungen mit
 * gleichem „Bündelschlüssel" (z. B. dasselbe Textfeld) innerhalb von 1,5 Sekunden zu einem
 * Schritt zusammengefasst.
 *
 * Reine Logik ohne DOM – getestet in tests.html.
 *
 * Wenn du hier etwas ändern willst …
 *   – Anzahl Schritte: LIMIT. Mehr Schritte = mehr Arbeitsspeicher.
 */

(function () {
  'use strict';

const LIMIT = 50;
const COALESCE_MS = 1500;

/**
 * @typedef {Object} History
 * @property {Object[]} past     ältere Zustände (letzter = jüngster)
 * @property {Object[]} future   Zustände für „Wiederholen"
 * @property {string|null} lastKey
 * @property {number} lastTime
 */

/** @returns {History} */
function createHistory() {
  return { past: [], future: [], lastKey: null, lastTime: 0 };
}

/**
 * Merkt sich den Zustand VOR einer Änderung.
 * @param {History} history
 * @param {Object} snapshot  Kopie des Datenmodells vor der Änderung
 * @param {string|null} [coalesceKey]  gleicher Schlüssel kurz hintereinander = ein Schritt
 * @param {number} [now]
 */
function record(history, snapshot, coalesceKey = null, now = Date.now()) {
  const sameBurst = coalesceKey !== null && coalesceKey === history.lastKey && now - history.lastTime < COALESCE_MS;
  if (!sameBurst) {
    history.past.push(snapshot);
    if (history.past.length > LIMIT) history.past.shift();
  }
  history.future = [];
  history.lastKey = coalesceKey;
  history.lastTime = now;
}

/**
 * Einen Schritt zurück.
 * @param {History} history
 * @param {Object} current  aktueller Zustand (wandert nach future)
 * @returns {Object|null}   der wiederhergestellte Zustand oder null
 */
function undo(history, current) {
  if (history.past.length === 0) return null;
  history.future.push(current);
  history.lastKey = null;
  return history.past.pop();
}

/**
 * Einen Schritt vor.
 * @param {History} history
 * @param {Object} current
 * @returns {Object|null}
 */
function redo(history, current) {
  if (history.future.length === 0) return null;
  history.past.push(current);
  history.lastKey = null;
  return history.future.pop();
}

EM.define('js/editor/history.js', { createHistory, record, undo, redo, LIMIT });
})();
