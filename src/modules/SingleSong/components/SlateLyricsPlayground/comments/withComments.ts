import { Editor, Element, Node, Path, Range, Text, Transforms } from "slate";

import type {
  CommentAnchorElement,
  CommentMark,
  CustomText,
} from "../types";

const ANCHOR_TYPE = "comment-anchor";

const COMMENTABLE_BLOCK_TYPES = new Set([
  "line",
  "chord-line",
  "empty-line",
  "lyric-line",
  "header",
]);

export const isCommentAnchor = (n: unknown): n is CommentAnchorElement =>
  Element.isElement(n as Element) && (n as Element).type === ANCHOR_TYPE;

const getMarks = (leaf: CustomText): CommentMark[] =>
  Array.isArray(leaf.comment) ? leaf.comment : [];

const makeAnchor = (
  commentId: string,
  visibleFor: string[],
  color: string,
  body: string,
  author: string | undefined,
): CommentAnchorElement => ({
  type: "comment-anchor",
  commentId,
  visibleFor,
  color,
  body,
  author,
  children: [{ text: "" }],
});

export type WithCommentsOptions = {
  /**
   * Called inside `normalizeNode` right before an orphaned anchor (one whose
   * underlying text marks are all gone) is removed. Lets the caller persist
   * the anchor's body somewhere safe (e.g. a Y.Map of lost comments).
   */
  onAnchorOrphaned?: (data: {
    commentId: string;
    body: string;
    color: string;
    visibleFor: string[];
    author?: string;
  }) => void;
};

/**
 * Orphan = no text leaf in the document carries this commentId AND has
 * non-empty text. Empty marked leaves (`{text:"", comment:[...]}`) left
 * over from deletions do NOT count — the user expects the anchor to die
 * when there's nothing visibly highlighted anymore.
 */
const isAnchorOrphaned = (editor: Editor, commentId: string): boolean => {
  for (const [n] of Editor.nodes(editor, {
    at: [],
    match: (m) =>
      Text.isText(m) &&
      (m as CustomText).text.length > 0 &&
      getMarks(m as CustomText).some((c) => c.commentId === commentId),
  })) {
    if (n) return false;
  }
  return true;
};

const reportAndRemoveAnchor = (
  editor: Editor,
  anchor: CommentAnchorElement,
  path: Path,
  opts: WithCommentsOptions,
): void => {
  opts.onAnchorOrphaned?.({
    commentId: anchor.commentId,
    body: anchor.body,
    color: anchor.color,
    visibleFor: anchor.visibleFor,
    author: anchor.author,
  });
  Transforms.removeNodes(editor, { at: path });
};

export const withComments = (
  editor: Editor,
  opts: WithCommentsOptions = {},
) => {
  const { isVoid, normalizeNode } = editor;

  editor.isVoid = (element) =>
    element.type === ANCHOR_TYPE ? true : isVoid(element);

  editor.normalizeNode = (entry) => {
    const [node, path] = entry;

    // Strip comment marks from empty text leaves. Slate doesn't remove
    // `{text: ""}` leaves automatically, and a leftover empty marked leaf
    // (a) shows up as a thin colored "cursor bar" in renderLeaf and
    // (b) would silently colour-mark anything the user types into it.
    if (Text.isText(node)) {
      const t = node as CustomText;
      if (
        t.text.length === 0 &&
        Array.isArray(t.comment) &&
        t.comment.length > 0
      ) {
        Transforms.unsetNodes(editor, "comment", { at: path });
        return;
      }
    }

    // Direct check: when normalizer iterates over the anchor itself.
    if (isCommentAnchor(node)) {
      if (isAnchorOrphaned(editor, node.commentId)) {
        reportAndRemoveAnchor(editor, node, path, opts);
        return;
      }
    }

    // Indirect check: text-edits dirty the line + the section (ancestors),
    // not the sibling anchor inside the same section. So when a section
    // gets normalized we manually iterate its anchor children. Back-to-
    // front so a removal doesn't invalidate the remaining indices.
    if (Element.isElement(node) && node.type === "section") {
      for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i];
        if (
          isCommentAnchor(child) &&
          isAnchorOrphaned(editor, child.commentId)
        ) {
          reportAndRemoveAnchor(editor, child, [...path, i], opts);
          return;
        }
      }
    }

    normalizeNode(entry);
  };

  return editor;
};

// ---------- internal: apply the comment mark (merge into array) ----------

const applyMark = (
  editor: Editor,
  newMark: CommentMark,
  markerKey: string,
): void => {
  Transforms.setNodes(
    editor,
    { [markerKey]: true } as unknown as Partial<CustomText>,
    { match: Text.isText, split: true },
  );

  const entries: Array<[CustomText, Path]> = [];
  for (const [n, p] of Editor.nodes(editor, {
    at: [],
    match: (m) =>
      Text.isText(m) &&
      (m as unknown as Record<string, unknown>)[markerKey] === true,
  })) {
    entries.push([n as CustomText, p]);
  }
  for (const [leaf, p] of entries) {
    const merged = [...getMarks(leaf), newMark];
    Transforms.setNodes(
      editor,
      { comment: merged } as Partial<CustomText>,
      { at: p },
    );
    Transforms.unsetNodes(editor, markerKey, { at: p });
  }
};

const targetBlockForSelection = (editor: Editor): Path | null => {
  const { selection } = editor;
  if (!selection || Range.isCollapsed(selection)) return null;
  const [start] = Range.edges(selection);
  const entry = Editor.above(editor, {
    at: start,
    match: (n) =>
      Element.isElement(n) &&
      Editor.isBlock(editor, n) &&
      COMMENTABLE_BLOCK_TYPES.has((n as { type: string }).type),
    mode: "lowest",
  });
  return entry ? entry[1] : null;
};

