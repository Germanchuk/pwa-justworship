import { describe, expect, it } from "vitest";
import { createEditor, type Descendant, type Editor } from "slate";

import type { CustomText } from "../types";
import { readNote } from "./noteStore";
import {
  addHighlight,
  addNote,
  moveComment,
  setCommentAudience,
  setCommentColor,
} from "./withComments";

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

const audiencesOf = (editor: Editor, commentId: string): string[][] => {
  const section = editor.children[1] as { children: Array<{ children: CustomText[] }> };
  return section.children.flatMap((row) =>
    row.children.flatMap((leaf) =>
      (leaf.comment ?? [])
        .filter((m) => m.commentId === commentId)
        .map((m) => m.visibleFor),
    ),
  );
};

describe("setCommentAudience — зміна адресатів позначки", () => {
  it("міняє адресатів і в мітках, і в записі примітки", () => {
    const editor = makeEditor();
    addNote(editor, "c1", ["anna"], "#F5C518", "тихіше", "anna");

    setCommentAudience(editor, "c1", ["anna", "taras"]);

    const audiences = audiencesOf(editor, "c1");
    expect(audiences.length).toBeGreaterThan(0);
    for (const a of audiences) expect(a).toEqual(["anna", "taras"]);
    expect(readNote(editor, "c1")?.visibleFor).toEqual(["anna", "taras"]);
    expect(readNote(editor, "c1")?.body).toBe("тихіше");
  });

  it("не чіпає сусідні позначки на тому ж тексті", () => {
    const editor = makeEditor();
    addHighlight(editor, "c1", ["anna"], "#F5C518", "anna");
    addHighlight(editor, "c2", ["anna"], "#4CAF50", "anna");

    setCommentAudience(editor, "c1", ["taras"]);

    expect(audiencesOf(editor, "c2").every((a) => a.join() === "anna")).toBe(true);
    expect(readNote(editor, "c1")).toBeUndefined();
  });

  it("порожній перелік ігнорує — позначку без адресатів не бачив би ніхто", () => {
    const editor = makeEditor();
    addHighlight(editor, "c1", ["anna"], "#F5C518", "anna");

    setCommentAudience(editor, "c1", []);

    for (const a of audiencesOf(editor, "c1")) expect(a).toEqual(["anna"]);
  });
});

describe("setCommentColor — зміна кольору позначки", () => {
  it("міняє колір і в мітках, і в записі примітки, не чіпаючи решти", () => {
    const editor = makeEditor();
    addNote(editor, "c1", ["anna"], "#F5C518", "тихіше", "anna");

    setCommentColor(editor, "c1", "strike");

    const section = editor.children[1] as { children: Array<{ children: CustomText[] }> };
    const marks = section.children.flatMap((row) =>
      row.children.flatMap((leaf) => leaf.comment ?? []),
    );
    expect(marks.length).toBeGreaterThan(0);
    for (const m of marks) expect(m.color).toBe("strike");
    expect(readNote(editor, "c1")).toMatchObject({
      color: "strike",
      body: "тихіше",
      visibleFor: ["anna"],
    });
  });
});

describe("moveComment — зміна області позначки", () => {
  it("переносить позначку на нову область, картка й решта лишаються", () => {
    const editor = makeEditor();
    addNote(editor, "c1", ["anna"], "#F5C518", "тихіше", "anna");

    // Після addNote рядок розбитий: "Свят" (з міткою) + ", свят, свят".
    moveComment(editor, "c1", {
      anchor: { path: [1, 0, 1], offset: 2 },
      focus: { path: [1, 0, 1], offset: 6 },
    });

    const section = editor.children[1] as { children: Array<{ children: CustomText[] }> };
    const marked = section.children
      .flatMap((row) => row.children)
      .filter((leaf) => (leaf.comment ?? []).some((c) => c.commentId === "c1"))
      .map((leaf) => leaf.text)
      .join("");
    expect(marked).toBe("свят");
    expect(readNote(editor, "c1")).toMatchObject({ body: "тихіше", color: "#F5C518" });
  });

  it("область поза текстом пісні ігнорує — позначка лишається на місці", () => {
    const editor = makeEditor();
    addHighlight(editor, "c1", ["anna"], "#F5C518", "anna");

    moveComment(editor, "c1", {
      anchor: { path: [0, 0, 0], offset: 0 },
      focus: { path: [0, 0, 0], offset: 2 },
    });

    expect(audiencesOf(editor, "c1").length).toBeGreaterThan(0);
  });
});
