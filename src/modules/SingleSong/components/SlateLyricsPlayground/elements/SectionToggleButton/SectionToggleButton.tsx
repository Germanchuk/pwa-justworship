import type { MouseEvent } from "react";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { type Element, Node, type Path, Transforms } from "slate";
import { ReactEditor, useSlate } from "slate-react";

import type { SectionElement } from "../../types";
import { useCurrentUsername } from "../hooks";
import "./SectionToggleButton.css";

export const SectionToggleButton = ({ lineElement }: { lineElement: Element }) => {
  const editor = useSlate();
  const currentUsername = useCurrentUsername();
  if (!currentUsername) return null;

  // Resolve section path on every render — cached paths go stale when siblings shift.
  let section: SectionElement;
  let sectionPath: Path;
  try {
    const linePath = ReactEditor.findPath(editor, lineElement);
    sectionPath = linePath.slice(0, -1);
    section = Node.get(editor, sectionPath) as SectionElement;
  } catch {
    return null;
  }

  if (section.children.length <= 1) return null;

  const collapsedFor = section.collapsedFor ?? [];
  const collapsed = collapsedFor.includes(currentUsername);

  const onMouseDown = (e: MouseEvent) => {
    // prevent Slate from moving caret onto the button
    e.preventDefault();
  };
  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = collapsed
      ? collapsedFor.filter((u) => u !== currentUsername)
      : [...collapsedFor, currentUsername];
    Transforms.setNodes<SectionElement>(
      editor,
      { collapsedFor: next },
      { at: sectionPath },
    );
  };

  return (
    <button
      type="button"
      className="section-toggle"
      aria-label={collapsed ? "Розгорнути секцію" : "Згорнути секцію"}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      {collapsed ? (
        <ChevronDownIcon className="section-toggle__icon" />
      ) : (
        <ChevronUpIcon className="section-toggle__icon" />
      )}
    </button>
  );
};
