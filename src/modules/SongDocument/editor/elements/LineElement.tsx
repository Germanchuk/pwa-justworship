/** Рядок записничка: доріжки (картки приміток і смужки динаміки — на своїх доріжках). */
import { RenderElementProps } from "slate-react";
import { layout, lineKind } from "../../model";
import { useEditorCtx, useModelLine } from "../context";

export function LineElement({ attributes, children, element }: RenderElementProps) {
  const ctx = useEditorCtx();
  const ln = useModelLine(element);
  const kind = ln < 0 ? "empty" : lineKind(layout(ctx.song)[ln]);
  return (
    <div {...attributes} data-kind={kind} className="song-row relative break-inside-avoid-column">
      {children}
    </div>
  );
}
