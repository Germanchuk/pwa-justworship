/**
 * Клітинкова доріжка рядка (прямокутники, таби, кахон — ADR-0008). Механіки ще
 * немає: доріжка займає свій рядок у записничку, у правці — з назвою-натяком.
 */
import { layout, type LaneDef } from "../../model";
import { useEditorCtx } from "../context";

const RULE = "inset 0 -1px 0 0 rgba(120, 95, 50, 0.18)";

export function CellLane({ ln, lane }: { ln: number; lane: LaneDef }) {
  const ctx = useEditorCtx();
  const line = layout(ctx.song)[ln]?.line;
  const missing = !line?.has(lane.id); // слот дописується (`ensureSlots`) — поки порожньо
  return (
    <div
      contentEditable={false}
      data-cell-lane={lane.id}
      className="select-none pr-2 md:pr-3"
      style={{ paddingLeft: 16, minHeight: "1.6em", lineHeight: 1.6, boxShadow: RULE }}
    >
      {ctx.canEdit && !missing && (
        <span className="italic text-sm text-stone-400">{lane.name}…</span>
      )}
    </div>
  );
}
