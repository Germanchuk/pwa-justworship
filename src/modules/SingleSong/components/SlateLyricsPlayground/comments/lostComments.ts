import type * as Y from "yjs";

/**
 * Top-level Y.Map (sibling of the Y.XmlText "content" used by Slate) that
 * preserves the body of any comment-anchor that got orphaned because its
 * underlying text was deleted by another editor. The author can later view
 * the body, copy it, and decide to discard.
 *
 * Storing it at the Y.Doc root (not inside Y.XmlText) keeps it independent
 * of Slate's normalization pipeline and survives any text edits.
 */

export const LOST_COMMENTS_KEY = "lostComments";

export type LostComment = {
  commentId: string;
  body: string;
  color: string;
  visibleFor: string[];
  author?: string;
  timestamp: number;
};

export const getLostCommentsMap = (ydoc: Y.Doc): Y.Map<LostComment> =>
  ydoc.getMap(LOST_COMMENTS_KEY) as Y.Map<LostComment>;

export const pushLostComment = (
  ydoc: Y.Doc,
  data: Omit<LostComment, "timestamp">,
): void => {
  const map = getLostCommentsMap(ydoc);
  map.set(data.commentId, { ...data, timestamp: Date.now() });
};

export const removeLostComment = (ydoc: Y.Doc, commentId: string): void => {
  const map = getLostCommentsMap(ydoc);
  map.delete(commentId);
};

export const listLostComments = (ydoc: Y.Doc): LostComment[] => {
  const map = getLostCommentsMap(ydoc);
  const out: LostComment[] = [];
  map.forEach((v) => out.push(v));
  return out;
};
