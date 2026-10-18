/** Рядок записничка: зона динаміки ліворуч, картки приміток над ним, доріжки. */
import { RenderElementProps } from "slate-react";
import { layout, lineKind } from "../../model";
import { useEditorCtx, useModelLine } from "../context";
import { DynamicsZone } from "../dynamics/DynamicsZone";
import { NoteCard } from "../notes/NoteCard";

export function LineElement({ attributes, children, element }: RenderElementProps) {
  const ctx = useEditorCtx();
  const ln = useModelLine(element);
  const kind = ln < 0 ? "empty" : lineKind(layout(ctx.song)[ln]);
  const cards = ctx.notes.filter((n) => n.line === ln && n.status === "visible" && (n.note.body || ctx.canAnnotate));
  return (
    <div {...attributes} data-kind={kind} className="song-row relative break-inside-avoid-column">
      {ln >= 0 && <DynamicsZone ln={ln} />}
      {cards.map((c) => (
        <NoteCard key={c.note.id} view={c} />
      ))}
      {children}
    </div>
  );
}
