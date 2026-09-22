import { describe, expect, it } from "vitest";
import {
  createEditor,
  Editor,
  Element,
  Node,
  Transforms,
  type Descendant,
  type Path,
  type Point,
} from "slate";

import { withClipboard } from "./withClipboard";
import { withHeader, makeDefaultMetaRow, makeDefaultSongName } from "./withHeader";
import { withSections } from "./withSections";
import type { CustomText, SectionElement } from "./types";

/**
 * Буфер обміну перевіряємо як користувач: виділив → скопіював → виділив
 * інше місце → вставив. Фрагмент проганяємо через JSON, як це робить
 * справжній буфер обміну.
 */

type Attrs = Partial<Pick<SectionElement, "repeat" | "dynamicsSteps" | "collapsedFor">>;

const line = (text: string | CustomText[]): Descendant =>
  ({
    type: "line",
    children: typeof text === "string" ? [{ text }] : text,
  }) as Descendant;

const section = (lines: (string | CustomText[])[], attrs: Attrs = {}): Descendant =>
  ({ type: "section", ...attrs, children: lines.map(line) }) as Descendant;

const empty = (): Descendant => ({ type: "empty-line", children: [{ text: "" }] }) as Descendant;

const makeEditor = (body: Descendant[]) => {
  const editor = withClipboard(withSections(withHeader(createEditor())));
  editor.children = [makeDefaultSongName("Пісня"), makeDefaultMetaRow(), ...body];
  Editor.normalize(editor, { force: true });
  return editor;
};

/** Шлях рядка з таким текстом — щоб виділяти так, як це бачить користувач. */
const pathOf = (editor: Editor, text: string): Path => {
  for (const [node, path] of Node.elements(editor)) {
    if (node.type === "line" || node.type === "chord-line" || node.type === "song-name") {
      if (Node.string(node) === text) return path;
    }
  }
  throw new Error(`рядка «${text}» немає`);
};

const startOf = (editor: Editor, text: string): Point => Editor.start(editor, pathOf(editor, text));
const endOf = (editor: Editor, text: string): Point => Editor.end(editor, pathOf(editor, text));

const select = (editor: Editor, anchor: Point, focus: Point = anchor) =>
  Transforms.select(editor, { anchor, focus });

/** Виділити рядки від першого до останнього — рівно по тексту. */
const selectLines = (editor: Editor, from: string, to: string = from) =>
  select(editor, startOf(editor, from), endOf(editor, to));

const copy = (editor: Editor): Descendant[] => JSON.parse(JSON.stringify(editor.getFragment()));

const pasteText = (editor: Editor, text: string) =>
  editor.insertTextData({
    getData: (type: string) => (type === "text/plain" ? text : ""),
  } as DataTransfer);

/** Тіло пісні рядками: секція — `[a / b]`, порожній рядок — `·`. */
const outline = (editor: Editor): string[] =>
  editor.children.slice(2).map((node) =>
    Element.isElement(node) && node.type === "section"
      ? `[${node.children.map((child) => Node.string(child)).join(" / ")}]`
      : "·",
  );

const sections = (editor: Editor): SectionElement[] =>
  editor.children.filter(
    (node): node is SectionElement => Element.isElement(node) && node.type === "section",
  );

const hasNestedSection = (editor: Editor): boolean =>
  sections(editor).some((s) => s.children.some((child) => (child as Descendant as SectionElement).type === "section"));

const attrsOf = (s: SectionElement) => ({
  repeat: s.repeat,
  dynamicsSteps: s.dynamicsSteps,
  collapsedFor: s.collapsedFor,
});

describe("копіювання", () => {
  const song = () =>
    makeEditor([
      section(["a1", "a2"], { repeat: 2, dynamicsSteps: ["calm", "loud"], collapsedFor: ["olha"] }),
    ]);

  it("частина секції копіюється простим текстом — без секції й атрибутів", () => {
    const editor = song();
    selectLines(editor, "a1");
    expect(copy(editor)).toEqual([line("a1")]);
  });

  it("ціла секція копіюється з повторами й динамікою, але без згортання", () => {
    const editor = song();
    selectLines(editor, "a1", "a2");
    expect(copy(editor)).toEqual([
      section(["a1", "a2"], { repeat: 2, dynamicsSteps: ["calm", "loud"] }),
    ]);
  });

  it("примітки не копіюються", () => {
    const comment = [{ commentId: "c1", visibleFor: ["all"], color: "#fde047" }];
    const editor = makeEditor([section([[{ text: "a" }, { text: "1", comment }], "a2"])]);
    selectLines(editor, "a1", "a2");
    expect(copy(editor)).toEqual([section(["a1", "a2"])]);
  });

  it("потрійний клік (виділення до початку наступного рядка) не несе зайвого порожнього рядка", () => {
    const editor = song();
    select(editor, startOf(editor, "a1"), startOf(editor, "a2"));
    expect(copy(editor)).toEqual([line("a1")]);
  });
});

