import { type Element, Node, type Path } from "slate";
import { ReactEditor, useSlate } from "slate-react";

import type { SectionElement } from "../../types";
import { SectionEditButton } from "../SectionEditButton/SectionEditButton";
import { SectionToggleButton } from "../SectionToggleButton/SectionToggleButton";
import "./SectionControls.css";

export const SectionControls = ({ lineElement }: { lineElement: Element }) => {
  const editor = useSlate();
  let repeat = 1;
  try {
    const linePath = ReactEditor.findPath(editor, lineElement);
    const sectionPath: Path = linePath.slice(0, -1);
    const section = Node.get(editor, sectionPath) as SectionElement;
    repeat = section.repeat ?? 1;
  } catch {
    // ignore
  }

  return (
    <span contentEditable={false} className="section-controls">
      {repeat > 1 && (
        <span className="section-controls__repeat" aria-label={`Повторів: ${repeat}`}>
          x{repeat}
        </span>
      )}
      <SectionEditButton lineElement={lineElement} />
      <SectionToggleButton lineElement={lineElement} />
    </span>
  );
};
