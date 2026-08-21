import { describe, expect, it } from "vitest";
import type { Descendant } from "slate";

import { makeNotePoint, makeSongPoint, makeSoundingNote, type ListPoint } from "#models/listPoint";
import { buildGathering, sliceFromPoint, type GatheringPoint } from "./buildGathering";

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

const ids = (points: GatheringPoint[]) => buildGathering(points).segments.map((s) => s.id);

const chordsOf = (points: GatheringPoint[], segmentId: string) =>
  buildGathering(points)
    .segments.find((s) => s.id === segmentId)!
    .progression.map((e) => e.chord);

const segment = (points: GatheringPoint[], segmentId: string) =>
  buildGathering(points).segments.find((s) => s.id === segmentId)!;

describe("buildGathering — порядок сегментів", () => {
  it("порожній список не дає ні елементів, ні сегментів", () => {
    const gathering = buildGathering([]);

    expect(gathering.items).toEqual([]);
    expect(gathering.segments).toEqual([]);
    expect(gathering.tokens.size).toBe(0);
  });

  it("одна пісня — один сегмент `once`", () => {
    const gathering = buildGathering([song()]);

    expect(gathering.segments).toHaveLength(1);
    expect(gathering.segments[0].kind).toBe("once");
  });

  it("дві пісні підряд ідуть без жодної вставки — атака", () => {
    expect(ids([song(), song()])).toEqual(["p0", "p1"]);
  });

  it("примітка між піснями стає паузою", () => {
    expect(ids([song(), note(), song()])).toEqual(["p0", "p1:pause", "p2"]);
    expect(segment([song(), note(), song()], "p1:pause").kind).toBe("pause");
  });

  it("програш між піснями стає трьома сегментами: вступ → луп → вихід", () => {
    expect(ids([song(), sounding(), song()])).toEqual([
      "p0",
      "p1:intro",
      "p1:loop",
      "p1:outro",
      "p2",
    ]);

    const parts = buildGathering([song(), sounding(), song()]).segments;
    expect(parts.map((s) => s.kind)).toEqual(["once", "once", "loop", "once", "once"]);
  });
});

describe("buildGathering — краї", () => {
  it("програш першим пунктом іде без вступу, але не зникає", () => {
    expect(ids([sounding(), song()])).toEqual(["p0:loop", "p0:outro", "p1"]);
  });

  it("програш останнім пунктом іде без виходу, але не зникає", () => {
    expect(ids([song(), sounding()])).toEqual(["p0", "p1:intro", "p1:loop"]);
  });

  it("програш без сусідів з обох боків лишається самим лупом", () => {
    expect(ids([sounding()])).toEqual(["p0:loop"]);
  });

  it("дві примітки підряд дають дві послідовні зупинки", () => {
    expect(ids([song(), note(), note("Ще одна"), song()])).toEqual([
      "p0",
      "p1:pause",
      "p2:pause",
      "p3",
    ]);
  });

  it("сусід через примітку сусідом не є: шов до неї — тиша", () => {
    // Між піснею і програшем стоїть зупинка, тож вести з хвоста тієї пісні
    // нема звідки — вступу немає.
    expect(ids([song(), note(), sounding(), song()])).toEqual([
      "p0",
      "p1:pause",
      "p2:loop",
      "p2:outro",
      "p3",
    ]);
  });

  it("пісня без документа не ламає ряд", () => {
    const points: GatheringPoint[] = [{ ...makeSongPoint({ id: 7, name: "Без нот" }) }, song()];

    expect(ids(points)).toEqual(["p0", "p1"]);
  });
});

