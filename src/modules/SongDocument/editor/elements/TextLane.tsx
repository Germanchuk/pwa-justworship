/** Текстова доріжка рядка — акорди або слова. */
import { Node } from "slate";
import { RenderElementProps } from "slate-react";
import { transposeChordTextForCapo } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/transposeChords";
import type { SongKeyValue } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/model";
import { LaneType, layout, lineKind } from "../../model";
import { useEditorCtx, useModelLine } from "../context";

const RULE = "inset 0 -1px 0 0 rgba(120, 95, 50, 0.18)";
const INK: Record<LaneType, string> = { words: "#1e3a8a", chords: "#3b82f6" };
const HINT: Record<LaneType, { label: string; color: string }> = {
  words: { label: "слова…", color: "rgba(30,58,138,0.4)" },
  chords: { label: "акорди…", color: "rgba(59,130,246,0.45)" },
};

/** Доріжка є у видимому дереві — отже її видно (і в правці — можна правити). */
export function TextLane({ attributes, children, element, lane }: RenderElementProps & { lane: LaneType }) {
  const ctx = useEditorCtx();
  const text = Node.string(element);
  const ln = useModelLine(element);
  const kind = ln < 0 ? "empty" : lineKind(layout(ctx.song)[ln]);
  // Капо — лише показ (у читанні): транспонований рядок замість документного.
  const transposed = lane === "chords" && ctx.capo > 0 && !ctx.canEdit;
  const note = lane === "words" && kind === "note";
  return (
    <div
      {...attributes}
      className="relative whitespace-pre-wrap"
      style={{
        paddingLeft: 16,
        fontSize: 16,
        lineHeight: 1.6,
        minHeight: "1.6em",
        boxShadow: RULE,
        color: transposed ? "#6366f1" : INK[lane],
        fontWeight: lane === "chords" || note ? 700 : 500,
      }}
    >
      {transposed && (
        <div contentEditable={false} className="select-none whitespace-pre">
          {transposeChordTextForCapo(text, ctx.songKey as SongKeyValue, ctx.capo) || " "}
        </div>
      )}
      <div style={transposed ? { display: "none" } : undefined}>{children}</div>
      {ctx.canEdit && text === "" && (kind !== "empty" || ctx.cursorLine === ln) && (
        <span
          contentEditable={false}
          className="absolute left-4 top-0 italic text-sm font-normal select-none pointer-events-none"
          style={{ color: HINT[lane].color }}
        >
          {HINT[lane].label}
        </span>
      )}
    </div>
  );
}
