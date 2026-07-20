import { Editor, Element, Node, Transforms } from "slate";
import { isChordsLine } from "#utils/keyUtils";

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
          Transforms.mergeNodes(editor, { at: [...path, i + 1] });
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
              Transforms.liftNodes(editor, { at: [...path, i] });
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
