/**
 * Tiny one-slot registry to hand off "please focus this comment's textarea"
 * intent from the action that creates the note to the NoteCard that mounts
 * shortly after. Module-scoped so it works across components without
 * threading state through props or context.
 */

let pending: string | null = null;

export const setPendingFocus = (commentId: string): void => {
  pending = commentId;
};

export const consumePendingFocus = (commentId: string): boolean => {
  if (pending !== commentId) return false;
  pending = null;
  return true;
};
