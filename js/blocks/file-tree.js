/*
 * file-tree.js – Baustein „ordner": simulierter Drive-Explorer mit Suchaufgaben
 *
 * Kursdown (Einrückung um zwei Leerzeichen = eine Ebene tiefer; nach | die Beschreibung):
 *   :::ordner Unser Team-Drive
 *   - 📁 01 Organisation | Protokolle, Termine, Mitgliederlisten
 *     - 📁 Protokolle | Teamsitzungen, nach Datum benannt
 *     - 📄 Terminkalender
 *   - 📁 02 Technik
 *     - 📁 Chassis
 *   ? Wo findest du das Protokoll der letzten Teamsitzung? => 01 Organisation/Protokolle
 *   :::
 *
 * 📁 = Ordner, 📄 = Datei. Zeilen mit ? sind Suchaufgaben: Frage => Pfad (Ordnernamen mit /).
 *
 * Bedienung (WAI-ARIA-Muster „Tree View"):
 *   Pfeil hoch/runter = vorheriger/nächster Eintrag · Pfeil rechts = Ordner öffnen bzw. in den
 *   Ordner · Pfeil links = Ordner schließen bzw. zum übergeordneten Ordner · Pos1/Ende = erster/
 *   letzter Eintrag · Enter/Leertaste = auswählen. Mit Maus/Touch: antippen.
 *   Die Beschreibung des ausgewählten Eintrags erscheint unter dem Baum.
 *
 * Datenmodell: eine flache Liste mit Tiefe (depth). Das ist im Editor als einfache Tabelle
 * bearbeitbar; der Baum wird erst beim Darstellen aufgebaut.
 *
 * Wenn du hier etwas ändern willst …
 *   – Aussehen: css/blocks/file-tree.css.
 */

