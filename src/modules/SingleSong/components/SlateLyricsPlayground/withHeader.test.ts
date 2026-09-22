import { describe, expect, it } from "vitest";
import { createEditor, Editor, Node, Transforms, type Descendant } from "slate";

import { withHeader } from "./withHeader";
import { withMetaSchema } from "./withMetaSchema";
import { withSections } from "./withSections";

/**
 * Шапка заповнена непорожніми даними — щоб було видно, якщо Enter підмінив
 * її значеннями за замовчуванням.
 */
const song = (): Editor => {
  const editor = withSections(withHeader(withMetaSchema(createEditor())));
  editor.children = [
    { type: "song-name", children: [{ text: "Пісня" }] },
    {
      type: "song-meta-row",
      "note:c1": { body: "примітка", color: "#fde047", visibleFor: ["all"] },
      children: [
        { type: "bpm", children: [{ text: "120" }] },
        { type: "time-signature", children: [{ text: "6/8" }] },
        { type: "song-key", keyValue: "G", children: [{ text: "" }] },
        { type: "capo", valuesBy: { olha: 2 }, children: [{ text: "" }] },
      ],
    },
    { type: "section", children: [{ type: "line", children: [{ text: "Рядок один" }] }] },
  ] as Descendant[];
  Editor.normalize(editor, { force: true });
  return editor;
};

describe("Enter у шапці", () => {
  it.each([
    ["Enter посеред назви", (e: Editor) => e.insertBreak(), { path: [0, 0], offset: 2 }],
    ["Enter у кінці назви", (e: Editor) => e.insertBreak(), { path: [0, 0], offset: 5 }],
    ["Shift+Enter у назві", (e: Editor) => e.insertSoftBreak(), { path: [0, 0], offset: 2 }],
    ["Enter на бейджі", (e: Editor) => e.insertBreak(), { path: [1, 3, 0], offset: 0 }],
  ])("%s нічого не робить", (_, press, point) => {
    const editor = song();
    const before = JSON.stringify(editor.children);
    Transforms.select(editor, point);
    press(editor);

    expect(JSON.stringify(editor.children)).toBe(before);
  });

  it("Enter на виділенні від назви до тексту нічого не робить", () => {
    const editor = song();
    const before = JSON.stringify(editor.children);
    Transforms.select(editor, {
      anchor: { path: [0, 0], offset: 2 },
      focus: { path: [2, 0, 0], offset: 5 },
    });
    editor.insertBreak();

    expect(JSON.stringify(editor.children)).toBe(before);
  });

  it("Enter у тексті пісні, як і раніше, розриває рядок", () => {
    const editor = song();
    Transforms.select(editor, { path: [2, 0, 0], offset: "Рядок".length });
    editor.insertBreak();

    const [section] = editor.children.slice(2) as { children: Node[] }[];
    expect(section.children.map((line) => Node.string(line))).toEqual(["Рядок", " один"]);
  });
});