describe("buildGathering — музика програша", () => {
  const prev = () => song(songDoc({ key: "C", bpm: 80, timeSignature: "4/4", lines: ["| C | Am |"] }));
  const next = () => song(songDoc({ key: "G", bpm: 100, timeSignature: "4/4", lines: ["| Em | D |"] }));

  it("луп — два такти I–IV у тональності наступної пісні", () => {
    expect(chordsOf([prev(), sounding(), next()], "p1:loop")).toEqual(["G", "C"]);
  });

  it("луп бере розмір і темп наступної пісні", () => {
    const loop = segment([prev(), sounding(), next()], "p1:loop");

    expect(loop.timeSignature).toEqual([4, 4]);
    expect(loop.bpm).toBe(100);
  });

  it("розмір лупа — розмір наступної пісні, навіть коли він інший", () => {
    const six = song(songDoc({ key: "D", bpm: 160, timeSignature: "6/8", lines: ["| D | A |"] }));
    const loop = segment([prev(), sounding(), six], "p1:loop");

    expect(loop.timeSignature).toEqual([6, 8]);
  });

  it("вступ лишається в тональності, розмірі й темпі попередньої пісні", () => {
    const six = song(songDoc({ key: "D", bpm: 160, timeSignature: "6/8", lines: ["| D | A |"] }));
    const intro = segment([prev(), sounding(), six], "p1:intro");

    expect(intro.bpm).toBe(80);
    expect(intro.timeSignature).toEqual([4, 4]);
  });

  it("вступ веде від останнього звучного акорда попередньої до домінанти нової тональності", () => {
    // Ярлик попередньої — C, але останній її акорд Am: шов береться з акордів.
    expect(chordsOf([prev(), sounding(), next()], "p1:intro")).toEqual(["Am", "D7"]);
  });

  it("вихід веде в перший звучний акорд наступної пісні, а не в її ярлик", () => {
    // Ярлик наступної — G, але перший її акорд Em.
    expect(chordsOf([prev(), sounding(), next()], "p1:outro")).toEqual(["Em"]);
  });

  it("тиша на шві не стає акордом", () => {
    const silent = song(songDoc({ key: "C", bpm: 80, lines: ["| C | _ |"] }));

    expect(chordsOf([silent, sounding(), next()], "p1:intro")).toEqual(["C", "D7"]);
  });

  it("без наступної пісні луп лишається в тональності попередньої", () => {
    expect(chordsOf([prev(), sounding()], "p1:loop")).toEqual(["C", "F"]);
  });

  it("наступна пісня без звучних акордів — виходу немає: приходити нема в що", () => {
    // Акорди без тактових рисок не звучать (`SONG-29`), тож пісня мовчить —
    // такий сусід нічим не відрізняється від краю списку.
    const wordless = song(songDoc({ key: "G", lines: ["Am F C"] }));

    expect(ids([prev(), sounding(), wordless])).toEqual([
      "p0",
      "p1:intro",
      "p1:loop",
      "p2",
    ]);
  });

  it("програш без сусідів звучить у дефолтних тональності й розмірі", () => {
    const loop = segment([sounding()], "p0:loop");

    expect(loop.progression.map((e) => e.chord)).toEqual(["C", "F"]);
    expect(loop.timeSignature).toEqual([4, 4]);
  });
});

describe("buildGathering — темп програша", () => {
  const prev = () => song(songDoc({ key: "C", bpm: 80, timeSignature: "4/4" }));

  it("однакові знаменники — темп веде до наступної пісні за один прохід лупа", () => {
    const next = song(songDoc({ key: "G", bpm: 100, timeSignature: "3/4" }));
    const loop = segment([prev(), sounding(), next], "p1:loop");

    expect(loop.rampTempo).toBe(true);
    expect(loop.bpm).toBe(100);
  });

  it("різні знаменники — стрибок на межі вступ→луп і жодного рампу", () => {
    const next = song(songDoc({ key: "D", bpm: 160, timeSignature: "6/8" }));
    const loop = segment([prev(), sounding(), next], "p1:loop");

    expect(loop.rampTempo).toBe(false);
    expect(loop.bpm).toBe(160);
  });

  it("без вступу рампити нема від чого", () => {
    const next = song(songDoc({ key: "G", bpm: 100 }));
    const loop = segment([sounding(), next], "p0:loop");

    expect(loop.rampTempo).toBe(false);
  });

  it("без наступної пісні рампити нема куди", () => {
    const loop = segment([prev(), sounding()], "p1:loop");

    expect(loop.rampTempo).toBe(false);
  });
});

describe("buildGathering — токени", () => {
  it("ключі однакових акордів різних пісень не збігаються", () => {
    const gathering = buildGathering([song(), song(), song()]);
    const keys = [...gathering.tokens.keys()];

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((key) => key.startsWith("p1:"))).toHaveLength(2);
  });

  it("тап по акорду третьої пісні дає точку старту в її сегменті", () => {
    const gathering = buildGathering([song(), song(), song()]);

    // `| C | G |`: другий акорд рядка — токен 3, друга доля такту 4/4.
    expect(gathering.tokens.get("p2:0:0:3")).toEqual({
      segmentIndex: 2,
      segmentId: "p2",
      beats: 4,
    });
  });

  it("токени програша показують на його власні сегменти", () => {
    const gathering = buildGathering([song(), sounding(), song()]);

    expect(gathering.tokens.get("p1:0:0:1")?.segmentId).toBe("p1:intro");
    expect(gathering.tokens.get("p1:0:1:1")?.segmentId).toBe("p1:loop");
    expect(gathering.tokens.get("p1:0:2:1")?.segmentId).toBe("p1:outro");
  });

  it("повторена секція лишає точку старту на першому проходженні акорда", () => {
    const repeated = {
      ...song(),
      slate: [
        { type: "song-name", children: [{ text: "Пісня" }] },
        {
          type: "song-meta-row",
          children: [
            { type: "bpm", children: [{ text: "80" }] },
            { type: "time-signature", children: [{ text: "4/4" }] },
            { type: "song-key", keyValue: "C", children: [{ text: "" }] },
            { type: "capo", valuesBy: {}, children: [{ text: "" }] },
          ],
        },
        {
          type: "section",
          repeat: 2,
          children: [{ type: "chord-line", children: [{ text: "| C | G |" }] }],
        },
      ] as unknown as Descendant[],
    };

    expect(buildGathering([repeated]).tokens.get("p0:0:0:1")?.beats).toBe(0);
  });
});

