/*
 * editor-save.js – Änderungen ermitteln und speichern (Direkt-, Download- und GitHub-Modus)
 *
 * Zweck: Vergleicht das Datenmodell des Editors mit dem Stand beim Laden/Speichern
 * (collectChanges), baut daraus die Dateioperationen und schreibt sie je nach Arbeitsbereich:
 * direkt in den Ordner (mit Konfliktprüfung und Sicherungskopie), als Download-Liste oder als
 * ein Commit auf GitHub. Hält auch die Offline-Datei content/inhalte.js aktuell.
 *
 * Zusammenspiel: Wird von js/pages/editor.js über createSaver() angelegt. Nutzt workspace.js und
 * github.js (über state.workspace), serialize.js, mirror.js, dialogs.js und das Ergebnis der
 * Prüfung (state.validation, ausgelöst über runValidation).
 *
 * Wenn du hier etwas ändern willst …
 *   – Neuer Speichermodus: Zweig in save() ergänzen und eine saveXyz(changes)-Funktion schreiben.
 *   – Was als „geändert" gilt: collectChanges(). Danach tests.html und einen Speichertest im
 *     Editor (alle drei Modi, soweit möglich) durchspielen.
 *   – Offline-Datei: expectedMirror() und writeMirrorFromDisk() müssen zusammenpassen.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { normalizeText } = EM.require("js/content/documents.js");
  const { serializeChapter, serializeCourse, serializeGlossary } = EM.require(
    "js/content/serialize.js",
  );
  const { TRANSLATION_DIR } = EM.require("js/content/translations.js");
  const { downloadBlob } = EM.require("js/editor/workspace.js");
  const { buildMirrorScript, collectMirrorPaths, parseMirrorScript } =
    EM.require("js/content/mirror.js");
  const { backupPath } = EM.require("js/editor/names.js");
  const { confirmDialog, openDialog, promptDialog } = EM.require(
    "js/editor/dialogs.js",
  );

  /**
   * @typedef {Object} SaveContext
   * @property {Object} state  Editor-Zustand (doc, files, workspace, pendingAssets, mirror …)
   * @property {(entry: Object) => string} chapterPath
   * @property {(message: string) => void} setStatus
   * @property {() => void} runValidation  Prüfung sofort ausführen (füllt state.validation)
   * @property {() => void} renderAll  Oberfläche nach dem Speichern neu zeichnen
   * @property {{course: string, glossary: string, template: string, mirror: string, dirs: {kapitel: string}}} paths
   */

  /**
   * Legt den Speicher-Teil für einen Editor an.
   * @param {SaveContext} context
   * @returns {{collectChanges: () => Object[], save: () => Promise<void>}}
   */
  function createSaver(context) {
    const { state, chapterPath, setStatus, runValidation, renderAll, paths } =
      context;

    /** Vergleichsstand einer Datei: kanonische Fassung beim Laden bzw. zuletzt gespeicherter Text. */
    function baselineText(path) {
      return state.files[path]?.canonical ?? state.files[path]?.text;
    }

    /**
     * Ermittelt alle nötigen Dateioperationen.
     * @returns {{path: string, label: string, text?: string, blob?: Blob, from?: string, entry?: ChapterEntry}[]}
     */
    function collectChanges() {
      if (!state.doc) {
        return [];
      }
      const changes = [];
      const courseText = serializeCourse(state.doc.course);
      if (courseText !== baselineText(paths.course)) {
        changes.push({
          path: paths.course,
          label: "Kurseinstellungen",
          text: courseText,
        });
      }
      const glossaryText = serializeGlossary(state.doc.glossary);
      if (
        glossaryText !== (baselineText(paths.glossary) ?? "") &&
        !(glossaryText === "\n" && !baselineText(paths.glossary))
      ) {
        changes.push({
          path: paths.glossary,
          label: "Glossar",
          text: glossaryText,
        });
      }
      for (const entry of state.doc.chapters) {
        const path = chapterPath(entry);
        const from = entry.origin ? chapterPath(entry.origin) : null;
        const text = entry.model
          ? serializeChapter(entry.model)
          : entry.brokenText;
        const original = from ? baselineText(from) : null;
        if (from === null || from !== path || text !== original) {
          changes.push({
            path,
            from,
            text,
            entry,
            label: entry.model?.meta.titel ?? entry.file,
          });
        }
      }
      // Handübersetzungen der Sicherheitsunterweisung
      for (const entry of state.doc.translations ?? []) {
        const path = `${TRANSLATION_DIR}/${entry.file}`;
        const text = serializeChapter(entry.model);
        if (text !== baselineText(path)) {
          changes.push({
            path,
            text,
            label: `Übersetzung ${entry.file}`,
          });
        }
      }
      for (const [path, asset] of state.pendingAssets) {
        changes.push({ path, label: "Bild", blob: asset.blob });
      }

      // Offline-Datei: gilt als geändert, sobald sie nicht mehr zum Stand nach dem Speichern passt.
      const mirror = expectedMirror(changes);
      const same =
        state.mirror &&
        JSON.stringify(state.mirror.dateien) === JSON.stringify(mirror.files) &&
        JSON.stringify(state.mirror.kapitelOrdner) ===
          JSON.stringify(mirror.chapterFiles);
      if (!same) {
        changes.push({
          path: paths.mirror,
          label: "Offline-Datei",
          text: buildMirrorScript(mirror.files, mirror.chapterFiles),
          mirror: true,
        });
      }
      return changes;
    }

    /**
     * Inhalt der Offline-Datei content/inhalte.js, wie sie NACH dem Speichern sein muss:
     * unveränderte Dateien mit ihrem Text auf der Platte, geänderte mit dem neuen Text.
     * @param {Object[]} changes  übrige Änderungen aus collectChanges()
     * @returns {{files: Object<string, string>, chapterFiles: string[]}}
     */
    function expectedMirror(changes) {
      const changed = new Map(
        changes
          .filter((change) => typeof change.text === "string")
          .map((change) => [change.path, change.text]),
      );
      const chapterFiles = state.doc.chapters
        .filter((entry) => entry.location === "kapitel")
        .map((entry) => entry.file)
        .sort();
      const files = {};
      const translationFiles = (state.doc.translations ?? [])
        .map((entry) => entry.file)
        .sort();
      for (const path of collectMirrorPaths(
        chapterFiles,
        String(state.doc.course.meta.logo ?? ""),
        translationFiles,
      )) {
        let text = changed.get(path);
        if (text === undefined && path === paths.template) {
          text = state.template;
        } else if (
          text === undefined &&
          path === String(state.doc.course.meta.logo)
        ) {
          text = state.logoText;
        } else if (text === undefined) {
          text = state.files[path]?.text;
        }
        if (typeof text === "string") {
          files[path] = text;
        }
      }
      return { files, chapterFiles };
    }

    /** Speichern: im Direktmodus in die Dateien, im GitHub-Modus als Commit, sonst als Download-Liste. */
    async function save() {
      const changes = collectChanges();
      if (changes.length === 0) {
        return setStatus("Keine ungespeicherten Änderungen.");
      }
      runValidation();
      const errors = state.validation.filter(
        (item) => item.severity === "fehler",
      ).length;
      if (errors > 0) {
        const proceed = await confirmDialog({
          title: "Trotzdem speichern?",
          text: `Die Prüfung meldet ${errors} Fehler. Du kannst trotzdem speichern – es geht nichts verloren. Im Kurs funktionieren die betroffenen Stellen aber erst, wenn die Fehler behoben sind.`,
          confirmLabel: "Trotzdem speichern",
        });
        if (!proceed) {
          return;
        }
      }
      if (state.workspace.mode === "direkt") {
        await saveDirect(changes);
      } else if (state.workspace.mode === "github") {
        await saveGitHub(changes);
      } else {
        await saveDownload(changes);
      }
      renderAll();
    }

    /** Direktmodus: Konflikte prüfen, Sicherungskopie anlegen, schreiben/verschieben. */
    async function saveDirect(changes) {
      const workspace = state.workspace;
      const saved = [];
      // Die Offline-Datei wird zum Schluss aus dem tatsächlichen Stand auf der Platte erzeugt.
      for (const change of changes.filter((entry) => !entry.mirror)) {
        try {
          const source = change.from === undefined ? change.path : change.from;
          if (source && state.files[source]) {
            // Konfliktprüfung: Wurde die Datei seit dem Öffnen außerhalb des Editors geändert?
            const onDisk = await workspace.readFile(source);
            if (
              onDisk &&
              state.files[source].lastModified !== null &&
              onDisk.lastModified !== state.files[source].lastModified
            ) {
              const overwrite = await confirmDialog({
                title: "Datei wurde außerhalb geändert",
                text: `„${source}" wurde geändert, seit du den Editor geöffnet hast (z. B. in einem Texteditor). Wenn du überschreibst, landet die andere Fassung als Sicherungskopie in content/_backup/.`,
                confirmLabel: "Überschreiben",
                cancelLabel: "Diese Datei auslassen",
                danger: true,
              });
              if (!overwrite) {
                continue;
              }
              state.files[source].backedUp = false;
            }
            // Beim ersten Speichern pro Sitzung: bisherige Fassung sichern.
            if (onDisk && !state.files[source].backedUp) {
              await workspace.writeText(backupPath(source), onDisk.text);
              state.files[source].backedUp = true;
            }
            if (change.from && change.from !== change.path) {
              await workspace.move(change.from, change.path);
            }
          }
          if (change.blob) {
            await workspace.writeBlob(change.path, change.blob);
          } else {
            await workspace.writeText(change.path, change.text);
          }
          const lastModified = await workspace.lastModified(change.path);
          state.files[change.path] = {
            text: change.text ?? "",
            lastModified,
            backedUp: true,
          };
          if (change.from && change.from !== change.path) {
            delete state.files[change.from];
          }
          if (change.entry) {
            change.entry.origin = {
              file: change.entry.file,
              location: change.entry.location,
            };
          }
          if (change.blob) {
            state.pendingAssets.delete(change.path);
          }
          saved.push(change.path.split("/").pop());
        } catch (error) {
          setStatus(
            `Fehler beim Speichern von ${change.path}: ${error.message}`,
          );
          return;
        }
      }
      try {
        if (await writeMirrorFromDisk()) {
          saved.push("inhalte.js (Offline-Datei)");
        }
      } catch (error) {
        setStatus(
          `Die Offline-Datei content/inhalte.js konnte nicht geschrieben werden: ${error.message}`,
        );
        return;
      }
      setStatus(
        saved.length > 0
          ? `Gespeichert: ${saved.join(", ")}. Sicherungskopien liegen in content/_backup/.`
          : "Nichts gespeichert.",
      );
    }

    /**
     * Erzeugt content/inhalte.js aus den Dateien, wie sie gerade auf der Platte liegen, und schreibt
     * sie, falls sie sich geändert hat (nur Direktmodus).
     * @returns {Promise<boolean>} true, wenn die Datei neu geschrieben wurde
     */
    async function writeMirrorFromDisk() {
      const workspace = state.workspace;
      const chapterFiles = (await workspace.list(paths.dirs.kapitel))
        .filter((name) => name.endsWith(".md"))
        .sort();
      const logoPath = String(state.doc.course.meta.logo ?? "");
      const translationFiles = (
        await workspace.list(TRANSLATION_DIR).catch(() => [])
      ).filter((name) => name.endsWith(".md"));
      const files = {};
      for (const path of collectMirrorPaths(
        chapterFiles,
        logoPath,
        translationFiles,
      )) {
        const file = await workspace.readFile(path);
        if (file) {
          files[path] = normalizeText(file.text);
        }
      }
      state.logoText = files[logoPath] ?? state.logoText;
      if (
        state.mirror &&
        JSON.stringify(state.mirror.dateien) === JSON.stringify(files) &&
        JSON.stringify(state.mirror.kapitelOrdner) ===
          JSON.stringify(chapterFiles)
      ) {
        return false;
      }
      const text = buildMirrorScript(files, chapterFiles);
      await workspace.writeText(paths.mirror, text);
      state.mirror = parseMirrorScript(text);
      return true;
    }

    /** Download-Modus: Dateien zum Herunterladen anbieten, mit Zielordner. */
    async function saveDownload(changes) {
      const id = "save-dialog-title";
      const rows = changes.map((change) => {
        const name = change.path.split("/").pop();
        const folder = change.path.split("/").slice(0, -1).join("/");
        const button = el(
          "button",
          { type: "button", class: "button button--small" },
          "Herunterladen",
        );
        button.addEventListener("click", () => {
          downloadBlob(
            name,
            change.blob ??
              new Blob([change.text], { type: "text/markdown;charset=utf-8" }),
          );
          button.textContent = "Heruntergeladen ✓";
        });
        const moveNote =
          change.from && change.from !== change.path
            ? el(
                "p",
                { class: "field__hint" },
                `Danach die alte Datei „${change.from}" löschen bzw. verschieben (der Editor kann das ohne Ordnerzugriff nicht).`,
              )
            : null;
        return el(
          "li",
          { class: "save-list__item" },
          el(
            "p",
            {},
            el("strong", {}, name),
            ` → in den Ordner `,
            el("code", {}, `${folder}/`),
          ),
          moveNote,
          button,
        );
      });
      const done = await openDialog(
        (close) => [
          el("h2", { id }, "Dateien herunterladen"),
          el(
            "p",
            {},
            "Ohne Ordnerzugriff kann der Editor nicht direkt speichern. Lade jede Datei herunter und lege sie in den angegebenen Ordner im Projekt (vorhandene Datei ersetzen).",
          ),
          el("ul", { class: "save-list" }, rows),
          el(
            "div",
            { class: "dialog__actions" },
            el(
              "button",
              { type: "button", class: "button", onclick: () => close(false) },
              "Später",
            ),
            el(
              "button",
              {
                type: "button",
                class: "button button--primary",
                onclick: () => close(true),
              },
              "Erledigt – alle Dateien abgelegt",
            ),
          ),
        ],
        id,
      );
      if (!done) {
        return setStatus("Nicht gespeichert. Deine Änderungen sind noch da.");
      }
      markSaved(changes);
      setStatus(
        "Als gespeichert markiert. Lade den Kurs neu, um die Änderungen zu sehen.",
      );
    }

    /**
     * GitHub-Modus: alle Änderungen als einen Commit ins Repository speichern. Die Beschreibung
     * ist vorausgefüllt und erscheint in der Versionsgeschichte (wie „Summary" in GitHub Desktop).
     * @param {Object[]} changes  aus collectChanges()
     */
    async function saveGitHub(changes) {
      const labels = [
        ...new Set(
          changes
            .filter((change) => !change.mirror)
            .map((change) => change.label),
        ),
      ];
      const message = await promptDialog({
        title: "Auf GitHub speichern",
        label: "Was hast du geändert?",
        value: `Editor: ${labels.join(", ") || "Offline-Datei aktualisiert"}`,
        hint: "Kurze Beschreibung für die Versionsgeschichte. Nach dem Speichern ist die Website in 1–2 Minuten aktualisiert.",
        confirmLabel: "Auf GitHub speichern",
      });
      if (message === null) {
        return setStatus("Nicht gespeichert. Deine Änderungen sind noch da.");
      }
      setStatus("Wird auf GitHub gespeichert …");
      try {
        let result = await state.workspace.commitChanges(changes, message);
        if (result.conflicts) {
          const overwrite = await confirmDialog({
            title: "Auf GitHub wurde inzwischen etwas geändert",
            text: `Seit du den Editor geöffnet hast, wurden auf GitHub diese Dateien geändert: ${result.conflicts.join(", ")}. Wenn du trotzdem speicherst, ersetzt deine Fassung die andere (sie bleibt in der Versionsgeschichte erhalten). Sonst: Abbrechen, Editor neu laden und die Änderung wiederholen.`,
            confirmLabel: "Meine Fassung speichern",
            cancelLabel: "Abbrechen",
            danger: true,
          });
          if (!overwrite) {
            return setStatus(
              "Nicht gespeichert. Deine Änderungen sind noch da.",
            );
          }
          result = await state.workspace.commitChanges(changes, message, {
            overwrite: true,
          });
        }
        markSaved(changes);
        const count = changes.length;
        setStatus(
          `Auf GitHub gespeichert (${count} ${count === 1 ? "Datei" : "Dateien"}). Die Website ist in 1–2 Minuten aktualisiert.`,
        );
      } catch (error) {
        setStatus(`Nicht gespeichert: ${error.message}`);
      }
    }

    /**
     * Übernimmt gespeicherte Änderungen als neuen Ausgangsstand (Download- und GitHub-Modus):
     * Danach gilt nichts mehr als „ungespeichert".
     * @param {Object[]} changes  aus collectChanges()
     */
    function markSaved(changes) {
      for (const change of changes) {
        if (change.mirror) {
          state.mirror = parseMirrorScript(change.text);
          continue;
        }
        state.files[change.path] = {
          text: change.text ?? "",
          lastModified: null,
          backedUp: true,
        };
        if (change.from && change.from !== change.path) {
          delete state.files[change.from];
        }
        if (change.entry) {
          change.entry.origin = {
            file: change.entry.file,
            location: change.entry.location,
          };
        }
        if (change.blob) {
          const pending = state.pendingAssets.get(change.path);
          if (pending) {
            state.savedAssetUrls.set(change.path, pending.url);
          }
          state.pendingAssets.delete(change.path);
        }
      }
    }

    return { collectChanges, save };
  }

  EM.define("js/editor/editor-save.js", { createSaver });
})();
