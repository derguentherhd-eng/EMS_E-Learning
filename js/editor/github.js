/*
 * github.js – Editor speichert direkt ins GitHub-Repository (GitHub-Modus)
 *
 * Wozu? Safari und Firefox können nicht in Ordner auf dem Rechner speichern, und online
 * (…github.io/…/editor.html) gibt es gar keinen Ordner. Im GitHub-Modus liest der Editor die
 * Dateien direkt aus dem Repository und speichert alle Änderungen als EINEN Commit – genau wie
 * „Commit" + „Push" in GitHub Desktop. GitHub Pages veröffentlicht die neue Fassung danach
 * automatisch (ca. 1–2 Minuten).
 *
 * Zugang: ein persönlicher Zugangsschlüssel („Fine-grained personal access token") von GitHub,
 * der nur dieses eine Repository ändern darf (Berechtigung „Contents: Read and write").
 * Anleitung: docs/PFLEGE.md, Abschnitt 2.
 *
 * Sicherheit:
 *   – Der Schlüssel wird nur an https://api.github.com geschickt, nie in eine Adresse geschrieben.
 *   – Standard: nur für diesen Browser-Tab gemerkt (sessionStorage). Mit „Schlüssel merken"
 *     im localStorage – nur auf eigenen Geräten verwenden.
 *   – Sicherungskopien sind nicht nötig: Jede frühere Fassung steht in der Versionsgeschichte.
 *
 * Ablauf beim Speichern (Git-Data-API von GitHub):
 *   neuester Stand des Branches → Konfliktprüfung → Bilder als Blobs hochladen → neuen Dateibaum
 *   anlegen (geänderte, neue, verschobene und entfernte Dateien) → Commit → Branch weitersetzen.
 *
 * Wenn du hier etwas ändern willst …
 *   – Andere Fehlermeldungen: errorMessage().
 *   – Weitere Dateioperation: in commitChanges() einen Eintrag für den Dateibaum ergänzen.
 */

