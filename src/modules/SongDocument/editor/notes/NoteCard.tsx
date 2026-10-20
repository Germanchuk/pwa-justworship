/** Картка примітки над рядком. */
import { cardBg, cardBorder } from "#modules/SingleSong/components/SlateLyricsPlayground/comments/colors";
import { othersSeeing, type NoteView } from "../../model";
import { useEditorCtx } from "../context";

export function NoteCard({ view }: { view: NoteView }) {
  const ctx = useEditorCtx();
  const { note } = view;
  const color = note.color || "#F5C518";
  return (
    <div
      contentEditable={false}
      className="my-1 mr-1 rounded border-l-4 px-2 py-0.5 text-sm font-normal select-none flex items-start gap-2"
      style={{ fontFamily: "Pangolin, cursive", background: cardBg(color), borderColor: cardBorder(color), color: "#3f2a06" }}
    >
      <span className="flex-1 whitespace-pre-wrap">{note.body || <i className="text-stone-400">підсвітка «{note.quote}»</i>}</span>
      {othersSeeing(note, ctx.viewers) > 0 && (
        <span className="text-xs text-stone-500 shrink-0" title="Бачить ще стільки людей поза вибраними">
          +{othersSeeing(note, ctx.viewers)}
        </span>
      )}
      {note.author && <span className="text-xs text-stone-500 shrink-0">{note.author}</span>}
      {ctx.canAnnotate && (
        <button
          type="button"
          className="text-stone-400 hover:text-red-600 shrink-0"
          aria-label="Видалити примітку"
          onClick={() => ctx.onNoteDelete(view)}
        >
          ×
        </button>
      )}
    </div>
  );
}
