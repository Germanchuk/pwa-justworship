import { describe, expect, it } from "vitest";
import { createEditor, Editor, Transforms, type Descendant } from "slate";

import { withSections } from "./withSections";
import { toSetNodesProps } from "./sectionAttrs";
import type { SectionElement } from "./types";
import type { DynamicsStepKey } from "./constants/dynamicsSteps";

/**
 * Правила з `sectionAttrs.ts` перевіряємо через справжню нормалізацію: злиття
 * й ділення секцій ніхто не викликає явно — вони трапляються самі, коли
 * зникає або зʼявляється порожній рядок.
 */

const line = (text: string): Descendant => ({ type: "line", children: [{ text }] }) as Descendant;
const emptyLine = (): Descendant => ({ type: "line", children: [{ text: "" }] }) as Descendant;

const section = (
  lines: string[],
  attrs: Partial<SectionElement> = {},
): Descendant =>
  ({ type: "section", ...attrs, children: lines.map(line) }) as Descendant;

/** Шапка документа: `withSections` тримає індекси 0 і 1 за нею. */
const header = (): Descendant[] => [
  { type: "song-name", children: [{ text: "Пісня" }] } as Descendant,
  { type: "song-meta-row", children: [{ type: "bpm", children: [{ text: "0" }] }] } as Descendant,
];

const makeEditor = (children: Descendant[]) => {
  const editor = withSections(createEditor());
  editor.children = [...header(), ...children];
  Editor.normalize(editor, { force: true });
  return editor;
};

const sections = (editor: Editor): SectionElement[] =>
  editor.children.filter(
    (node): node is SectionElement => (node as SectionElement).type === "section",
  );

const CALM: DynamicsStepKey = "calm";
const DEV: DynamicsStepKey = "development";
const LOUD: DynamicsStepKey = "loud";
const CLIMAX: DynamicsStepKey = "climax";

describe("злиття секцій", () => {
  /** Дві секції поспіль без порожнього рядка між ними — нормалізація їх зіллє. */
  const merged = (upper: Partial<SectionElement>, lower: Partial<SectionElement>) => {
    const editor = makeEditor([
      section(["верх 1", "верх 2"], upper),
      section(["низ 1", "низ 2"], lower),
    ]);
    const all = sections(editor);
    expect(all).toHaveLength(1);
    return all[0];
  };

  it("бере кількість повторів з верхньої секції", () => {
    expect(merged({ repeat: 3 }, { repeat: 2 }).repeat).toBe(3);
  });

  it("лишає секцію без повторів, якщо їх не мала верхня", () => {
    expect(merged({}, { repeat: 2 }).repeat).toBeUndefined();
  });

  it("склеює кроки динаміки згори вниз", () => {
    expect(merged({ dynamicsSteps: [CALM, DEV] }, { dynamicsSteps: [LOUD] }).dynamicsSteps).toEqual(
      [CALM, DEV, LOUD],
    );
  });

  it("зливає однакові кроки на стику в один", () => {
    expect(
      merged({ dynamicsSteps: [CALM, DEV] }, { dynamicsSteps: [DEV, LOUD] }).dynamicsSteps,
    ).toEqual([CALM, DEV, LOUD]);
  });

  it("стягує цілий пробіг однакових кроків на стику", () => {
    expect(
      merged({ dynamicsSteps: [CALM, DEV] }, { dynamicsSteps: [DEV, DEV, LOUD] }).dynamicsSteps,
    ).toEqual([CALM, DEV, LOUD]);
  });

  it("не чіпає дублікати всередині секції — їх поставили руками", () => {
    expect(
      merged({ dynamicsSteps: [CALM, CALM, DEV] }, { dynamicsSteps: [LOUD, LOUD] }).dynamicsSteps,
    ).toEqual([CALM, CALM, DEV, LOUD, LOUD]);
  });

  it("підхоплює динаміку нижньої, коли верхня її не мала", () => {
    expect(merged({}, { dynamicsSteps: [LOUD] }).dynamicsSteps).toEqual([LOUD]);
  });

  it("не обрізає склейку до ліміту в 10 кроків", () => {
    const six = Array<DynamicsStepKey>(6).fill(CALM);
    const seven = Array<DynamicsStepKey>(7).fill(LOUD);
    expect(merged({ dynamicsSteps: six }, { dynamicsSteps: seven }).dynamicsSteps).toHaveLength(13);
  });

  it("розгортає секцію, навіть якщо обидві були згорнуті", () => {
    expect(
      merged({ collapsedFor: ["herman"] }, { collapsedFor: ["herman", "anna"] }).collapsedFor,
    ).toBeUndefined();
  });
});