describe("buildGathering — показ", () => {
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

  it("програш віддається документом, у якому текст примітки — заголовок секції", () => {
    const gathering = buildGathering([song(), sounding(), song()]);
    const item = gathering.items[1];

    expect(item.kind).toBe("sounding");
    const nodes = (item as { nodes: any[] }).nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("section");

    const lines = nodes[0].children;
    expect(lines[0]).toEqual({ type: "line", children: [{ text: "Програш" }] });
    expect(lines.slice(1).map((line: any) => line.type)).toEqual([
      "chord-line",
      "chord-line",
      "chord-line",
    ]);
    expect(lines[2].children[0].text).toBe("| C | F |");
  });

  it("документ програша не має шапки: чужої назви й чужих перемикачів у ньому не буває", () => {
    const gathering = buildGathering([sounding()]);
    const nodes = (gathering.items[0] as { nodes: any[] }).nodes;

    expect(nodes.every((node) => node.type === "section")).toBe(true);
  });
});

describe("buildGathering — детермінованість", () => {
  it("двічі викликаний на тих самих пунктах дає той самий результат", () => {
    const points: ListPoint[] = [song(), sounding(), song(songDoc({ key: "G", bpm: 100 })), note()];

    const first = buildGathering(points as GatheringPoint[]);
    const second = buildGathering(points as GatheringPoint[]);

    expect(JSON.stringify(first.segments)).toEqual(JSON.stringify(second.segments));
    expect(JSON.stringify(first.items)).toEqual(JSON.stringify(second.items));
    expect(JSON.stringify([...first.tokens])).toEqual(JSON.stringify([...second.tokens]));
  });
});

describe("buildGathering — пункт і його токени", () => {
  it("кожен пункт знає своє місце в служінні, і місця не збігаються", () => {
    const items = buildGathering([song(), note(), sounding(), song()]).items;

    expect(items.map((item) => item.tokenKeyPrefix)).toEqual(["p0", "p1", "p2", "p3"]);
  });

  it("префікс пункту — той самий, з яким його токени їдуть по мережі", () => {
    const gathering = buildGathering([song(), song()]);

    gathering.items.forEach((item) => {
      const own = [...gathering.tokens.keys()].filter((key) =>
        key.startsWith(`${item.tokenKeyPrefix}:`),
      );
      expect(own).not.toHaveLength(0);
    });
  });
});

describe("sliceFromPoint — «грай звідси й до кінця служіння»", () => {
  // Примітка стоїть окремо від програша навмисно: так у черзі є і пункт без
  // жодного сегмента зі звуком, і пункт із трьох частин.
  const points = [song(), note(), song(), sounding(), song()];
  const all = buildGathering(points).segments;

  it("з першого пункту — це вся черга", () => {
    expect(sliceFromPoint(all, "p0")).toEqual(all);
  });

  it("з пункту посеред служіння — усе від нього й далі, ні шматка раніше", () => {
    expect(sliceFromPoint(all, "p3").map((s) => s.id)).toEqual([
      "p3:intro",
      "p3:loop",
      "p3:outro",
      "p4",
    ]);
  });

  it("пункт без токенів (примітка) теж є точкою старту", () => {
    expect(sliceFromPoint(all, "p1").map((s) => s.id)).toEqual([
      "p1:pause",
      "p2",
      "p3:intro",
      "p3:loop",
      "p3:outro",
      "p4",
    ]);
  });

  it("`p1` не впізнає `p10` — інакше старт з другого пункту грав би одинадцятий", () => {
    const long = buildGathering(Array.from({ length: 12 }, () => song())).segments;

    expect(sliceFromPoint(long, "p1")[0].id).toBe("p1");
    expect(sliceFromPoint(long, "p1")).toHaveLength(11);
  });

  it("невідомий пункт не грає нічого: у хоста інший список, і з початку йому не можна", () => {
    expect(sliceFromPoint(all, "p9")).toEqual([]);
  });
});
