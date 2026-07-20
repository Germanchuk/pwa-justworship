import type { RenderLeafProps } from "slate-react";

import { useCurrentUsername } from "../elements/hooks";
import { useCarefulMode } from "../../../redux/selectors";
import type { CommentMark, CustomText } from "../types";
import {
  DEFAULT_COMMENT_COLOR,
  OTHERS_NEUTRAL_COLOR,
  highlightBg,
} from "./colors";
import { isVisibleTo } from "./visibility";

export const RenderLeaf = ({ attributes, children, leaf }: RenderLeafProps) => {
  const me = useCurrentUsername();
  const carefulMode = useCarefulMode();
  let node: React.ReactNode = children;

  // Per-user капо (режим 3): показуємо транспонований акорд замість збереженого
  // тексту (decoration-only, у моделі текст лишається спільним).
  // TODO(known): виділення/коментар на акордах при капо мапиться неточно
  // (останній акорд може випадати з хайлайту). Спроба фіксу через CSS-оверлей
  // ламала інше — відкочено, лишаємо поки так.
  const displayChord = (leaf as CustomText).displayChord;
  if (typeof displayChord === "string") {
    node = <span contentEditable={false}>{displayChord}</span>;
  }

  if ((leaf as CustomText).bold) {
    node = <strong>{node}</strong>;
  }

  const raw = (leaf as CustomText).comment;
  const marks: CommentMark[] = Array.isArray(raw) ? raw : [];

  for (const c of marks) {
    const mine = isVisibleTo(c, me);
    const realColor = c.color ?? DEFAULT_COMMENT_COLOR;
    const color = mine
      ? realColor
      : carefulMode
        ? realColor
        : OTHERS_NEUTRAL_COLOR;
    node = (
      <span
        className="comment-highlight"
        data-cid={mine ? c.commentId : undefined}
        style={{ backgroundColor: highlightBg(color) }}
      >
        {node}
      </span>
    );
  }

  const t = leaf as CustomText;
  if (t.chordToken || t.chordInvalid) {
    const classes = ["chord-token"];
    if (t.chordPlayingNow) classes.push("chord-playing-now");
    if (t.chordSelected) classes.push("chord-selected");
    if (t.chordInvalid) classes.push("chord-invalid");
    node = (
      <span
        className={classes.join(" ")}
        data-chord-token-key={t.chordTokenKey}
      >
        {node}
      </span>
    );
  }

  return <span {...attributes}>{node}</span>;
};
