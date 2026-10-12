/*
 * workspace.js – Dateizugriff des Editors: Direktmodus und Download-Modus
 *
 * Eine Webseite darf normalerweise keine Dateien speichern. Deshalb zwei Wege:
 *
 * Direktmodus (Chrome, Edge – über das Startskript, also http://localhost):
 *   „Projektordner öffnen" → showDirectoryPicker() → Ordner onboarding/ wählen. Danach liest
 *   und schreibt der Editor direkt in content/ und assets/bilder/. Der Ordner-Zugriff wird in
 *   IndexedDB gemerkt; beim nächsten Start fragt der Browser nur kurz nach Erlaubnis.
 *
 * Download-Modus (Firefox, Safari, oder ohne Ordnerzugriff):
 *   Inhalte werden per fetch geladen. „Speichern" bietet die geänderten Dateien zum
 *   Herunterladen an – mit genauer Angabe, in welchen Ordner sie gehören.
 *
 * Welcher Modus möglich ist, wird per Feature-Erkennung entschieden (gibt es
 * showDirectoryPicker und einen sicheren Kontext?), nie über den Browsernamen.
 *
 * Beide Arbeitsbereiche haben dieselben Funktionen (readFile, writeText, …), damit der
 * restliche Editor nicht unterscheiden muss. Was im Download-Modus nicht geht (Ordner
 * auflisten, Dateien verschieben), meldet `canList`/`canMove` = false.
 *
 * Wenn du hier etwas ändern willst …
 *   – Neue Dateioperation: in BEIDEN Arbeitsbereichen ergänzen.
 */

const DB_NAME = 'em-onboarding-editor';
const STORE = 'handles';

/**
 * Ist der Direktmodus in diesem Browser möglich?
 * @returns {boolean}
 */
export function supportsDirectAccess() {
  return typeof window.showDirectoryPicker === 'function' && window.isSecureContext;
}

/**
 * @typedef {Object} Workspace
 * @property {'direkt'|'download'} mode
 * @property {string} label                 Anzeigename, z. B. Ordnername
 * @property {boolean} canList              kann Ordner auflisten
 * @property {boolean} canMove              kann Dateien verschieben/umbenennen
 * @property {(path: string) => Promise<{text: string, lastModified: number|null}|null>} readFile
 * @property {(path: string, text: string) => Promise<void>} writeText
 * @property {(path: string, blob: Blob) => Promise<void>} writeBlob
 * @property {(dir: string) => Promise<string[]>} list    Dateinamen in einem Ordner
 * @property {(from: string, to: string) => Promise<void>} move
 * @property {(path: string) => Promise<number|null>} lastModified
 */

/* ───────────────────────────── Direktmodus ───────────────────────────── */

/**
 * Lässt die Person den Projektordner wählen und prüft, ob es der richtige ist.
 * @returns {Promise<Workspace>}
 * @throws {Error} mit verständlicher Meldung (z. B. falscher Ordner)
 */
export async function openDirectory() {
  const root = await window.showDirectoryPicker({ id: 'em-onboarding', mode: 'readwrite' });
  await assertProjectFolder(root);
  await saveHandle(root);
  return createDirectWorkspace(root);
}

/**
 * Versucht, den zuletzt gewählten Ordner wiederzuverwenden.
 * @param {boolean} ask  true = Browser darf nach Erlaubnis fragen (nur nach einem Klick erlaubt)
 * @returns {Promise<{workspace: Workspace|null, needsPermission: boolean, name: string}>}
 */
export async function restoreDirectory(ask) {
  const root = await loadHandle().catch(() => null);
  if (!root) return { workspace: null, needsPermission: false, name: '' };
  const options = { mode: 'readwrite' };
  let permission = await root.queryPermission(options);
  if (permission === 'prompt' && ask) permission = await root.requestPermission(options);
  if (permission !== 'granted') return { workspace: null, needsPermission: true, name: root.name };
  await assertProjectFolder(root);
  return { workspace: createDirectWorkspace(root), needsPermission: false, name: root.name };
}

async function assertProjectFolder(root) {
  try {
    const content = await root.getDirectoryHandle('content');
    await content.getFileHandle('kurs.md');
  } catch {
    throw new Error(`Im Ordner „${root.name}" gibt es keine Datei content/kurs.md. Bitte den Projektordner (onboarding) wählen – nicht einen Unterordner.`);
  }
}

