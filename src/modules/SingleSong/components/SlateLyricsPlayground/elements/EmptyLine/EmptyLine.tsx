import { useFocused, useSelected, type RenderElementProps } from "slate-react";

import "./EmptyLine.css";

export const EmptyLine = ({ attributes, children }: RenderElementProps) => {
  const selected = useSelected();
  const focused = useFocused();

  return (
    <div
      className={`empty-line ${selected && focused ? "is-focused" : ""}`}
      {...attributes}
    >
      {children}
    </div>
  );
};
