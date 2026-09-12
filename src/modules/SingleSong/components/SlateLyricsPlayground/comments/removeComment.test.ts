import { describe, expect, it } from "vitest";
import { createEditor, type Descendant, type Editor } from "slate";

import type { CommentMark, CustomText, NoteRecord } from "../types";
import { readNote } from "./noteStore";
import { addNote, removeComment } from "./withComments";
import { AUDIENCE_ALL } from "./visibility";

const ANNA = "anna";
const BOHDAN = "bohdan";
const VIKA = "vika";
const TARAS = "taras";
const VOCALS = [ANNA, BOHDAN, VIKA];

/**
 * Найменший документ, у якому примітка взагалі може жити: рядок метаданих
 * (там лежать записи приміток) плюс секція з одним рядком тексту.
 *
 * `withComments` сюди НЕ загортається навмисно: його `normalizeNode` чистить
 * осиротілі примітки, а перевіряємо ми не прибирання, а звуження адресатів.
 */
const makeEditor = (): Editor => {
  const editor = createEditor();
  editor.children = [
    { type: "song-meta-row", children: [{ type: "bpm", children: [{ text: "70" }] }] },
    {
      type: "section",
      children: [{ type: "line", children: [{ text: "Свят, свят, свят" }] }],
    },
  ] as unknown as Descendant[];
  editor.selection = {
    anchor: { path: [1, 0, 0], offset: 0 },
    focus: { path: [1, 0, 0], offset: 4 },
  };
  return editor;
};

const marksOf = (editor: Editor, commentId: string): CommentMark[] => {
  const out: CommentMark[] = [];
  const section = editor.children[1] as { children: Array<{ children: CustomText[] }> };
  for (const row of section.children) {
    for (const leaf of row.children) {
      for (const mark of leaf.comment ?? []) {
        if (mark.commentId === commentId) out.push(mark);
      }
    }
  }
  return out;
};

const noteOf = (editor: Editor, commentId: string): NoteRecord | undefined =>
  readNote(editor, commentId);

describe("removeComment — видалення звужує адресатів", () => {
  it("зносить коментар, адресований рівно вибраним", () => {
    const editor = makeEditor();
    addNote(editor, "c1", [...VOCALS], "#F5C518", "тихіше", "leader");

    removeComment(editor, "c1", VOCALS);

    expect(marksOf(editor, "c1")).toEqual([]);
    expect(noteOf(editor, "c1")).toBeUndefined();
  });

  it("лишає коментар тому, кого у виборі не було — і в мітці, і в записі", () => {
    const editor = makeEditor();
    addNote(editor, "c1", [...VOCALS, TARAS], "#F5C518", "тихіше", "leader");

    removeComment(editor, "c1", VOCALS);

    const marks = marksOf(editor, "c1");
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) expect(mark.visibleFor).toEqual([TARAS]);
    expect(noteOf(editor, "c1")?.visibleFor).toEqual([TARAS]);
    // Текст підказки Тарас не втрачає.
    expect(noteOf(editor, "c1")?.body).toBe("тихіше");
  });

  it("зносить публічний коментар цілком: з `all` нікого не віднімеш", () => {
    const editor = makeEditor();
    addNote(editor, "c1", [AUDIENCE_ALL], "#6B7280", "всі разом", "leader");

    removeComment(editor, "c1", VOCALS);

    expect(marksOf(editor, "c1")).toEqual([]);
    expect(noteOf(editor, "c1")).toBeUndefined();
  });

  it("не чіпає інші коментарі на тому самому тексті", () => {
    const editor = makeEditor();
    addNote(editor, "c1", [...VOCALS], "#F5C518", "перший", "leader");
    editor.selection = {
      anchor: { path: [1, 0, 0], offset: 0 },
      focus: { path: [1, 0, 0], offset: 4 },
    };
    addNote(editor, "c2", [ANNA], "#4CAF50", "другий", "leader");

    removeComment(editor, "c1", VOCALS);

    expect(marksOf(editor, "c1")).toEqual([]);
    expect(marksOf(editor, "c2").length).toBeGreaterThan(0);
    expect(noteOf(editor, "c2")?.body).toBe("другий");
  });
});
