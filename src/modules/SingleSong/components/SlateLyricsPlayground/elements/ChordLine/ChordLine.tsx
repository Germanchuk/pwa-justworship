import type { RenderElementProps } from "slate-react";

import { NoteCards } from "../../comments/NoteCards";
import { useNoteHeadsFor } from "../../comments/NoteHeadsContext";
import { useRowHidden } from "../../display/useRowHidden";
import { useFirstInSectionInfo } from "../hooks";
import { SectionControls } from "../SectionControls/SectionControls";
import "./ChordLine.css";

export const ChordLine = ({ attributes, children, element }: RenderElementProps) => {
  const { isFirst } = useFirstInSectionInfo(element);
  const hidden = useRowHidden(element);
  // Картки приміток, чия «голова» — цей рядок (див. `comments/noteHeads.ts`).
  const notes = useNoteHeadsFor(element);

  return (
    <div
      className={`chord-line ${notes.length > 0 ? "chord-line--noted" : ""} ${
        hidden ? "song-row--hidden" : ""
      }`}
      {...attributes}
    >
      <NoteCards notes={notes} />
      {children}
      {isFirst && <SectionControls lineElement={element} />}
    </div>
  );
};
