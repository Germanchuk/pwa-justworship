/**
 * Втрачені примітки (`NOTE-26`, `NOTE-27`, `NOTE-34`): усе позначене стерли, а
 * запис лишився — блок над піснею, де примітку можна прочитати, скопіювати
 * чи видалити (в усіх адресатів одразу: це надгробок, а не підказка).
 *
 * Своя приватна примітка (бачу лише я, автор) сюди не потрапляє (`NOTE-28`):
 * хто стер — не записано, тож вважаємо, що я сам.
 */
import { useState } from "react";
import { ChevronDown, Copy, Strikethrough, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { highlightBg, isStrike, STRIKE_INK } from "#modules/SingleSong/components/SlateLyricsPlayground/comments/colors";
import { notesOf, type NoteView, type Song } from "../../model";

const ownPrivate = ({ note }: NoteView) => note.visibleFor.length === 1 && note.visibleFor[0] === note.author;

export function LostNotes({ song, notes }: { song: Song; notes: NoteView[] }) {
  const [open, setOpen] = useState(true);
  const lost = notes.filter((n) => n.status === "lost" && !n.foreign && !ownPrivate(n));
  if (!lost.length) return null;
  return (
    <div className="mb-3 rounded-md border border-amber-300/60 bg-amber-50/60 p-2 text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-1 py-1 text-left font-medium text-amber-900 hover:text-amber-700"
      >
        <span>
          Втрачені коментарі <span className="ml-1 text-xs font-normal opacity-70">({lost.length})</span>
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="mt-1 space-y-1.5">
          {lost.map(({ note, holder, lane }) => (
            <li key={note.id} className="flex items-start gap-2 rounded-sm bg-white/60 px-2 py-1.5">
              {isStrike(note.color) ? (
                <Strikethrough className="mt-1 size-3 shrink-0" style={{ color: STRIKE_INK }} aria-label="закреслення" />
              ) : (
                <span className="mt-1 inline-block size-3 shrink-0 rounded-full border border-black/15" style={{ backgroundColor: highlightBg(note.color) }} />
              )}
              <div className="flex-1 min-w-0">
                <p className="whitespace-pre-wrap break-words">{note.body || <span className="italic text-muted-foreground">(без тексту)</span>}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  було на «{note.quote}» · {note.author}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(note.body).catch(() => {})}
                className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent"
                title="Скопіювати текст"
              >
                <Copy className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => song.doc.transact(() => notesOf(holder, lane).delete(note.id))}
                className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Видалити"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
