/**
 * Змінити тональність пісні з перетонуванням усіх акордів. Міняються лише
 * змінені акорди, кожен на своєму місці: новий акорд вставляється за старим,
 * старий стирається — примітки на акордах лишаються на своїх тактах.
 */
import { chordEdits } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/transposeChords";
import type { SongKeyValue } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/model";
import { chordsOf, linesOf, metaMapOf, Song } from "../../model";

export function transposeSong(song: Song, fromKey: string, toKey: string) {
  if (fromKey === toKey) return;
  song.doc.transact(() => {
    for (const line of linesOf(song)) {
      const chords = chordsOf(line);
      // Правки йдуть справа наліво — офсети решти лишаються чинними.
      for (const edit of chordEdits(chords.toString(), fromKey as SongKeyValue, toKey as SongKeyValue)) {
        chords.insert(edit.end, edit.text);
        chords.delete(edit.start, edit.end - edit.start);
      }
    }
    metaMapOf(song.doc).set("key", toKey);
  });
}
