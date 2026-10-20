/**
 * Рядок записничка: смужки динаміки і доріжки в порядку пісні (ADR-0008).
 * Текстові доріжки — вузли Slate (`children`); клітинкові — віджети рядка поза
 * Slate, між ними. Картки приміток — над своєю доріжкою.
 */
import { Children, type ReactNode } from "react";
import { Element } from "slate";
import { RenderElementProps } from "slate-react";
import { isTextKind, layout, lineKind } from "../../model";
import { useEditorCtx, useModelLine } from "../context";
import { DynamicsZone } from "../dynamics/DynamicsZone";
import { CellLane } from "./CellLane";

export function LineElement({ attributes, children, element }: RenderElementProps) {
  const ctx = useEditorCtx();
  const ln = useModelLine(element);
  const kind = ln < 0 ? "empty" : lineKind(layout(ctx.song)[ln]);

  // Вузли Slate — за видом доріжки; кожен мусить бути показаний рівно раз.
  const rendered = Children.toArray(children);
  const byLane = new Map<string, ReactNode>(
    (element as Element).children.map((lane, i): [string, ReactNode] => [(lane as unknown as { type: string }).type, rendered[i]]),
  );
  const out: ReactNode[] = [];
  ctx.shownLanes.forEach((lane) => {
    if (isTextKind(lane.kind)) {
      if (byLane.has(lane.kind)) out.push(byLane.get(lane.kind));
      byLane.delete(lane.kind);
    } else if (kind === "segment" && ln >= 0) {
      // Порожній рядок і структурна примітка клітинкових доріжок не показують (як і акорди).
      out.push(<CellLane key={lane.id} ln={ln} lane={lane} />);
    }
  });
  out.push(...byLane.values()); // напр., акорди порожнього рядка, коли слова сховані

  return (
    <div {...attributes} data-kind={kind} className="song-row relative break-inside-avoid-column">
      {ln >= 0 && <DynamicsZone ln={ln} />}
      {out}
    </div>
  );
}
