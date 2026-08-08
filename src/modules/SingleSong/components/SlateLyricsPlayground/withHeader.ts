import { Editor, Element, Node, Transforms, type Descendant, type Path } from "slate";
import { keys as VALID_KEYS } from "#utils/keyUtils";

import type { SongMetaRowElement } from "./types";

export const DEFAULT_NAME = "";
export const DEFAULT_BPM = "0";
export const DEFAULT_TIME_SIGNATURE = "4/4";
export const DEFAULT_KEY = "C";

const VALID_KEYS_SET = new Set(VALID_KEYS);

const META_CHILDREN_ORDER: Array<
  "bpm" | "time-signature" | "song-key" | "capo"
> = ["bpm", "time-signature", "song-key", "capo"];

/**
 * `song-meta-row` разом з його шляхом. Існування гарантує `withHeader`, але
 * до першої нормалізації (або в тестових фрагментах) рядка може не бути.
 *
 * Живе тут, бо саме цей плагін тримає інваріант «children[1] — song-meta-row».
 * Це не лише рядок BPM/тональності, а й сховище метаданих документа:
 * per-user фільтри показу (`display/model.ts`) і примітки
 * (`comments/noteStore.ts`).
 */
export function findMetaRow(editor: Editor): [SongMetaRowElement, Path] | null {
  for (const [node, path] of Node.elements(editor)) {
    if ((node as { type?: string }).type === "song-meta-row") {
      return [node as unknown as SongMetaRowElement, path];
    }
  }
  return null;
}

export function makeDefaultSongName(text = DEFAULT_NAME): Descendant {
  return { type: "song-name", children: [{ text }] } as Descendant;
}

export function makeDefaultBpm(text = DEFAULT_BPM): Descendant {
  return { type: "bpm", children: [{ text }] } as Descendant;
}

export function makeDefaultTimeSignature(text = DEFAULT_TIME_SIGNATURE): Descendant {
  return { type: "time-signature", children: [{ text }] } as Descendant;
}

export function makeDefaultSongKey(keyValue = DEFAULT_KEY): Descendant {
  return { type: "song-key", keyValue, children: [{ text: "" }] } as Descendant;
}

export function makeDefaultCapo(): Descendant {
  return { type: "capo", valuesBy: {}, children: [{ text: "" }] } as Descendant;
}

export function makeDefaultMetaRow(): Descendant {
  return {
    type: "song-meta-row",
    children: [
      makeDefaultBpm(),
      makeDefaultTimeSignature(),
      makeDefaultSongKey(),
      makeDefaultCapo(),
    ],
  } as Descendant;
}

/**
 * Enforces document-header invariants:
 *   - editor.children[0] is always a `song-name` block
 *   - editor.children[1] is always a `song-meta-row` block
 *   - song-meta-row's children are exactly [bpm, time-signature, song-key, capo] in that order
 *   - song-key.keyValue is one of VALID_KEYS, otherwise reset to DEFAULT_KEY
 *
 * Runs on every client (no leader-gating). Insertions made here are deterministic
 * given the current state, so concurrent insertions converge in Yjs (worst case:
 * a brief moment with two header blocks, then normalizer collapses).
 */
export const withHeader = (editor: Editor) => {
  const { normalizeNode } = editor;

  editor.normalizeNode = (entry) => {
    const [node, path] = entry;

    // Top-level invariants run when normalizing the editor itself.
    if (Editor.isEditor(node)) {
      // 1. Ensure first child is song-name.
      const first = node.children[0];
      if (!Element.isElement(first) || first.type !== "song-name") {
        Transforms.insertNodes(editor, makeDefaultSongName(), { at: [0] });
        return;
      }

      // 2. Ensure second child is song-meta-row.
      const second = node.children[1];
      if (!Element.isElement(second) || second.type !== "song-meta-row") {
        Transforms.insertNodes(editor, makeDefaultMetaRow(), { at: [1] });
        return;
      }

      // 3. Disallow more than one of each header block at root.
      for (let i = 2; i < node.children.length; i++) {
        const child = node.children[i];
        if (
          Element.isElement(child) &&
          (child.type === "song-name" || child.type === "song-meta-row")
        ) {
          Transforms.removeNodes(editor, { at: [i] });
          return;
        }
      }
    }

    // song-meta-row child shape & order.
    if (Element.isElement(node) && node.type === "song-meta-row") {
      const children = node.children;

      // Ensure exact length.
      if (children.length < META_CHILDREN_ORDER.length) {
        const missingIndex = children.length;
        const missingType = META_CHILDREN_ORDER[missingIndex];
        Transforms.insertNodes(editor, makeChildOfType(missingType), {
          at: [...path, missingIndex],
        });
        return;
      }

      // Ensure order.
      for (let i = 0; i < META_CHILDREN_ORDER.length; i++) {
        const expected = META_CHILDREN_ORDER[i];
        const actual = children[i];
        if (!Element.isElement(actual) || actual.type !== expected) {
          // Replace the slot by inserting the expected default and removing the wrong one.
          Transforms.insertNodes(editor, makeChildOfType(expected), {
            at: [...path, i],
          });
          Transforms.removeNodes(editor, { at: [...path, i + 1] });
          return;
        }
      }

      // Trim extras beyond the canonical 4.
      if (children.length > META_CHILDREN_ORDER.length) {
        Transforms.removeNodes(editor, {
          at: [...path, META_CHILDREN_ORDER.length],
        });
        return;
      }
    }

    // song-key.keyValue must be from VALID_KEYS.
    if (Element.isElement(node) && node.type === "song-key") {
      if (!node.keyValue || !VALID_KEYS_SET.has(node.keyValue)) {
        Transforms.setNodes(editor, { keyValue: DEFAULT_KEY }, { at: path });
        return;
      }
    }

    normalizeNode(entry);
  };

  return editor;
};

function makeChildOfType(type: typeof META_CHILDREN_ORDER[number]): Descendant {
  switch (type) {
    case "bpm":
      return makeDefaultBpm();
    case "time-signature":
      return makeDefaultTimeSignature();
    case "song-key":
      return makeDefaultSongKey();
    case "capo":
      return makeDefaultCapo();
  }
}