/**
 * @param {FileSystemDirectoryHandle} root
 * @returns {Workspace}
 */
function createDirectWorkspace(root) {
  /** Geht den Pfad entlang und liefert Ordner-Handle + Dateiname. */
  const resolve = async (path, create = false) => {
    const parts = path.split('/').filter(Boolean);
    const name = parts.pop();
    let dir = root;
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
    return { dir, name };
  };

  const readFile = async (path) => {
    try {
      const { dir, name } = await resolve(path);
      const file = await (await dir.getFileHandle(name)).getFile();
      return { text: await file.text(), lastModified: file.lastModified };
    } catch (error) {
      if (error.name === 'NotFoundError' || error.name === 'TypeError') return null;
      throw error;
    }
  };

  const writeBlob = async (path, blob) => {
    const { dir, name } = await resolve(path, true);
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  };

  return {
    mode: 'direkt',
    label: root.name,
    canList: true,
    canMove: true,
    readFile,
    writeBlob,
    writeText: (path, text) => writeBlob(path, new Blob([text], { type: 'text/markdown' })),
    async list(dirPath) {
      try {
        let dir = root;
        for (const part of dirPath.split('/').filter(Boolean)) dir = await dir.getDirectoryHandle(part);
        const names = [];
        for await (const [entryName, entry] of dir.entries()) {
          if (entry.kind === 'file') names.push(entryName);
        }
        return names.sort();
      } catch {
        return [];
      }
    },
    /** Verschieben = Kopie anlegen, dann Original entfernen. Nie ohne Kopie löschen. */
    async move(from, to) {
      const source = await readFile(from);
      if (!source) throw new Error(`${from} wurde nicht gefunden.`);
      const { dir: fromDir, name: fromName } = await resolve(from);
      const file = await (await fromDir.getFileHandle(fromName)).getFile();
      await writeBlob(to, file);
      const check = await readFile(to);
      if (!check) throw new Error(`${to} konnte nicht angelegt werden – ${from} bleibt erhalten.`);
      await fromDir.removeEntry(fromName);
    },
    async lastModified(path) {
      return (await readFile(path))?.lastModified ?? null;
    },
  };
}

/* ───────────────────────────── Download-Modus ───────────────────────────── */

/**
 * Arbeitsbereich ohne Ordnerzugriff: lesen per fetch, „schreiben" = Herunterladen anbieten
 * (das übernimmt der Speichern-Dialog im Editor).
 * @returns {Workspace}
 */
export function createDownloadWorkspace() {
  const readFile = async (path) => {
    const response = await fetch(path, { cache: 'no-cache' });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`${path}: Server antwortet mit ${response.status}`);
    return { text: await response.text(), lastModified: null };
  };
  const unsupported = async () => {
    throw new Error('Im Download-Modus nicht möglich.');
  };
  return {
    mode: 'download',
    label: 'ohne Ordnerzugriff',
    canList: false,
    canMove: false,
    readFile,
    writeText: unsupported,
    writeBlob: unsupported,
    list: async () => [],
    move: unsupported,
    lastModified: async () => null,
  };
}

/**
 * Startet den Download einer Datei.
 * @param {string} fileName
 * @param {Blob} blob
 */
export function downloadBlob(fileName, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* ───────────────────────────── IndexedDB: Ordner merken ───────────────────────────── */

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.addEventListener('upgradeneeded', () => request.result.createObjectStore(STORE));
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error));
  });
}

async function saveHandle(handle) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(handle, 'root');
    transaction.addEventListener('complete', resolve);
    transaction.addEventListener('error', () => reject(transaction.error));
  });
}

async function loadHandle() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get('root');
    request.addEventListener('success', () => resolve(request.result ?? null));
    request.addEventListener('error', () => reject(request.error));
  });
}

/**
 * Vergisst den gemerkten Ordner (z. B. „Anderen Ordner wählen").
 * @returns {Promise<void>}
 */
export async function forgetDirectory() {
  const db = await openDb();
  await new Promise((resolve) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete('root');
    transaction.addEventListener('complete', resolve);
  });
}
