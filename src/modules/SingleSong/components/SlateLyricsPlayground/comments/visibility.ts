/**
 * Visibility model for comment marks/anchors.
 *
 * Every mark and anchor carries a `visibleFor: string[]` list. The literal
 * string "all" inside that list means "show to everyone". For now we treat
 * visibility and manage-rights as the same — anyone in `visibleFor` (or
 * everyone when "all" is present) can see and manage the mark. We can
 * tighten this later (e.g. introduce a separate creator field).
 */

export const AUDIENCE_ALL = "all";

export const isVisibleTo = (
  source: { visibleFor?: string[] },
  me: string | undefined,
): boolean => {
  const list = source.visibleFor;
  if (!Array.isArray(list) || list.length === 0) return false;
  if (list.includes(AUDIENCE_ALL)) return true;
  if (!me) return false;
  return list.includes(me);
};

/**
 * True iff the comment is addressed to exactly one person — `username`.
 * Distinguishes "my own private note" from one I wrote *for* somebody else,
 * which matters when deciding whether a deletion should surface as lost.
 */
export const isPrivateTo = (
  source: { visibleFor?: string[] },
  username: string | undefined,
): boolean => {
  const list = source.visibleFor;
  if (!username || !Array.isArray(list)) return false;
  return list.length === 1 && list[0] === username;
};

export const privateTo = (username: string): string[] => [username];
export const publicVisibility = (): string[] => [AUDIENCE_ALL];