(function () {
  "use strict";

  const API = "https://api.github.com";
  const CONFIG_KEY = "em-onboarding:github";
  const TOKEN_KEY = "em-onboarding:github-token";
  const COURSE_FILE = "content/kurs.md";

  /**
   * @typedef {Object} GitHubConfig
   * @property {string} owner   Konto, z. B. „derguentherhd-eng"
   * @property {string} repo    Repository-Name
   * @property {string} branch  meist „main"
   * @property {string} token   persönlicher Zugangsschlüssel
   */

  // ── Einstellungen merken ──

  /**
   * Schlägt Konto und Repository vor: Läuft der Editor auf …github.io, stehen sie in der Adresse.
   * @returns {{owner: string, repo: string}}
   */
  function guessRepository() {
    const { hostname, pathname } = window.location;
    if (!hostname.endsWith(".github.io")) {
      return { owner: "", repo: "" };
    }
    const owner = hostname.split(".")[0];
    const first = pathname.split("/").filter(Boolean)[0] ?? "";
    // Projektseite: …github.io/repo/editor.html · Benutzerseite: …github.io/editor.html
    const repo = first && !first.includes(".") ? first : `${owner}.github.io`;
    return { owner, repo };
  }

  /**
   * Gespeicherte Einstellungen (ohne Schlüssel) und, falls vorhanden, der gemerkte Schlüssel.
   * @returns {{owner: string, repo: string, branch: string, token: string, remembered: boolean}}
   */
  function loadSettings() {
    const guess = guessRepository();
    let saved = {};
    let token = "";
    let remembered = false;
    try {
      saved = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? "{}");
      token = sessionStorage.getItem(TOKEN_KEY) ?? "";
      if (!token) {
        token = localStorage.getItem(TOKEN_KEY) ?? "";
        remembered = Boolean(token);
      }
    } catch {
      // Speicher gesperrt (z. B. privates Fenster): dann eben ohne Vorbelegung.
    }
    return {
      owner: saved.owner || guess.owner,
      repo: saved.repo || guess.repo,
      branch: saved.branch || "main",
      token,
      remembered,
    };
  }

  /**
   * Merkt Konto, Repository und Branch; den Schlüssel je nach Wunsch nur für diesen Tab
   * (sessionStorage) oder dauerhaft (localStorage).
   * @param {GitHubConfig} config
   * @param {boolean} remember
   */
  function saveSettings(config, remember) {
    try {
      localStorage.setItem(
        CONFIG_KEY,
        JSON.stringify({
          owner: config.owner,
          repo: config.repo,
          branch: config.branch,
        }),
      );
      sessionStorage.setItem(TOKEN_KEY, config.token);
      if (remember) {
        localStorage.setItem(TOKEN_KEY, config.token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      // Ohne Speicher funktioniert es trotzdem – nur nicht beim nächsten Mal.
    }
  }

  /** Vergisst den Zugangsschlüssel in diesem Browser (Konto und Repository bleiben vorbelegt). */
  function forgetToken() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // nichts zu tun
    }
  }

  // ── Anfragen an GitHub ──

  /**
   * Übersetzt eine Fehlerantwort von GitHub in einen verständlichen Satz.
   * @param {number} status
   * @param {string} [detail]  Meldung von GitHub
   * @returns {string}
   */
  function errorMessage(status, detail = "") {
    if (status === 401) {
      return "GitHub kennt diesen Zugangsschlüssel nicht (falsch kopiert oder abgelaufen). Bitte einen neuen Schlüssel anlegen.";
    }
    if (status === 403) {
      return "GitHub verweigert den Zugriff. Hat der Schlüssel die Berechtigung „Contents: Read and write“ für dieses Repository? Sonst: zu viele Anfragen – in einer Stunde erneut versuchen.";
    }
    if (status === 404) {
      return "Repository oder Branch nicht gefunden – oder der Schlüssel hat keinen Zugriff darauf. Schreibweise von Konto und Repository prüfen.";
    }
    if (status === 409 || status === 422) {
      return "Auf GitHub gibt es inzwischen einen neueren Stand. Bitte noch einmal speichern.";
    }
    return `GitHub antwortet mit Fehler ${status}${detail ? ` (${detail})` : ""}.`;
  }

  /**
   * Eine Anfrage an die GitHub-API.
   * @param {GitHubConfig} config
   * @param {string} method
   * @param {string} path      z. B. „/repos/konto/repo"
   * @param {Object} [body]
   * @param {string} [accept]  Antwortformat
   * @returns {Promise<any>}
   */
  async function request(
    config,
    method,
    path,
    body,
    accept = "application/vnd.github+json",
  ) {
    let response;
    try {
      response = await fetch(`${API}${path}`, {
        method,
        cache: "no-store",
        headers: {
          Accept: accept,
          Authorization: `Bearer ${config.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error(
        "Keine Verbindung zu GitHub. Besteht eine Internetverbindung?",
      );
    }
    if (!response.ok) {
      const detail = await response
        .json()
        .then((data) => data.message ?? "")
        .catch(() => "");
      const error = new Error(errorMessage(response.status, detail));
      error.status = response.status;
      throw error;
    }
    if (accept.includes("raw")) {
      return response.text();
    }
    return response.status === 204 ? null : response.json();
  }

  /**
   * Liest den kompletten Dateibaum eines Commits.
   * @returns {Promise<{treeSha: string, files: Map<string, string>}>}  Pfad → Blob-SHA
   */
  async function readTree(config, commitSha) {
    const base = `/repos/${config.owner}/${config.repo}`;
    const commit = await request(
      config,
      "GET",
      `${base}/git/commits/${commitSha}`,
    );
    const tree = await request(
      config,
      "GET",
      `${base}/git/trees/${commit.tree.sha}?recursive=1`,
    );
    const files = new Map();
    for (const entry of tree.tree) {
      if (entry.type === "blob") {
        files.set(entry.path, entry.sha);
      }
    }
    return { treeSha: commit.tree.sha, files };
  }

  /**
   * Neuester Commit eines Branches.
   * @returns {Promise<string>} Commit-SHA
   */
  async function headCommit(config) {
    const ref = await request(
      config,
      "GET",
      `/repos/${config.owner}/${config.repo}/git/ref/heads/${encodeURIComponent(config.branch)}`,
    );
    return ref.object.sha;
  }

  /**
   * Wandelt ein Bild (Blob) in Base64 um – so nimmt GitHub Binärdateien an.
   * @param {Blob} blob
   * @returns {Promise<string>}
   */
  async function blobToBase64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
    }
    return btoa(binary);
  }

  // ── Arbeitsbereich ──

  /**
   * Verbindet sich mit dem Repository und liefert einen Arbeitsbereich wie workspace.js – plus
   * commitChanges() zum Speichern.
   *
   * Liegt das Projekt in einem Unterordner des Repositorys (z. B. „onboarding/"), wird der Ordner
   * mit content/kurs.md automatisch gefunden.
   *
   * @param {GitHubConfig} config
   * @returns {Promise<Object>} Arbeitsbereich mit mode „github"
   * @throws {Error} mit verständlicher Meldung
   */
  async function connectGitHub(config) {
    if (!config.owner || !config.repo || !config.token) {
      throw new Error(
        "Bitte Konto, Repository und Zugangsschlüssel ausfüllen.",
      );
    }
    const repository = await request(
      config,
      "GET",
      `/repos/${config.owner}/${config.repo}`,
    );
    if (repository.permissions && !repository.permissions.push) {
      throw new Error(
        "Der Zugangsschlüssel darf dieses Repository nur lesen. Beim Anlegen des Schlüssels „Contents: Read and write“ wählen.",
      );
    }
    let headSha = await headCommit(config);
    let snapshot = await readTree(config, headSha);

    const courseFiles = [...snapshot.files.keys()]
      .filter(
        (path) => path === COURSE_FILE || path.endsWith(`/${COURSE_FILE}`),
      )
      .sort((a, b) => a.length - b.length);
    if (courseFiles.length === 0) {
      throw new Error(
        `Im Repository ${config.owner}/${config.repo} (Branch ${config.branch}) gibt es keine Datei content/kurs.md.`,
      );
    }
    // Projektordner im Repository: meist die Wurzel, sonst z. B. „onboarding/".
    const prefix = courseFiles[0].slice(0, -COURSE_FILE.length);
    const base = `/repos/${config.owner}/${config.repo}`;

    /** Pfad im Projekt → Pfad im Repository. */
    function full(path) {
      return `${prefix}${path}`;
    }

    /** Liest eine Datei als Text (oder null, wenn es sie nicht gibt). */
    async function readFile(path) {
      const sha = snapshot.files.get(full(path));
      if (!sha) {
        return null;
      }
      const text = await request(
        config,
        "GET",
        `${base}/git/blobs/${sha}`,
        undefined,
        "application/vnd.github.raw+json",
      );
      return { text, lastModified: null };
    }

    /** Dateinamen direkt in einem Ordner (ohne Unterordner). */
    async function list(dir) {
      const start = `${full(dir)}/`;
      return [...snapshot.files.keys()]
        .filter(
          (path) =>
            path.startsWith(start) && !path.slice(start.length).includes("/"),
        )
        .map((path) => path.slice(start.length))
        .sort();
    }

    async function unsupported() {
      throw new Error("Im GitHub-Modus wird nur gesammelt gespeichert.");
    }

    /**
     * Speichert alle Änderungen als einen Commit.
     * @param {{path: string, from?: string|null, text?: string, blob?: Blob}[]} changes
     * @param {string} message  Commit-Beschreibung
     * @param {{overwrite?: boolean}} [options]
     * @returns {Promise<{conflicts: string[]}|{commitUrl: string}>}
     *   conflicts: Dateien, die auf GitHub seit dem Laden geändert wurden (nichts gespeichert)
     */
    async function commitChanges(changes, message, options = {}) {
      const latest = await headCommit(config);
      let baseTree = snapshot.treeSha;
      if (latest !== headSha) {
        // Jemand hat inzwischen auf GitHub gespeichert: Betrifft es unsere Dateien?
        const remote = await readTree(config, latest);
        const touched = new Set();
        for (const change of changes) {
          touched.add(full(change.path));
          if (change.from) {
            touched.add(full(change.from));
          }
        }
        const conflicts = [...touched].filter(
          (path) => remote.files.get(path) !== snapshot.files.get(path),
        );
        if (conflicts.length > 0 && !options.overwrite) {
          return {
            conflicts: conflicts.map((path) => path.slice(prefix.length)),
          };
        }
        baseTree = remote.treeSha;
      }

      const entries = [];
      for (const change of changes) {
        if (change.from && change.from !== change.path) {
          // Verschieben = alte Datei im selben Commit entfernen (bleibt in der Geschichte).
          entries.push({
            path: full(change.from),
            mode: "100644",
            type: "blob",
            sha: null,
          });
        }
        if (change.blob) {
          const blob = await request(config, "POST", `${base}/git/blobs`, {
            content: await blobToBase64(change.blob),
            encoding: "base64",
          });
          entries.push({
            path: full(change.path),
            mode: "100644",
            type: "blob",
            sha: blob.sha,
          });
        } else {
          entries.push({
            path: full(change.path),
            mode: "100644",
            type: "blob",
            content: change.text ?? "",
          });
        }
      }

      const tree = await request(config, "POST", `${base}/git/trees`, {
        base_tree: baseTree,
        tree: entries,
      });
      const commit = await request(config, "POST", `${base}/git/commits`, {
        message,
        tree: tree.sha,
        parents: [latest],
      });
      await request(
        config,
        "PATCH",
        `${base}/git/refs/heads/${encodeURIComponent(config.branch)}`,
        { sha: commit.sha, force: false },
      );
      headSha = commit.sha;
      snapshot = await readTree(config, headSha);
      return { commitUrl: commit.html_url };
    }

    return {
      mode: "github",
      label: `${config.owner}/${config.repo}`,
      canList: true,
      canMove: true,
      readFile,
      list,
      writeText: unsupported,
      writeBlob: unsupported,
      move: unsupported,
      lastModified: async () => null,
      commitChanges,
      repositoryUrl: repository.html_url,
    };
  }

  EM.define("js/editor/github.js", {
    connectGitHub,
    forgetToken,
    guessRepository,
    loadSettings,
    saveSettings,
  });
})();