(function () {
  "use strict";

  const { el } = EM.require("js/core/dom.js");
  const { icon } = EM.require("js/ui/icons.js");
  const {
    blockError,
    blockSection,
    escapePipes,
    formatBlock,
    formatHeader,
    oneLine,
    splitPipes,
    trimLines,
    trackExercise,
  } = EM.require("js/blocks/block-utils.js");

  /**
   * @typedef {{depth: number, type: 'ordner'|'datei', name: string, description: string}} TreeItem
   * @typedef {{question: string, target: string}} TreeTask
   * @typedef {{title: string, items: TreeItem[], tasks: TreeTask[]}} FileTreeData
   */

  const FOLDER = "📁";
  const FILE = "📄";

  /** @type {import('./registry.js').BlockDefinition} */
  const definition = {
    name: "ordner",
    interactive: true,

    parse(raw) {
      const errors = [];
      const items = [];
      const tasks = [];
      const untyped = new Set();
      for (const { text, line } of trimLines(raw.lines)) {
        if (text.trim() === "") {
          continue;
        }
        const task = text.trim().match(/^\?\s*(.*?)\s*=>\s*(.+)$/);
        if (task) {
          tasks.push({ question: task[1], target: task[2].trim() });
          continue;
        }
        const item = text.replace(/\t/g, "  ").match(/^(\s*)-\s+(.*)$/);
        if (!item) {
          errors.push(
            blockError(
              raw,
              line,
              `Diese Zeile verstehe ich nicht: „${text.trim()}"`,
              'Einträge beginnen mit „- 📁 Name" oder „- 📄 Name", Aufgaben mit „? Frage => Pfad".',
            ),
          );
          continue;
        }
        let content = item[2].trim();
        let type = null;
        if (content.startsWith(FOLDER)) {
          type = "ordner";
        } else if (content.startsWith(FILE)) {
          type = "datei";
        }
        content = content.replace(/^(📁|📄)️?\s*/u, "");
        const [name, ...description] = splitPipes(content);
        if (type === null) {
          untyped.add(items.length);
        }
        items.push({
          depth: Math.floor(item[1].length / 2),
          type: type ?? "datei",
          name,
          description: description.join(" | "),
        });
      }
      // Ohne Symbol: Ordner, wenn der nächste Eintrag tiefer liegt, sonst Datei.
      for (const index of untyped) {
        if (items[index + 1]?.depth > items[index].depth) {
          items[index].type = "ordner";
        }
      }
      return { data: { title: raw.title, items, tasks }, errors };
    },

    validate(data, raw) {
      const errors = [];
      if (data.items.length === 0) {
        errors.push(
          blockError(
            raw,
            raw.line,
            "Der Baum ist leer.",
            'Füge Einträge wie „- 📁 01 Organisation" hinzu.',
          ),
        );
      }
      data.items.forEach((item, index) => {
        const previous = data.items[index - 1];
        if (item.depth > (previous ? previous.depth + 1 : 0)) {
          errors.push(
            blockError(
              raw,
              raw.line,
              `„${item.name}" ist zu weit eingerückt.`,
              "Pro Ebene genau zwei Leerzeichen mehr als der übergeordnete Ordner.",
            ),
          );
        }
        if (
          previous &&
          previous.type === "datei" &&
          item.depth > previous.depth
        ) {
          errors.push(
            blockError(
              raw,
              raw.line,
              `„${previous.name}" ist eine Datei, enthält aber Einträge.`,
              "Nur Ordner (📁) können Einträge enthalten.",
              "warnung",
            ),
          );
        }
      });
      const paths = new Set(
        buildPaths(data.items).map((path) => normalizePath(path)),
      );
      for (const task of data.tasks) {
        if (!paths.has(normalizePath(task.target))) {
          errors.push(
            blockError(
              raw,
              raw.line,
              `Das Ziel der Aufgabe „${task.question}" gibt es im Baum nicht: „${task.target}".`,
              'Schreibe den Pfad mit / zwischen den Ordnernamen, genau wie im Baum, z. B. „01 Organisation/Protokolle".',
            ),
          );
        }
      }
      return errors;
    },

    /**
     * @param {FileTreeData} data
     * @param {import("./block-utils.js").BlockContext} context
     */
    render(data, context) {
      const { section } = blockSection(
        "file-tree",
        data.title,
        context,
        "Ordnerstruktur",
      );
      const paths = buildPaths(data.items);
      const detail = el(
        "div",
        { class: "file-tree__detail", "aria-live": "polite" },
        el(
          "p",
          { class: "file-tree__placeholder" },
          "Wähle einen Ordner oder eine Datei aus.",
        ),
      );
      const tree = el("ul", {
        class: "file-tree__tree",
        role: "tree",
        "aria-label": data.title || "Ordnerstruktur",
      });
      /** @type {{item: TreeItem, node: HTMLElement, group: HTMLElement|null, parent: number, path: string}[]} */
      const nodes = [];
      let selected = -1;

      // ── Baum aus der flachen Liste aufbauen ──
      const containers = [tree];
      data.items.forEach((item, index) => {
        const isFolder = item.type === "ordner";
        const hasChildren = data.items[index + 1]?.depth > item.depth;
        const node = el(
          "li",
          {
            role: "treeitem",
            class: `file-tree__item file-tree__item--${item.type}`,
            tabindex: -1,
            "aria-selected": "false",
            "aria-expanded": isFolder && hasChildren ? "false" : null,
            "aria-level": item.depth + 1,
          },
          el(
            "span",
            { class: "file-tree__label" },
            el(
              "span",
              { class: "file-tree__icon", "aria-hidden": "true" },
              isFolder ? FOLDER : FILE,
            ),
            item.name,
          ),
        );
        const group =
          isFolder && hasChildren
            ? el("ul", { role: "group", class: "file-tree__group" })
            : null;
        if (group) {
          node.append(group);
        }
        const container = containers[item.depth] ?? tree;
        container.append(node);
        containers.length = item.depth + 1;
        if (group) {
          containers[item.depth + 1] = group;
        }
        const parent = findParent(data.items, index);
        nodes.push({ item, node, group, parent, path: paths[index] });
      });
      // aria-setsize/aria-posinset: Position innerhalb der eigenen Ebene
      for (const container of [
        tree,
        ...tree.querySelectorAll('[role="group"]'),
      ]) {
        const siblings = [...container.children];
        siblings.forEach((sibling, position) => {
          sibling.setAttribute("aria-setsize", String(siblings.length));
          sibling.setAttribute("aria-posinset", String(position + 1));
        });
      }
      if (nodes[0]) {
        nodes[0].node.tabIndex = 0;
      }

      // ── Bedienung ──
      function isVisible(index) {
        let parent = nodes[index].parent;
        while (parent !== -1) {
          if (nodes[parent].node.getAttribute("aria-expanded") !== "true") {
            return false;
          }
          parent = nodes[parent].parent;
        }
        return true;
      }
      function visibleIndexes() {
        return nodes.map((_, index) => index).filter(isVisible);
      }

      function focusNode(index) {
        for (const entry of nodes) {
          entry.node.tabIndex = -1;
        }
        nodes[index].node.tabIndex = 0;
        nodes[index].node.focus();
      }
      function setExpanded(index, expanded) {
        if (nodes[index].group) {
          nodes[index].node.setAttribute("aria-expanded", String(expanded));
        }
      }
      function select(index) {
        if (selected !== -1) {
          nodes[selected].node.setAttribute("aria-selected", "false");
        }
        selected = index;
        nodes[index].node.setAttribute("aria-selected", "true");
        const { item, path } = nodes[index];
        detail.replaceChildren(
          el(
            "p",
            { class: "file-tree__path" },
            el("span", { class: "visually-hidden" }, "Ausgewählt: "),
            path,
          ),
          item.description
            ? el("p", {}, context.renderInline(item.description))
            : el(
                "p",
                { class: "file-tree__placeholder" },
                item.type === "ordner"
                  ? "Ordner ohne Beschreibung."
                  : "Datei ohne Beschreibung.",
              ),
        );
      }
      function indexOf(target) {
        return nodes.findIndex(
          (entry) => entry.node === target.closest('[role="treeitem"]'),
        );
      }

      tree.addEventListener("click", (event) => {
        const index = indexOf(/** @type {HTMLElement} */ (event.target));
        if (index === -1) {
          return;
        }
        event.stopPropagation();
        if (nodes[index].group) {
          setExpanded(
            index,
            nodes[index].node.getAttribute("aria-expanded") !== "true",
          );
        }
        focusNode(index);
        select(index);
      });

      tree.addEventListener("keydown", (event) => {
        const index = indexOf(/** @type {HTMLElement} */ (event.target));
        if (index === -1) {
          return;
        }
        const visible = visibleIndexes();
        const position = visible.indexOf(index);
        const expanded = nodes[index].node.getAttribute("aria-expanded");
        const actions = {
          ArrowDown: () =>
            position < visible.length - 1 && focusNode(visible[position + 1]),
          ArrowUp: () => position > 0 && focusNode(visible[position - 1]),
          Home: () => focusNode(visible[0]),
          End: () => focusNode(visible[visible.length - 1]),
          ArrowRight: () => {
            if (expanded === "false") {
              setExpanded(index, true);
            } else if (expanded === "true") {
              focusNode(index + 1);
            }
          },
          ArrowLeft: () => {
            if (expanded === "true") {
              setExpanded(index, false);
            } else if (nodes[index].parent !== -1) {
              focusNode(nodes[index].parent);
            }
          },
          Enter: () => {
            if (expanded !== null) {
              setExpanded(index, expanded !== "true");
            }
            select(index);
          },
          " ": () => select(index),
        };
        if (actions[event.key]) {
          event.preventDefault();
          actions[event.key]();
        }
      });

      section.append(
        el(
          "p",
          { class: "block__hint" },
          "Öffne Ordner per Klick oder mit den Pfeiltasten.",
        ),
        el("div", { class: "file-tree__explorer" }, tree, detail),
      );

      // ── Suchaufgaben ──
      if (data.tasks.length > 0) {
        const markSolved = trackExercise(
          section,
          context,
          `ordner:${JSON.stringify(data.tasks)}`,
        );
        const found = new Set();
        section.append(
          el("h3", { class: "file-tree__tasks-title" }, "Finde es selbst"),
          el(
            "ol",
            { class: "file-tree__tasks" },
            data.tasks.map((task, taskIndex) => {
              const feedback = el("div", {
                class: "file-tree__feedback",
                "aria-live": "polite",
              });
              let attempts = 0;
              const button = el(
                "button",
                { type: "button", class: "button button--small" },
                "Auswahl prüfen",
              );
              button.addEventListener("click", () => {
                if (selected === -1) {
                  feedback.replaceChildren(
                    el(
                      "p",
                      { class: "feedback feedback--hint" },
                      "Wähle zuerst im Baum oben einen Ordner oder eine Datei aus.",
                    ),
                  );
                  return;
                }
                const ok =
                  normalizePath(nodes[selected].path) ===
                  normalizePath(task.target);
                attempts += 1;
                if (ok) {
                  found.add(taskIndex);
                  if (found.size === data.tasks.length) {
                    markSolved();
                  }
                }
                const top = task.target.split("/")[0];
                feedback.replaceChildren(
                  el(
                    "p",
                    { class: `feedback feedback--${ok ? "correct" : "wrong"}` },
                    icon(ok ? "check" : "cross", "feedback__icon"),
                    ok
                      ? el("strong", {}, "Gefunden!")
                      : [
                          el("strong", {}, "Noch nicht. "),
                          `Du hast „${nodes[selected].path}" gewählt. `,
                          attempts === 1
                            ? `Tipp: Schau in „${top}".`
                            : `Gesucht ist: ${task.target}.`,
                        ],
                  ),
                );
              });
              return el(
                "li",
                { class: "file-tree__task" },
                el("p", {}, context.renderInline(task.question)),
                button,
                feedback,
              );
            }),
          ),
        );
      }
      return section;
    },

    /** @param {FileTreeData} data */
    serialize(data) {
      const lines = data.items.map(
        (item) =>
          `${"  ".repeat(item.depth)}- ${item.type === "ordner" ? FOLDER : FILE} ${escapePipes(item.name)}${item.description ? ` | ${escapePipes(item.description)}` : ""}`,
      );
      for (const task of data.tasks) {
        lines.push(
          `? ${oneLine(task.question).replace(/=>/g, "→")} => ${oneLine(task.target)}`,
        );
      }
      return formatBlock(formatHeader("ordner", data.title), lines);
    },

    editor: {
      label: "Ordner-Explorer",
      description:
        "Nachgebaute Drive-Ordnerstruktur zum Durchklicken, optional mit Suchaufgaben.",
      icon: "assets/icons/ordner.svg",
      createDefault: () => ({
        title: "Unser Drive",
        items: [
          {
            depth: 0,
            type: "ordner",
            name: "01 Ordner",
            description: "Was liegt hier?",
          },
          { depth: 1, type: "datei", name: "Beispieldatei", description: "" },
        ],
        tasks: [
          {
            question: "Wo liegt die Beispieldatei?",
            target: "01 Ordner/Beispieldatei",
          },
        ],
      }),
      fields: [
        { key: "title", type: "text", label: "Überschrift" },
        {
          key: "items",
          type: "list",
          label: "Einträge (von oben nach unten)",
          itemLabel: "Eintrag",
          min: 1,
          help: "Ebene 0 = oberste Ebene. Ein Eintrag mit höherer Ebene liegt im Ordner darüber.",
          itemFields: [
            { key: "depth", type: "number", label: "Ebene", min: 0, max: 6 },
            {
              key: "type",
              type: "select",
              label: "Art",
              options: ["ordner", "datei"],
            },
            { key: "name", type: "text", label: "Name", required: true },
            { key: "description", type: "text", label: "Beschreibung" },
          ],
        },
        {
          key: "tasks",
          type: "list",
          label: "Suchaufgaben (optional)",
          itemLabel: "Aufgabe",
          itemFields: [
            { key: "question", type: "text", label: "Frage", required: true },
            {
              key: "target",
              type: "text",
              label: "Ziel (Pfad mit /)",
              required: true,
              help: "z. B. 01 Organisation/Protokolle",
            },
          ],
        },
      ],
    },
  };

  /** Pfad jedes Eintrags, z. B. „01 Organisation/Protokolle". */
  function buildPaths(items) {
    const stack = [];
    return items.map((item) => {
      stack.length = item.depth;
      stack[item.depth] = item.name;
      return stack.slice(0, item.depth + 1).join("/");
    });
  }

  /** Index des übergeordneten Eintrags (-1 = oberste Ebene). */
  function findParent(items, index) {
    for (let i = index - 1; i >= 0; i -= 1) {
      if (items[i].depth < items[index].depth) {
        return i;
      }
    }
    return -1;
  }

  /** Pfade vergleichbar machen: Groß-/Kleinschreibung und Leerzeichen um / egal. */
  function normalizePath(path) {
    return path
      .split("/")
      .map((part) => part.trim().toLocaleLowerCase("de"))
      .filter(Boolean)
      .join("/");
  }

  EM.define("js/blocks/file-tree.js", { default: definition });
})();