// ---------- public API ----------

/** Apply a color highlight to the current selection. No anchor inserted. */
export const addHighlight = (
  editor: Editor,
  commentId: string,
  visibleFor: string[],
  color: string,
  author?: string,
): void => {
  if (targetBlockForSelection(editor) === null) return;
  const mark: CommentMark = { commentId, visibleFor, color, author };
  Editor.withoutNormalizing(editor, () => {
    applyMark(editor, mark, `__cAdd_${commentId}`);
  });
};

/**
 * Apply a comment mark to the current selection AND insert a comment-anchor
 * pseudo-row above the block containing the selection start.
 */
export const addNote = (
  editor: Editor,
  commentId: string,
  visibleFor: string[],
  color: string,
  body = "",
  author?: string,
): void => {
  const blockPath = targetBlockForSelection(editor);
  if (!blockPath) return;
  const mark: CommentMark = { commentId, visibleFor, color, author };

  Editor.withoutNormalizing(editor, () => {
    applyMark(editor, mark, `__cAdd_${commentId}`);
    Transforms.insertNodes(
      editor,
      makeAnchor(commentId, visibleFor, color, body, author),
      { at: blockPath, select: false },
    );
  });
};

/**
 * Promote an existing highlight (mark-only) into a note by inserting an
 * anchor pseudo-row above the first block carrying this commentId.
 * No-op if an anchor for this commentId already exists.
 */
export const convertHighlightToNote = (
  editor: Editor,
  commentId: string,
  body = "",
): void => {
  for (const [n] of Editor.nodes(editor, {
    at: [],
    match: (m) => isCommentAnchor(m) && m.commentId === commentId,
  })) {
    if (n) return;
  }
  let leafEntry: [CustomText, Path] | null = null;
  for (const [n, p] of Editor.nodes(editor, {
    at: [],
    match: (m) =>
      Text.isText(m) &&
      getMarks(m as CustomText).some((c) => c.commentId === commentId),
  })) {
    leafEntry = [n as CustomText, p];
    break;
  }
  if (!leafEntry) return;

  const [leaf, leafPath] = leafEntry;
  const mark = getMarks(leaf).find((c) => c.commentId === commentId);
  if (!mark) return;

  const blockPath = Path.parent(leafPath);
  Transforms.insertNodes(
    editor,
    makeAnchor(commentId, mark.visibleFor, mark.color, body, mark.author),
    { at: blockPath, select: false },
  );
};

/** Remove a comment fully: strip mark from all leaves, remove anchor if any. */
export const removeComment = (editor: Editor, commentId: string): void => {
  Editor.withoutNormalizing(editor, () => {
    const matches: Array<[CustomText, Path]> = [];
    for (const [n, p] of Editor.nodes(editor, {
      at: [],
      match: (m) =>
        Text.isText(m) &&
        getMarks(m as CustomText).some((c) => c.commentId === commentId),
    })) {
      matches.push([n as CustomText, p]);
    }
    for (const [leaf, p] of matches) {
      const filtered = getMarks(leaf).filter(
        (c) => c.commentId !== commentId,
      );
      if (filtered.length === 0) {
        Transforms.unsetNodes(editor, "comment", { at: p });
      } else {
        Transforms.setNodes(
          editor,
          { comment: filtered } as Partial<CustomText>,
          { at: p },
        );
      }
    }

    const anchorPaths: Path[] = [];
    for (const [, p] of Editor.nodes(editor, {
      at: [],
      match: (n) => isCommentAnchor(n) && n.commentId === commentId,
    })) {
      anchorPaths.push(p);
    }
    anchorPaths
      .sort((a, b) => Path.compare(b, a))
      .forEach((p) => Transforms.removeNodes(editor, { at: p }));
  });
};

/**
 * Remove only the note's anchor (card) while keeping the highlight mark on
 * text. Effectively demotes a note back to a highlight.
 */
export const removeNoteOnly = (editor: Editor, commentId: string): void => {
  const anchorPaths: Path[] = [];
  for (const [, p] of Editor.nodes(editor, {
    at: [],
    match: (n) => isCommentAnchor(n) && n.commentId === commentId,
  })) {
    anchorPaths.push(p);
  }
  if (anchorPaths.length === 0) return;
  Editor.withoutNormalizing(editor, () => {
    anchorPaths
      .sort((a, b) => Path.compare(b, a))
      .forEach((p) => Transforms.removeNodes(editor, { at: p }));
  });
};

/** Returns true iff a comment-anchor exists in the doc for this commentId. */
export const hasAnchor = (editor: Editor, commentId: string): boolean => {
  for (const [n] of Editor.nodes(editor, {
    at: [],
    match: (m) => isCommentAnchor(m) && m.commentId === commentId,
  })) {
    if (n) return true;
  }
  return false;
};

export const updateCommentBody = (
  editor: Editor,
  commentId: string,
  body: string,
): void => {
  for (const [, p] of Editor.nodes(editor, {
    at: [],
    match: (n) => isCommentAnchor(n) && n.commentId === commentId,
  })) {
    Transforms.setNodes(editor, { body } as Partial<CommentAnchorElement>, {
      at: p,
    });
  }
};

export const findAnchorPath = (
  editor: Editor,
  commentId: string,
): Path | null => {
  for (const [, p] of Editor.nodes(editor, {
    at: [],
    match: (n) => isCommentAnchor(n) && n.commentId === commentId,
  })) {
    return p;
  }
  return null;
};

export { Node };
