export type CommentColor = {
  name: string;
  hex: string;
};

export const COMMENT_PALETTE: CommentColor[] = [
  { name: "yellow", hex: "#F5C518" },
  { name: "pink", hex: "#E91E63" },
  { name: "green", hex: "#4CAF50" },
  { name: "blue", hex: "#2196F3" },
  { name: "orange", hex: "#FF5722" },
];

export const DEFAULT_COMMENT_COLOR = COMMENT_PALETTE[0].hex;

// Fixed color for public (visible-to-everyone) comments. Always neutral gray.
export const PUBLIC_COMMENT_COLOR = "#6B7280";

// Neutral tone for OTHER users' private marks — drawn ONLY in edit mode, where
// a deletion could wipe out somebody else's anchor: you see that something is
// annotated there, but neither the real color nor the note body. Distinct from
// PUBLIC_COMMENT_COLOR so users can tell "someone's private note" apart from a
// public one at a glance. In read and notes mode these marks aren't drawn.
export const OTHERS_NEUTRAL_COLOR = "#9CA3AF";

// Закреслення — позначка БЕЗ кольору: замість підсвітки текст перекреслюється
// рискою. Живе в тому ж полі `color` мітки/примітки як рядок-sentinel, а не як
// окреме поле: так значення само доїжджає всюди, де вже носиться колір —
// у Yjs-мітку, в `NoteRecord`, у втрачені коментарі, у
// `convertHighlightToNote` — без жодного протягування параметрів.
// Тому `color` не завжди hex; усе, що його малює, іде через `resolveHex`.
export const STRIKE_COLOR = "strike";

// Реальний колір, яким малюється риска й тонуються картка та кнопки.
// Навмисно не PUBLIC_COMMENT_COLOR, щоб закреслення не читалось як публічний
// коментар.
export const STRIKE_INK = "#374151";

export const isStrike = (color: string): boolean => color === STRIKE_COLOR;

const resolveHex = (color: string): string =>
  isStrike(color) ? STRIKE_INK : color;

const HIGHLIGHT_ALPHA = 0.32;
const CARD_BG_ALPHA = 0.18;

const hexToRgb = (hex: string): [number, number, number] => {
  const cleaned = hex.replace("#", "");
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  const num = parseInt(full, 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
};

export const hexToRgba = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgb(resolveHex(hex));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const highlightBg = (hex: string): string =>
  hexToRgba(hex, HIGHLIGHT_ALPHA);

export const cardBg = (hex: string): string => hexToRgba(hex, CARD_BG_ALPHA);

export const cardBorder = (hex: string): string => resolveHex(hex);
