import { describe, expect, it } from "vitest";
import { createEditor, type Descendant } from "slate";

import { changePlayingKey } from "./operations";

const mark = (commentId: string) => [
  { commentId, color: "#F5C518", author: "gmann", visibleFor: ["gmann"] },
];

function editorWith(chordLeaves: Descendant[]) {
  const editor = createEditor();
  editor.children = [
    {
      type: "song-meta-row",
      children: [{ type: "song-key", keyValue: "C", children: [{ text: "" }] }],
    },
    { type: "chord-line", children: chordLeaves },
  ] as Descendant[];
  return editor;
}

const chordLine = (editor: ReturnType<typeof createEditor>) =>
  (editor.children[1] as { children: Descendant[] }).children;

describe("changePlayingKey", () => {
  it("мітка на такті лишається на тому самому такті (пісня 209)", () => {
    const editor = editorWith([
      { text: "| F |", comment: mark("a") },
      { text: " F | C | C |" },
    ] as Descendant[]);

    changePlayingKey(editor, "D");

    expect(chordLine(editor)).toEqual([
      { text: "| G |", comment: mark("a") },
      { text: " G | D | D |" },
    ]);
  });

  it("мітка посередині рядка не розповзається і не зникає", () => {
    const editor = editorWith([
      { text: "| C | " },
      { text: "Am", comment: mark("b") },
      { text: " | F |" },
    ] as Descendant[]);

    changePlayingKey(editor, "D");

    expect(chordLine(editor)).toEqual([
      { text: "| D | " },
      { text: "Bm", comment: mark("b") },
      { text: " | G |" },
    ]);
  });

  it("довжина акорду змінюється (F → F#) — мітки сусідів на місці", () => {
    const editor = editorWith([
      { text: "| F ", comment: mark("c") },
      { text: "| C |" },
    ] as Descendant[]);

    changePlayingKey(editor, "Csharp");

    expect(chordLine(editor)).toEqual([
      { text: "| F# ", comment: mark("c") },
      { text: "| C# |" },
    ]);
  });
});