describe("вставка", () => {
  const twoSections = () =>
    makeEditor([
      section(["a1", "a2"], { repeat: 3, dynamicsSteps: ["calm", "loud"] }),
      empty(),
      section(["b1", "b2", "b3"], { repeat: 2 }),
    ]);

  it("рядок на місце виділеного рядка іншої секції — без вкладеної секції", () => {
    const editor = twoSections();
    selectLines(editor, "a1");
    const fragment = copy(editor);

    selectLines(editor, "b2");
    editor.insertFragment(fragment);

    expect(hasNestedSection(editor)).toBe(false);
    expect(outline(editor)).toEqual(["[a1 / a2]", "·", "[b1 / a1 / b3]"]);
    expect(sections(editor)[1].repeat).toBe(2);
  });

  it("рядок на вільному місці не приносить атрибутів своєї секції", () => {
    const editor = makeEditor([
      section(["a1", "a2"], { repeat: 3, dynamicsSteps: ["calm"] }),
      empty(),
      empty(),
      empty(),
      section(["b1"]),
    ]);
    selectLines(editor, "a1");
    const fragment = copy(editor);

    select(editor, Editor.start(editor, [4]));
    editor.insertFragment(fragment);

    expect(outline(editor)).toEqual(["[a1 / a2]", "·", "[a1]", "·", "[b1]"]);
    expect(attrsOf(sections(editor)[1])).toEqual({
      repeat: undefined,
      dynamicsSteps: undefined,
      collapsedFor: undefined,
    });
  });

  it("ціла секція на місце іншої цілої секції приносить свої атрибути", () => {
    const editor = makeEditor([
      section(["a1", "a2"], { repeat: 3, dynamicsSteps: ["calm", "loud"] }),
      empty(),
      section(["b1", "b2"], { repeat: 2, dynamicsSteps: ["climax"], collapsedFor: ["olha"] }),
    ]);
    selectLines(editor, "a1", "a2");
    const fragment = copy(editor);

    selectLines(editor, "b1", "b2");
    editor.insertFragment(fragment);

    expect(hasNestedSection(editor)).toBe(false);
    expect(outline(editor)).toEqual(["[a1 / a2]", "·", "[a1 / a2]"]);
    expect(attrsOf(sections(editor)[1])).toEqual({
      repeat: 3,
      dynamicsSteps: ["calm", "loud"],
      collapsedFor: undefined,
    });
  });

  it("ціла секція на вільному порожньому рядку стає окремою секцією з атрибутами", () => {
    const editor = makeEditor([
      section(["a1", "a2"], { repeat: 3 }),
      empty(),
      empty(),
      empty(),
      section(["b1"]),
    ]);
    selectLines(editor, "a1", "a2");
    const fragment = copy(editor);

    select(editor, Editor.start(editor, [4]));
    editor.insertFragment(fragment);

    expect(outline(editor)).toEqual(["[a1 / a2]", "·", "[a1 / a2]", "·", "[b1]"]);
    expect(sections(editor)[1].repeat).toBe(3);
  });

  it("ціла секція посеред рядка зливається з ним і атрибутів не навʼязує", () => {
    const editor = makeEditor([
      section(["a1", "a2"], { repeat: 3 }),
      empty(),
      section(["hello world", "b2"], { repeat: 2 }),
    ]);
    selectLines(editor, "a1", "a2");
    const fragment = copy(editor);

    select(editor, { path: startOf(editor, "hello world").path, offset: "hello".length });
    editor.insertFragment(fragment);

    expect(hasNestedSection(editor)).toBe(false);
    expect(outline(editor)).toEqual(["[a1 / a2]", "·", "[helloa1 / a2 world / b2]"]);
    expect(sections(editor)[1].repeat).toBe(2);
  });

  it("порожній рядок у вставленому тексті ділить секцію, як Enter", () => {
    const editor = makeEditor([section(["b1", "b2"])]);
    select(editor, endOf(editor, "b1"));
    pasteText(editor, "x\n\ny");

    expect(outline(editor)).toEqual(["[b1x]", "·", "[y / b2]"]);
  });

  it("у назву пісні вставляється один рядок, шапка лишається цілою", () => {
    const editor = makeEditor([section(["b1"])]);
    Transforms.setNodes(editor, { "note:c1": { body: "!", color: "#fff", visibleFor: ["all"] } }, { at: [1] });
    select(editor, endOf(editor, "Пісня"));
    pasteText(editor, " a\nb");

    expect(Node.string(editor.children[0])).toBe("Пісня a b");
    expect(editor.children[1]).toMatchObject({ type: "song-meta-row", "note:c1": { body: "!" } });
    expect(outline(editor)).toEqual(["[b1]"]);
  });
});
