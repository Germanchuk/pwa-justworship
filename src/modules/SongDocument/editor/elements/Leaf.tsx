/**
 * Символи тексту: позначене приміткою — підсвічене її кольором (кілька
 * позначок на одному місці — шарами, видно всі, `NOTE-11`); чуже в правці —
 * сірим (`NOTE-15`); «/» структурної примітки — приглушений.
 *
 * Декорація примітки — окремий ключ `n:<id>` (колір) чи `f:<id>` (чужа): Slate
 * зливає пропи накладених декорацій в один листок, і спільний ключ лишив би
 * лише одну. `data-notes` — id позначок під символом: тап по ньому обирає їх.
 */
import { RenderLeafProps } from "slate-react";
import { highlightBg, isStrike, OTHERS_NEUTRAL_COLOR, STRIKE_INK } from "#modules/SingleSong/components/SlateLyricsPlayground/comments/colors";

export const NOTE_KEY = "n:";
export const FOREIGN_KEY = "f:";

export function Leaf({ attributes, children, leaf }: RenderLeafProps) {
  const props = leaf as unknown as Record<string, unknown>;
  const marks = Object.keys(props).filter((k) => k.startsWith(NOTE_KEY));
  const foreign = Object.keys(props).some((k) => k.startsWith(FOREIGN_KEY));
  const colors = marks.map((k) => props[k] as string);
  const style: React.CSSProperties = {};
  if (props.slash) style.opacity = 0.35;
  if (colors.some(isStrike)) {
    style.textDecoration = "line-through";
    style.textDecorationColor = STRIKE_INK;
    style.textDecorationThickness = 2;
  }
  const fills = [...colors.filter((c) => !isStrike(c)), ...(foreign ? [OTHERS_NEUTRAL_COLOR] : [])].map(highlightBg);
  if (fills.length) style.background = fills.map((c) => `linear-gradient(${c}, ${c})`).join(", ");
  return (
    <span {...attributes} style={style} data-notes={marks.length ? marks.map((k) => k.slice(NOTE_KEY.length)).join(" ") : undefined}>
      {children}
    </span>
  );
}
