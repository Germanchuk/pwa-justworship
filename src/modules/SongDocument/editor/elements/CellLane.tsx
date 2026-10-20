/**
 * Клітинкова доріжка рядка (прямокутники, таби, кахон — ADR-0008) — атомний
 * вузол Slate: курсор переходить через неї, виділення її захоплює, друкувати в
 * неї не можна. Механіки ще немає: доріжка займає свій рядок записничка, у
 * правці — з назвою-натяком.
 */
import { RenderElementProps } from "slate-react";
import { allLanes } from "../../model";
import { useEditorCtx } from "../context";

const RULE = "inset 0 -1px 0 0 rgba(120, 95, 50, 0.18)";

export function CellLane({ attributes, children, element }: RenderElementProps) {
  const ctx = useEditorCtx();
  const id = (element as unknown as { lane: string }).lane;
  const lane = allLanes(ctx.song.doc).find((l) => l.id === id);
  return (
    <div {...attributes} data-cell-lane={id} className="pr-2 md:pr-3" style={{ paddingLeft: 16, minHeight: "1.6em", lineHeight: 1.6, boxShadow: RULE }}>
      <div contentEditable={false} className="select-none">
        {ctx.canEdit && <span className="italic text-sm text-stone-400">{lane?.name ?? ""}…</span>}
      </div>
      {children}
    </div>
  );
}
