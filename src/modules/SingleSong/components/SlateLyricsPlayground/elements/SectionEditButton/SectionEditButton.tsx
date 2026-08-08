import { useState, type MouseEvent } from "react";
import { EllipsisHorizontalCircleIcon } from "@heroicons/react/24/outline";
import { type Element, Node, type Path, Transforms } from "slate";
import { ReactEditor, useSlate } from "slate-react";

import { useCanEditContent } from "../../../../mode";
import type { DynamicsStepKey } from "../../constants/dynamicsSteps";
import type { SectionElement } from "../../types";
import { SectionMetaModal } from "./SectionMetaModal";
import "./SectionEditButton.css";

export const SectionEditButton = ({ lineElement }: { lineElement: Element }) => {
  const editor = useSlate();
  const [open, setOpen] = useState(false);
  // Атрибути секції (повтори, динаміка) — спільний вміст пісні.
  const canEditContent = useCanEditContent();

  if (!canEditContent) return null;

  let section: SectionElement;
  let sectionPath: Path;
  try {
    const linePath = ReactEditor.findPath(editor, lineElement);
    sectionPath = linePath.slice(0, -1);
    section = Node.get(editor, sectionPath) as SectionElement;
  } catch {
    return null;
  }

  const onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
  };
  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  const onSave = (next: {
    repeat: number | undefined;
    dynamicsSteps: DynamicsStepKey[] | undefined;
  }) => {
    Transforms.setNodes<SectionElement>(
      editor,
      { repeat: next.repeat, dynamicsSteps: next.dynamicsSteps },
      { at: sectionPath },
    );
    Transforms.deselect(editor);
    ReactEditor.blur(editor);
  };

  return (
    <>
      <button
        type="button"
        className="section-edit"
        aria-label="Редагувати атрибути секції"
        onMouseDown={onMouseDown}
        onClick={onClick}
      >
        <EllipsisHorizontalCircleIcon className="section-edit__icon" />
      </button>
      {open && (
        <SectionMetaModal
          sectionPreview={
            section.children[0] ? Node.string(section.children[0]) : ""
          }
          currentRepeat={section.repeat}
          currentDynamicsSteps={section.dynamicsSteps}
          onSave={onSave}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};
