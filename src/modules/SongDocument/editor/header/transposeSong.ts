/**
 * Змінити тональність пісні з перетонуванням усіх акордів. Міняються лише
 * змінені акорди, кожен на своєму місці. Примітки на акордах лишаються на
 * своїх тактах (`KEY-21`): позиція примітки прив'язана до символів, а
 * замінений акорд — це нові символи, тож межі приміток рядка перераховуються
 * через правки й прив'язуються наново.
 */
import { chordEdits, type ChordEdit } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/transposeChords";
import type { SongKeyValue } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/model";
import { chordsOf, layout, metaMapOf, noteRange, notesOf, Song } from "../../model";
import { resolveRange } from "../../model/notes/marks";

/** Де опиниться символ `offset` після правок (`edits` — справа наліво, як їх дає `chordEdits`). */
function shiftOffset(offset: number, edits: readonly ChordEdit[]) {
  let out = offset;
  for (const e of edits) {
    if (offset >= e.end) out += e.text.length - (e.end - e.start);
    else if (offset > e.start) out = e.start + Math.min(offset - e.start, e.text.length) + (out - offset);
  }
  return out;
}

export function transposeSong(song: Song, fromKey: string, toKey: string) {
  if (fromKey === toKey) return;
  song.doc.transact(() => {
    const lines = layout(song);
    lines.forEach((l, ln) => {
      const chords = chordsOf(l.line);
      const edits = chordEdits(chords.toString(), fromKey as SongKeyValue, toKey as SongKeyValue);
      if (!edits.length) return;
      const notes = Array.from(notesOf(l.line, "chords").values(), (note) => ({
        note,
        at: resolveRange(song, lines, ln, "chords", note),
      }));
      // Правки йдуть справа наліво — офсети решти лишаються чинними.
      for (const edit of edits) {
        chords.delete(edit.start, edit.end - edit.start);
        chords.insert(edit.start, edit.text);
      }
      for (const { note, at } of notes) {
        if (!at) continue; // позначене зникло ще до транспонування — лишаємо як є
        const from = shiftOffset(at.from, edits);
        const to = shiftOffset(at.to, edits);
        notesOf(l.line, "chords").set(note.id, { ...note, ...noteRange(song, ln, "chords", from, to), quote: note.quote });
      }
    });
    metaMapOf(song.doc).set("key", toKey);
  });
}
