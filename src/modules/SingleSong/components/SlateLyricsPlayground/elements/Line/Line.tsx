import type { RenderElementProps } from "slate-react";

import { NoteCards } from "../../comments/NoteCards";
import { useNoteHeadsFor } from "../../comments/NoteHeadsContext";
import { useRowHidden } from "../../display/useRowHidden";
import { useFirstInSectionInfo } from "../hooks";
import { SectionControls } from "../SectionControls/SectionControls";
import "./Line.css";

export const Line = ({ attributes, children, element }: RenderElementProps) => {
  const { isFirst } = useFirstInSectionInfo(element);
  const hidden = useRowHidden(element);
  // Картки приміток, чия «голова» — цей рядок. Живуть усередині вузла рядка,
  // тож не можуть від нього відірватись — див. `comments/noteHeads.ts`.
  const notes = useNoteHeadsFor(element);
  return (
    <div
      className={`song-line ${isFirst ? "song-line--first" : ""} ${
        notes.length > 0 ? "song-line--noted" : ""
      } ${hidden ? "song-row--hidden" : ""}`}
      {...attributes}
    >
      <NoteCards notes={notes} />
      {children}
      {isFirst && <SectionControls lineElement={element} />}
    </div>
  );
};