describe("ділення секції", () => {
  /** Порожній рядок усередині секції розриває її навпіл. */
  const split = (attrs: Partial<SectionElement>, upperLines = 2, lowerLines = 2) => {
    const editor = makeEditor([
      {
        type: "section",
        ...attrs,
        children: [
          ...Array.from({ length: upperLines }, (_, i) => line(`верх ${i}`)),
          emptyLine(),
          ...Array.from({ length: lowerLines }, (_, i) => line(`низ ${i}`)),
        ],
      } as Descendant,
    ]);
    const all = sections(editor);
    expect(all).toHaveLength(2);
    return { upper: all[0], lower: all[1] };
  };

  it("лишає повтори верхній секції, нова — без повторів", () => {
    const { upper, lower } = split({ repeat: 4 });
    expect(upper.repeat).toBe(4);
    expect(lower.repeat).toBeUndefined();
  });

  it("зберігає згортання верхньої, нову лишає розгорнутою", () => {
    const { upper, lower } = split({ collapsedFor: ["herman"] });
    expect(upper.collapsedFor).toEqual(["herman"]);
    expect(lower.collapsedFor).toBeUndefined();
  });

  it("віддає межовий крок обом частинам: три кроки навпіл", () => {
    const { upper, lower } = split({ dynamicsSteps: [CALM, DEV, LOUD] }, 2, 2);
    expect(upper.dynamicsSteps).toEqual([CALM, DEV]);
    expect(lower.dynamicsSteps).toEqual([DEV, LOUD]);
  });

  it("ділить кроки пропорційно до кількості рядків", () => {
    const { upper, lower } = split({ dynamicsSteps: [CALM, DEV, LOUD, CLIMAX] }, 6, 2);
    expect(upper.dynamicsSteps).toEqual([CALM, DEV, LOUD]);
    expect(lower.dynamicsSteps).toEqual([LOUD, CLIMAX]);
  });

  it("не лишає жодну частину без динаміки при сильному перекосі", () => {
    const { upper, lower } = split({ dynamicsSteps: [CALM, CLIMAX] }, 9, 1);
    expect(upper.dynamicsSteps).toEqual([CALM, CLIMAX]);
    expect(lower.dynamicsSteps).toEqual([CLIMAX]);
  });

  it("віддає єдиний крок обом частинам", () => {
    const { upper, lower } = split({ dynamicsSteps: [DEV] }, 3, 1);
    expect(upper.dynamicsSteps).toEqual([DEV]);
    expect(lower.dynamicsSteps).toEqual([DEV]);
  });

  it("лишає обидві частини без динаміки, якщо її не було", () => {
    const { upper, lower } = split({});
    expect(upper.dynamicsSteps).toBeUndefined();
    expect(lower.dynamicsSteps).toBeUndefined();
  });

  it("не ділить секцію, коли порожній рядок останній — атрибути лишаються", () => {
    const editor = makeEditor([
      {
        type: "section",
        repeat: 2,
        dynamicsSteps: [CALM, LOUD],
        collapsedFor: ["herman"],
        children: [line("верх 1"), line("верх 2"), emptyLine()],
      } as Descendant,
    ]);
    const all = sections(editor);
    expect(all).toHaveLength(1);
    expect(all[0].repeat).toBe(2);
    expect(all[0].dynamicsSteps).toEqual([CALM, LOUD]);
    expect(all[0].collapsedFor).toEqual(["herman"]);
  });
});

describe("зняття пропа для Yjs", () => {
  const withAll = {
    type: "section",
    repeat: 2,
    collapsedFor: ["herman"],
    children: [],
  } as unknown as SectionElement;

  it("знімає наявний проп через null, а не undefined", () => {
    // @slate-yjs робить `removeAttribute` лише на строгому `null`.
    const props = toSetNodesProps({ repeat: 3, collapsedFor: undefined }, withAll);
    expect(props).toEqual({ repeat: 3, collapsedFor: null });
  });

  it("не згадує пропи, яких у вузлі й так немає", () => {
    const props = toSetNodesProps(
      { repeat: undefined, collapsedFor: undefined, dynamicsSteps: undefined },
      { type: "section", children: [] } as unknown as SectionElement,
    );
    expect(props).toEqual({});
  });
});

describe("ділення й наступне злиття", () => {
  /**
   * Ділення двоїть межовий крок, злиття стягує його назад — разом вони мусять
   * повертати рівно ту динаміку, що була. Інакше кожна правка тексту повільно
   * розмножувала б кроки.
   */
  const roundTrip = (steps: DynamicsStepKey[]) => {
    const editor = makeEditor([
      {
        type: "section",
        repeat: 3,
        dynamicsSteps: steps,
        children: [line("верх 1"), line("верх 2"), emptyLine(), line("низ 1"), line("низ 2")],
      } as Descendant,
    ]);
    expect(sections(editor)).toHaveLength(2);

    // Прибираємо порожній рядок-межу — секції злипаються назад.
    const emptyIndex = editor.children.findIndex(
      (node) => (node as { type?: string }).type === "empty-line",
    );
    Transforms.removeNodes(editor, { at: [emptyIndex] });

    const all = sections(editor);
    expect(all).toHaveLength(1);
    expect(all[0].repeat).toBe(3);
    return all[0];
  };

  it("повертає динаміку на місце: непарна кількість кроків", () => {
    expect(roundTrip([CALM, DEV, LOUD]).dynamicsSteps).toEqual([CALM, DEV, LOUD]);
  });

  it("повертає динаміку на місце: парна кількість кроків", () => {
    expect(roundTrip([CALM, DEV, LOUD, CLIMAX]).dynamicsSteps).toEqual([
      CALM,
      DEV,
      LOUD,
      CLIMAX,
    ]);
  });

  it("повертає динаміку на місце: єдиний крок", () => {
    expect(roundTrip([DEV]).dynamicsSteps).toEqual([DEV]);
  });
});
