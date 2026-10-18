import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { addNote, appendLines, chordsString, layout, readMeta, resolveNotes, songOf, writeMeta } from "../../model";
import { transposeSong } from "./transposeSong";

describe("зміна тональності гри (KEY-2, KEY-21)", () => {
  it("перетоновує акорди на своїх місцях, примітка на акорді лишається на ньому", () => {
    const song = songOf(new Y.Doc());
    song.doc.transact(() => appendLines(song, [{ chords: "| C . G . | Am |", words: "Ти святий" }]));
    writeMeta(song.doc, { key: "C" });
    // «G» — символи 6…7
    song.doc.transact(() => addNote(song, 0, "chords", 6, 7, { id: "n", author: "Оля", visibleFor: ["Оля"], color: "#F5C518", body: "тут" }));

    transposeSong(song, "C", "D");

    expect(chordsString(layout(song)[0].line)).toBe("| D . A . | Bm |");
    expect(readMeta(song.doc).key).toBe("D");
    const [note] = resolveNotes(song, ["Оля"], () => true);
    expect(note.at).toEqual({ line: 0, from: 6, to: 7 });
  });

  it("примітка на кількох акордах розтягується разом із довшими акордами", () => {
    const song = songOf(new Y.Doc());
    song.doc.transact(() => appendLines(song, [{ chords: "C   F   G   C", words: "Алилуя" }]));
    // «F   G» — символи 4…9
    song.doc.transact(() => addNote(song, 0, "chords", 4, 9, { id: "n", author: "Оля", visibleFor: ["Оля"], color: "#F5C518", body: "" }));

    transposeSong(song, "C", "C#");

    const text = chordsString(layout(song)[0].line);
    const [note] = resolveNotes(song, ["Оля"], () => true);
    expect(text.slice(note.at!.from, note.at!.to)).toBe("F#   G#");
  });
});
