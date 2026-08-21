import { useCallback, useContext } from "react";
import type { MouseEvent } from "react";
import type { RenderElementProps } from "slate-react";

import { useCanPlay } from "../../../../mode";
import { PlayerHighlightContext } from "../../player/PlayerHighlightContext";
import { NoteCards } from "../../comments/NoteCards";
import { useNoteHeadsFor } from "../../comments/NoteHeadsContext";
import { useRowHidden } from "../../display/useRowHidden";
import { useFirstInSectionInfo } from "../hooks";
import { SectionControls } from "../SectionControls/SectionControls";
import "./ChordLine.css";

export const ChordLine = ({ attributes, children, element }: RenderElementProps) => {
  const { isFirst } = useFirstInSectionInfo(element);
  // Що зробить тап, вирішує екран: пісня позначає акорд, зібрання одразу з
  // нього грає (`onChordTap`). Рядок лише повідомляє, по чому тапнули.
  const { onChordTap } = useContext(PlayerHighlightContext);
  // Вибір акорду, з якого продовжити гру, — функція режиму читання.
  const canPlay = useCanPlay();
  const hidden = useRowHidden(element);
  // Картки приміток, чия «голова» — цей рядок (див. `comments/noteHeads.ts`).
  const notes = useNoteHeadsFor(element);

  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!canPlay) return;
      const target = (e.target as HTMLElement | null)?.closest?.(
        "[data-chord-token-key]",
      ) as HTMLElement | null;
      if (!target) return;
      const key = target.dataset.chordTokenKey;
      if (!key) return;
      e.preventDefault();
      e.stopPropagation();
      onChordTap(key);
    },
    [canPlay, onChordTap],
  );

  return (
    <div
      className={`chord-line ${notes.length > 0 ? "chord-line--noted" : ""} ${
        hidden ? "song-row--hidden" : ""
      }`}
      {...attributes}
      onMouseDown={handleMouseDown}
    >
      <NoteCards notes={notes} />
      {children}
      {isFirst && <SectionControls lineElement={element} />}
    </div>
  );
};
