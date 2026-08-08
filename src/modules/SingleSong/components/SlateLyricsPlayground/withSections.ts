import { Editor, Element, Node, Path, Transforms } from "slate";
import { isChordsLine } from "#utils/keyUtils";
import { mergeSectionAttrs, splitSectionAttrs, toSetNodesProps } from "./sectionAttrs";
import type { SectionElement } from "./types";

export const withSections = (editor: Editor) => {
  const { normalizeNode } = editor;

  editor.normalizeNode = (entry) => {
    const [node, path] = entry;

    // 1. Root level normalizations
    if (Editor.isEditor(node)) {
      // Merge adjacent sections
      for (let i = 0; i < node.children.length - 1; i++) {
        const child = node.children[i];
        const nextChild = node.children[i + 1];

        if (
          Element.isElement(child) &&
          child.type === "section" &&
          Element.isElement(nextChild) &&
          nextChild.type === "section"
        ) {
          // Атрибути злитої секції рахуємо ДО merge: `Transforms.mergeNodes`
          // лишає пропси верхнього вузла й мовчки викидає пропси нижнього —
          // правильно для повторів, але не для динаміки й згортання.
          // Правила — `sectionAttrs.ts`.
          Editor.withoutNormalizing(editor, () => {
            Transforms.setNodes<SectionElement>(
              editor,
              toSetNodesProps(mergeSectionAttrs(child, nextChild), child),
              { at: [...path, i] },
            );
            Transforms.mergeNodes(editor, { at: [...path, i + 1] });
          });
          return; // return and let normalize run again
        }
      }
      return normalizeNode(entry);
    }

    if (!Element.isElement(node)) {
      return normalizeNode(entry);
    }

    switch (node.type) {
      case "empty-line": {
        // 2. empty-line normalizations
        const str = Node.string(node);
        if (str.length > 0) {
          Transforms.setNodes(editor, { type: "line" }, { at: path });
          Transforms.wrapNodes(editor, { type: "section", children: [] }, { at: path });
          return;
        }
        break;
      }

      case "section": {
        // 3. section normalizations
        if (node.children.length === 0) {
          Transforms.removeNodes(editor, { at: path });
          return;
        }

        // 4. line normalizations inside section
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          if (!Element.isElement(child)) continue;
          
          if (child.type === "line" || child.type === "chord-line") {
            const str = Node.string(child);
            if (str.length === 0) {
              // Порожній рядок усередині секції — це межа: `liftNodes` виносить
              // його в корінь і ділить секцію навпіл. Slate копіює в нову секцію
              // ВСІ пропси, тож повтори й чужий стан згортання довелось би
              // успадкувати — перерозподіляємо явно (`sectionAttrs.ts`).
              // Рядок першим або останнім секцію не ділить: вузол просто
              // виноситься перед нею або після неї.
              const splits = i > 0 && i < node.children.length - 1;
              const attrs = splits
                ? splitSectionAttrs(
                    node,
                    node.children.slice(0, i),
                    node.children.slice(i + 1),
                  )
                : null;

              Editor.withoutNormalizing(editor, () => {
                Transforms.liftNodes(editor, { at: [...path, i] });
                if (attrs) {
                  Transforms.setNodes<SectionElement>(
                    editor,
                    toSetNodesProps(attrs.upper, node),
                    { at: path },
                  );
                  // Після виносу: секція → порожній рядок → нова секція.
                  Transforms.setNodes<SectionElement>(
                    editor,
                    toSetNodesProps(attrs.lower, node),
                    { at: Path.next(Path.next(path)) },
                  );
                }
              });
              return;
            }

            const onlyChords = isChordsLine(str);
            if (onlyChords && child.type === "line") {
              Transforms.setNodes(editor, { type: "chord-line" }, { at: [...path, i] });
              return;
            } else if (!onlyChords && child.type === "chord-line") {
              Transforms.setNodes(editor, { type: "line" }, { at: [...path, i] });
              return;
            }
          }
        }
        break;
      }

      case "line":
      case "chord-line": {
        // Handle 'line' or 'chord-line' at root (happens immediately after lifting from section).
        // Skip indices 0 and 1 — those are reserved for the document header (song-name + song-meta-row).
        if (path.length === 1 && path[0] >= 2) {
          const str = Node.string(node);
          if (str.length === 0) {
            Transforms.setNodes(editor, { type: "empty-line" }, { at: path });
          } else {
            Transforms.wrapNodes(editor, { type: "section", children: [] }, { at: path });
          }
          return;
        }
        break;
      }
    }

    // Fall back to original normalizeNode
    normalizeNode(entry);
  };

  return editor;
};
