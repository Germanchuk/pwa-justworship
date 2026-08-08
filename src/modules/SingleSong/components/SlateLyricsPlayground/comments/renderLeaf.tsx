import type { RenderLeafProps } from "slate-react";

import { useCanEditContent } from "../../../mode";
import { useNotesViewer } from "../../../redux/selectors";
import type { CommentMark, CustomText } from "../types";
import {
  DEFAULT_COMMENT_COLOR,
  OTHERS_NEUTRAL_COLOR,
  highlightBg,
} from "./colors";
import { isVisibleTo } from "./visibility";

export const RenderLeaf = ({ attributes, children, leaf }: RenderLeafProps) => {
  // Не обовʼязково я: у режимі приміток можна дивитись очима іншого учасника.
  const viewer = useNotesViewer();
  // Сірий натяк на чужі примітки виправданий лише там, де правка може їх
  // зачепити — у режимі редагування. У читанні нічого не видалиш, у примітках
  // я дивлюсь очима конкретної людини; в обох чужих міток не видно взагалі.
  const hintOthers = useCanEditContent();
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
    const shown = isVisibleTo(c, viewer);
    if (!shown && !hintOthers) continue;
    const color = shown
      ? c.color ?? DEFAULT_COMMENT_COLOR
      : OTHERS_NEUTRAL_COLOR;
    node = (
      <span
        className="comment-highlight"
        data-cid={shown ? c.commentId : undefined}
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
