/** Символи тексту: позначене приміткою — підсвічене її кольором; «/» структурної примітки — приглушений. */
import { RenderLeafProps } from "slate-react";
import { highlightBg, isStrike, STRIKE_INK } from "#modules/SingleSong/components/SlateLyricsPlayground/comments/colors";

export function Leaf({ attributes, children, leaf }: RenderLeafProps) {
  const { noteColor, slash } = leaf as { noteColor?: string; slash?: boolean };
  const style: React.CSSProperties = {};
  if (slash) style.opacity = 0.35;
  if (noteColor && isStrike(noteColor)) {
    style.textDecoration = "line-through";
    style.textDecorationColor = STRIKE_INK;
    style.textDecorationThickness = 2;
  } else if (noteColor) style.background = highlightBg(noteColor);
  return (
    <span {...attributes} style={style}>
      {children}
    </span>
  );
}
