/** Текстова доріжка рядка — слова, акорди або додана текстова (вигуки). */
import { Node } from "slate";
import { RenderElementProps } from "slate-react";
import { transposeChordTextForCapo } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/transposeChords";
import type { SongKeyValue } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/model";
import { allLanes, layout, lineKind } from "../../model";
import { useEditorCtx, useModelLine } from "../context";
import { NoteCard } from "../notes/NoteCard";

const RULE = "inset 0 -1px 0 0 rgba(120, 95, 50, 0.18)";
type Look = "words" | "chords" | "text";
const INK: Record<Look, string> = { words: "#1e3a8a", chords: "#3b82f6", text: "#7c3aed" };
const HINT: Record<Look, { label: string; color: string }> = {
  words: { label: "слова…", color: "rgba(30,58,138,0.4)" },
  chords: { label: "акорди…", color: "rgba(59,130,246,0.45)" },
  text: { label: "", color: "rgba(124,58,237,0.4)" },
};

/** Доріжка є у видимому дереві — отже її видно (і в правці — можна правити). */
export function TextLane({ attributes, children, element, lane }: RenderElementProps & { lane: string }) {
  const ctx = useEditorCtx();
  const look: Look = lane === "words" || lane === "chords" ? lane : "text";
  // Натяк доданої доріжки — її назва («Вигуки…»).
  const hint = look === "text" ? `${allLanes(ctx.song.doc).find((l) => l.id === lane)?.name ?? ""}…` : HINT[look].label;
  const text = Node.string(element);
  const ln = useModelLine(element);
  const kind = ln < 0 ? "empty" : lineKind(layout(ctx.song)[ln]);
  // Капо — лише показ (у читанні): транспонований рядок замість документного.
  const transposed = lane === "chords" && ctx.capo > 0 && !ctx.canEdit;
  const note = lane === "words" && kind === "note";
  // Картки приміток — над тією доріжкою, до якої примітка.
  // Картка — коли в примітки є текст або його саме пишуть; без тексту — лише підсвітка.
  const cards = ctx.notes.filter(
    (n) => n.line === ln && n.lane === lane && n.status === "visible" && !n.foreign && (n.note.body || ctx.drafts.includes(n.note.id)),
  );
  return (
    <div
      {...attributes}
      // Праворуч — місце під смужку особистої динаміки (DynamicsZone).
      className="relative whitespace-pre-wrap pr-2 md:pr-3"
      style={{
        paddingLeft: 16,
        fontSize: 16,
        lineHeight: 1.6,
        minHeight: "1.6em",
        boxShadow: RULE,
        color: transposed ? "#6366f1" : INK[look],
        fontWeight: lane === "chords" || note ? 700 : 500,
        fontStyle: look === "text" ? "italic" : undefined,
      }}
    >
      {cards.map((c) => (
        <NoteCard key={c.note.id} view={c} />
      ))}
      {transposed && (
        <div contentEditable={false} className="select-none whitespace-pre">
          {transposeChordTextForCapo(text, ctx.songKey as SongKeyValue, ctx.capo) || " "}
        </div>
      )}
      {/* Натяк — поверх тексту доріжки, а не карток над нею. */}
      <div className="relative" style={transposed ? { display: "none" } : undefined}>
        {children}
        {ctx.canEdit && text === "" && (kind !== "empty" || ctx.cursorLine === ln) && (
          <span
            contentEditable={false}
            className="absolute left-0 top-0 italic text-sm font-normal select-none pointer-events-none"
            style={{ color: HINT[look].color }}
          >
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}
