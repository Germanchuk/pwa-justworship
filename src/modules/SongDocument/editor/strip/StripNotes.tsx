/**
 * Палітра й меню позначки для кроків смуги (`NOTE-50`, `SONG-98`) — ті самі,
 * що й у редакторі (`NotesTools`), лише виділення приходить з `useStripSteps`.
 * Лежачи — у панелі справа, на ПК — під меню пісні.
 *
 * Текст нотатки — у самій картці над доріжкою (`NoteCardBox`), як у
 * редакторі: тап по картці — і пиши. «Додати нотатку» ставить порожню картку
 * з курсором; «Прибрати нотатку» лишає саме виділення (`NOTE-4`).
 */
import { useState } from "react";
import { Highlighter, MessageSquareOff, MessageSquarePlus, Strikethrough, TextSelect, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MENU_GROUP, MENU_GROUP_ITEM } from "#modules/SingleSong/components/SongControls/tile";
import { COMMENT_PALETTE, STRIKE_COLOR } from "#modules/SingleSong/components/SlateLyricsPlayground/comments/colors";
import { setPendingFocus } from "#modules/SingleSong/components/SlateLyricsPlayground/comments/pendingFocus";
import { addNote, moveNoteTo, othersSeeing, removeNote, updateNote, type NoteView, type Song } from "../../model";
import { AudienceMenu, ColorMenu, newId, NOTES_UI, pickedCss, Swatch } from "../notes/NotesTools";
import type { StepsSel } from "./useStripSteps";

type Props = {
  song: Song;
  me: string;
  viewers: string[];
  notes: NoteView[];
  steps: StepsSel | null;
  picked: string[];
  select: (steps: StepsSel | null) => void;
  pick: (ids: string[]) => void;
  addDraft: (id: string) => void;
  dropDraft: (id: string) => void;
  className?: string;
};

export function StripNotes({ song, me, viewers, notes, steps, picked, select, pick, addDraft, dropDraft, className }: Props) {
  // Позначка, чию область зараз змінюють (`NOTE-43`): виділені кроки тоді — нова область.
  const [resizing, setResizing] = useState<string | null>(null);
  const views = resizing ? [] : notes.filter((n) => picked.includes(n.note.id) && n.status === "visible" && !n.foreign);
  if (!resizing && !steps && !views.length) return null;

  const apply = (color: string) => {
    if (!steps) return;
    const id = newId();
    // Адресати — ті, чиїми очима дивлюсь (`NOTE-21`); автор — я.
    song.doc.transact(() => addNote(song, steps.ln, steps.lane, steps.from, steps.to, { id, author: me, visibleFor: [...viewers], color, body: "" }));
    pick([id]);
  };
  const finishResize = () => {
    const n = notes.find((v) => v.note.id === resizing);
    if (n && steps) song.doc.transact(() => moveNoteTo(song, n.holder, n.lane, n.note.id, steps.ln, steps.lane, steps.from, steps.to));
    setResizing(null);
    pick(resizing ? [resizing] : []);
  };

  return (
    <div {...{ [NOTES_UI]: "" }} className={cn("flex flex-col items-end gap-2", className)} onMouseDown={(e) => e.preventDefault()}>
      {views.length > 0 && <style>{pickedCss(views)}</style>}

      {resizing && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(MENU_GROUP_ITEM, "glass bg-accent")}
          disabled={!steps}
          onClick={finishResize}
          aria-label="Застосувати область"
          title="Застосувати область"
        >
          <TextSelect className="size-6" />
        </Button>
      )}

      {!resizing && steps && (
        <div className={cn(MENU_GROUP, "flex-col")}>
          {COMMENT_PALETTE.map((c) => (
            <Swatch key={c.name} color={c.hex} title={`Виділити: ${c.name}`} onClick={() => apply(c.hex)}>
              <Highlighter className="size-6" />
            </Swatch>
          ))}
          <Swatch color={STRIKE_COLOR} title="Закреслити" onClick={() => apply(STRIKE_COLOR)}>
            <Strikethrough className="size-6" />
          </Swatch>
        </div>
      )}

      {views.map((n) => {
        const rest = othersSeeing(n.note, viewers);
        const deleteTitle = rest > 0 ? `Видалити у вибраних (лишиться ще в ${rest})` : "Видалити повністю";
        const change = (patch: Parameters<typeof updateNote>[3]) => song.doc.transact(() => updateNote(n.holder, n.lane, n.note.id, patch));
        const noted = !!n.note.body;
        const noteTitle = noted ? "Прибрати нотатку, лишити виділення" : "Додати нотатку";
        return (
          <div key={n.note.id} className={cn(MENU_GROUP, "flex-col")}>
            <ColorMenu color={n.note.color} onPick={(color) => change({ color })} />
            <Button
              variant="ghost"
              size="icon"
              className={MENU_GROUP_ITEM}
              aria-label="Змінити область"
              title="Змінити область"
              onClick={() => {
                if (!n.at) return;
                select({ ln: n.at.line, lane: n.lane, from: n.at.from, to: n.at.to });
                setResizing(n.note.id);
              }}
            >
              <TextSelect className="size-6" />
            </Button>
            <AudienceMenu me={me} visibleFor={n.note.visibleFor} onChange={(visibleFor) => change({ visibleFor })} />
            <Button
              variant="ghost"
              size="icon"
              className={MENU_GROUP_ITEM}
              aria-label={noteTitle}
              title={noteTitle}
              onClick={() => {
                if (noted) {
                  change({ body: "" });
                  dropDraft(n.note.id);
                } else {
                  setPendingFocus(n.note.id); // тут же, у тапі: iOS відкриє клавіатуру
                  addDraft(n.note.id);
                }
              }}
            >
              {noted ? <MessageSquareOff className="size-6" /> : <MessageSquarePlus className="size-6" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={MENU_GROUP_ITEM}
              aria-label={deleteTitle}
              title={deleteTitle}
              onClick={() => {
                song.doc.transact(() => removeNote(n.holder, n.lane, n.note, viewers));
                pick([]);
              }}
            >
              <Trash2 className="size-6" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
