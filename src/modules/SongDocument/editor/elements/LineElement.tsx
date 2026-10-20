/** Рядок записничка: смужки динаміки і доріжки (картки приміток — над своєю доріжкою). */
import { RenderElementProps } from "slate-react";
import { layout, lineKind } from "../../model";
import { useEditorCtx, useModelLine } from "../context";
import { DynamicsZone } from "../dynamics/DynamicsZone";

export function LineElement({ attributes, children, element }: RenderElementProps) {
  const ctx = useEditorCtx();
  const ln = useModelLine(element);
  const kind = ln < 0 ? "empty" : lineKind(layout(ctx.song)[ln]);
  return (
    <div {...attributes} data-kind={kind} className="song-row relative break-inside-avoid-column">
      {ln >= 0 && <DynamicsZone ln={ln} />}
      {children}
    </div>
  );
}
