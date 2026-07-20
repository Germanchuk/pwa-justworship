import type { RenderElementProps } from "slate-react";

import { useFirstInSectionInfo } from "../hooks";
import { SectionControls } from "../SectionControls/SectionControls";
import "./Line.css";

export const Line = ({ attributes, children, element }: RenderElementProps) => {
  const { isFirst } = useFirstInSectionInfo(element);
  return (
    <div
      className={`song-line ${isFirst ? "song-line--first" : ""}`}
      {...attributes}
    >
      {children}
      {isFirst && <SectionControls lineElement={element} />}
    </div>
  );
};
