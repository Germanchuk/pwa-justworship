/**
 * Рядок записничка: доріжки (картки приміток і смужки динаміки — на своїх
 * доріжках). У читанні пісні з клітинковими доріжками поле перед рядком —
 * ще й «грати звідси» (ADR-0009, `editor/playback/mark.ts`).
 */
import { RenderElementProps } from "slate-react";
import { CELL_KINDS, layout, lineKind, songLanes } from "../../model";
import { useEditorCtx, useModelLine } from "../context";
import { setPlayMark, usePlayMark } from "../playback/mark";
import { GUTTER } from "./gutter";

export function LineElement({ attributes, children, element }: RenderElementProps) {
  const ctx = useEditorCtx();
  const ln = useModelLine(element);
  const kind = ln < 0 ? "empty" : lineKind(layout(ctx.song)[ln]);
  const mark = usePlayMark();
  const playable = !ctx.simple && !ctx.canEdit && kind === "segment" && songLanes(ctx.song.doc).some((l) => (CELL_KINDS as readonly string[]).includes(l.kind));
  return (
    <div {...attributes} data-kind={kind} data-line={ln} className="song-row relative">
      {playable && (
        <button
          type="button"
          contentEditable={false}
          aria-label="Грати з цього рядка"
          title="Грати з цього рядка"
          className="absolute left-0 top-0 bottom-0 z-[1] cursor-pointer"
          style={{ width: GUTTER - 2 }}
          onClick={() => setPlayMark(ln)}
        >
          {mark === ln && <span className="absolute left-0.5 top-1 text-[10px] leading-none text-red-500">▶</span>}
        </button>
      )}
      {children}
    </div>
  );
}
