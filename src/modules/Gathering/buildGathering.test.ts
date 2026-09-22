import { describe, expect, it } from "vitest";
import type { Descendant } from "slate";

import { makeNotePoint, makeSongPoint, makeSoundingNote, type ListPoint } from "#models/listPoint";
import { buildGathering, type GatheringPoint } from "./buildGathering";

/**
 * Документ пісні у вигляді, у якому він приїжджає з ендпоінта зібрання.
 * Мінімальний, але справжній: шапка плюс одна секція з акордовими рядками.
 */
const songDoc = (opts: {
  bpm?: number;
  timeSignature?: string;
  key?: string;
  lines?: string[];
}): Descendant[] =>
  [
    { type: "song-name", children: [{ text: "Пісня" }] },
    {
      type: "song-meta-row",
      children: [
        { type: "bpm", children: [{ text: String(opts.bpm ?? 80) }] },
        { type: "time-signature", children: [{ text: opts.timeSignature ?? "4/4" }] },
        { type: "song-key", keyValue: opts.key ?? "C", children: [{ text: "" }] },
        { type: "capo", valuesBy: {}, children: [{ text: "" }] },
      ],
    },
    {
      type: "section",
      children: (opts.lines ?? ["| C | G |"]).map((text) => ({
        type: "chord-line",
        children: [{ text }],
      })),
    },
  ] as unknown as Descendant[];

/** Пісенний пункт разом із його документом. */
const song = (doc: Descendant[] = songDoc({})): GatheringPoint => ({
  ...makeSongPoint({ id: 1, name: "Пісня" }),
  slate: doc,
});

const note = (text = "Молитва"): GatheringPoint => makeNotePoint(text);
const sounding = (): GatheringPoint => makeSoundingNote();

/** Акордові рядки програша, що стоїть пунктом `index`. */
const programLines = (points: GatheringPoint[], index: number): string[] => {
  const item = buildGathering(points).items[index] as { kind: string; nodes: any[] };
  expect(item.kind).toBe("sounding");
  return item.nodes[0].children
    .filter((line: any) => line.type === "chord-line")
    .map((line: any) => line.children[0].text);
};

describe("buildGathering — показ", () => {
  it("порожній список не дає елементів", () => {
    expect(buildGathering([]).items).toEqual([]);
  });

  it("пісня віддається своїм документом і своїм номером", () => {
    const doc = songDoc({});
    const gathering = buildGathering([song(doc), note(), song(doc)]);

    expect(gathering.items.map((item) => item.kind)).toEqual(["song", "note", "song"]);
    expect(gathering.items[0]).toMatchObject({ kind: "song", number: 1, nodes: doc });
    expect(gathering.items[2]).toMatchObject({ kind: "song", number: 2 });
  });

  it("примітка без програша віддається самим текстом", () => {
    const gathering = buildGathering([note("Далі — молитва")]);

    expect(gathering.items[0]).toMatchObject({ kind: "note", text: "Далі — молитва" });
  });

  it("пісня без документа не ламає ряд", () => {
    const points: GatheringPoint[] = [{ ...makeSongPoint({ id: 7, name: "Без нот" }) }, song()];

    expect(buildGathering(points).items.map((item) => item.kind)).toEqual(["song", "song"]);
  });

  it("програш віддається документом, у якому текст примітки — заголовок секції", () => {
    const nodes = (buildGathering([song(), sounding(), song()]).items[1] as { nodes: any[] })
      .nodes;

    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("section");
    expect(nodes[0].children[0]).toEqual({ type: "line", children: [{ text: "Програш" }] });
  });

  it("документ програша не має шапки: чужої назви й чужих перемикачів у ньому не буває", () => {
    const nodes = (buildGathering([sounding()]).items[0] as { nodes: any[] }).nodes;

    expect(nodes.every((node) => node.type === "section")).toBe(true);
  });
});

describe("buildGathering — акорди програша", () => {
  const prev = () => song(songDoc({ key: "C", lines: ["| C | Am |"] }));
  const next = () => song(songDoc({ key: "G", lines: ["| Em | D |"] }));

  it("між двома піснями — три рядки: вихід, коло, вхід", () => {
    expect(programLines([prev(), sounding(), next()], 1)).toEqual([
      "| Am | D7 |",
      "| G | C |",
      "| Em |",
    ]);
  });

  it("вихід веде від останнього звучного акорда попередньої, а не від її ярлика", () => {
    // Ярлик попередньої — C, але останній її акорд Am.
    expect(programLines([prev(), sounding(), next()], 1)[0]).toBe("| Am | D7 |");
  });

  it("вхід веде в перший звучний акорд наступної пісні, а не в її ярлик", () => {
    // Ярлик наступної — G, але перший її акорд Em.
    expect(programLines([prev(), sounding(), next()], 1)[2]).toBe("| Em |");
  });

  it("тиша на шві не стає акордом", () => {
    const silent = song(songDoc({ key: "C", lines: ["| C | _ |"] }));

    expect(programLines([silent, sounding(), next()], 1)[0]).toBe("| C | D7 |");
  });

  it("без наступної пісні коло лишається в тональності попередньої, і входу немає", () => {
    expect(programLines([prev(), sounding()], 1)).toEqual(["| Am | G7 |", "| C | F |"]);
  });

  it("програш першим пунктом іде без виходу, але не зникає", () => {
    expect(programLines([sounding(), next()], 0)).toEqual(["| G | C |", "| Em |"]);
  });

  it("програш без сусідів — саме коло в дефолтній тональності", () => {
    expect(programLines([sounding()], 0)).toEqual(["| C | F |"]);
  });

  it("сусід через примітку сусідом не є: цей шов порожній", () => {
    expect(programLines([prev(), note(), sounding(), next()], 2)).toEqual([
      "| G | C |",
      "| Em |",
    ]);
  });

  it("наступна пісня без розмічених тактів — входити нема в що", () => {
    const wordless = song(songDoc({ key: "G", lines: ["Am F C"] }));

    expect(programLines([prev(), sounding(), wordless], 1)).toEqual([
      "| Am | D7 |",
      "| G | C |",
    ]);
  });
});

describe("buildGathering — детермінованість", () => {
  it("двічі викликаний на тих самих пунктах дає той самий результат", () => {
    const points: ListPoint[] = [song(), sounding(), song(songDoc({ key: "G", bpm: 100 })), note()];

    const first = buildGathering(points as GatheringPoint[]);
    const second = buildGathering(points as GatheringPoint[]);

    expect(JSON.stringify(first.items)).toEqual(JSON.stringify(second.items));
  });
});
