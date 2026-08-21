import { describe, expect, it } from "vitest";
import type { Descendant } from "slate";

import { makeSongPoint, makeSoundingNote } from "#models/listPoint";
import {
  createQueueState,
  pullPasses,
  requestExit,
} from "#modules/SingleSong/services/ChordsProgressionPlayer/segments/queue";
import { progressionBeats } from "#modules/SingleSong/services/ChordsProgressionPlayer/segments/model";
import { planPass } from "#modules/SingleSong/services/ChordsProgressionPlayer/segments/planPass";
import {
  planTempoTransition,
  type TempoState,
} from "#modules/SingleSong/services/ChordsProgressionPlayer/segments/tempoTransition";
import { buildGathering, sliceFrom, type GatheringPoint } from "./buildGathering";

/**
 * ЗІБРАННЯ НА ХОДУ — стик збірки й черги.
 *
 * `buildGathering.test.ts` перевіряє, ЩО зібрано; `queue.test.ts` — як рулон
 * поводиться з довільними сегментами. Програш живе рівно між ними: три його
 * частини мають не лише зібратись у правильному порядку, а й стати одна за
 * одною в потрібні імпульси й перевести темп на потрібній межі. Окремо кожен
 * із тих двох файлів лишався б зеленим, навіть якби темп на межі вступ→луп не
 * мінявся зовсім, — тому цей стик має власний файл.
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

const song = (doc: Descendant[]): GatheringPoint => ({
  ...makeSongPoint({ id: 1, name: "Пісня" }),
  slate: doc,
});

const prev = () => song(songDoc({ key: "C", bpm: 80, lines: ["| C | G |"] }));
const next = (over: Parameters<typeof songDoc>[0] = {}) =>
  song(songDoc({ key: "G", bpm: 100, lines: ["| G | D |"], ...over }));
const sounding = (): GatheringPoint => makeSoundingNote();

/** Хто, коли й на якому імпульсі: рулон, доллятий на `horizon` уперед. */
const roll = (points: GatheringPoint[], horizon: number) => {
  const { segments } = buildGathering(points);
  const { passes, state } = pullPasses(createQueueState(segments), 0, horizon);
  return { passes: passes.map((p) => [p.segment.id, p.startBeats] as const), state };
};

/**
 * Що транспорт робить на межі кожного сегмента зібрання, якщо пройти чергу
 * підряд.
 *
 * ⚠️ Проходимо рівно ті сегменти, що дають ПРОХІД: темп плеєр чіпає тільки в
 * `applySegmentTransition`, а той кличеться на прохід. `pullPasses` мовчки
 * минає два види сегментів — паузу й будь-який нульової довжини (пісня без
 * розмічених тактів — саме такий, і таких у базі багато, `04`). Ходи цей
 * хелпер по них — він вів би темп звідти, звідки плеєр його не веде, і брехав
 * би саме на тому шві, заради якого написаний.
 */
const tempoWalk = (points: GatheringPoint[]) => {
  let tempo: TempoState | null = null;
  return buildGathering(points)
    .segments.filter((s) => s.kind !== "pause" && progressionBeats(s.progression) > 0)
    .map((s) => {
      const { barBeats, bpm, rampSeconds } = planTempoTransition(tempo, s);
      tempo = { bpm: s.bpm, timeSignature: s.timeSignature };
      return { id: s.id, barBeats, bpm, rampSeconds };
    });
};

describe("програш у черзі — межі трьох сегментів", () => {
  it("вступ → луп → вихід ідуть підряд, кожен рівно з межі попереднього", () => {
    // Пісня 2 такти (8), вступ 2 такти (8), луп 2 такти (8), вихід 1 такт (4).
    const { passes } = roll([prev(), sounding(), next()], 24);

    expect(passes).toEqual([
      ["p0", 0],
      ["p1:intro", 8],
      ["p1:loop", 16],
    ]);
  });

  it("луп крутиться далі сам — черга не йде у вихід без прохання", () => {
    const { passes, state } = roll([prev(), sounding(), next()], 40);

    expect(passes.filter(([id]) => id === "p1:loop")).toHaveLength(3);
    expect(passes.some(([id]) => id === "p1:outro")).toBe(false);
    expect(state.finished).toBe(false);
  });

  it("«продовжити» пускає вихід рівно з межі кола, а не посеред нього", () => {
    const { segments } = buildGathering([prev(), sounding(), next()]);
    const first = pullPasses(createQueueState(segments), 0, 24);
    // Долито по луп включно: пісня 0–8, вступ 8–16, коло лупа 16–24.
    expect(first.state.cursorBeats).toBe(24);

    const second = pullPasses(requestExit(first.state), 16, 24);

    expect(second.passes.map((p) => [p.segment.id, p.startBeats])).toEqual([
      ["p1:outro", 24],
      ["p2", 28],
    ]);
    expect(second.state.finished).toBe(true);
  });
});

describe("програш у черзі — темп і розмір на межі вступ→луп", () => {
  it("тональність, розмір і темп міняються РАЗОМ і рівно на цій межі", () => {
    // Вступ лишається в 4/4@80 попередньої пісні, луп уже в 3/4@100 наступної.
    const plans = tempoWalk([prev(), sounding(), next({ timeSignature: "3/4" })]);

    expect(plans.map(({ id, barBeats, bpm }) => ({ id, barBeats, bpm }))).toEqual([
      { id: "p0", barBeats: 4, bpm: 80 },
      { id: "p1:intro", barBeats: 4, bpm: 80 },
      { id: "p1:loop", barBeats: 3, bpm: 100 },
      { id: "p1:outro", barBeats: 3, bpm: 100 },
      { id: "p2", barBeats: 3, bpm: 100 },
    ]);
    // Ведеться рівно один перехід — той самий, на якому все й міняється.
    expect(plans.filter((p) => p.rampSeconds > 0).map((p) => p.id)).toEqual(["p1:loop"]);
  });

  it("однакові знаменники — темп веде до наступної пісні за один прохід лупа", () => {
    const loop = tempoWalk([prev(), sounding(), next()]).find((p) => p.id === "p1:loop")!;

    // Луп — 2 такти по 4 імпульси; 80 → 100 дає середні 90 імпульсів/хв, тобто
    // 8 × 60 / 90 секунд. Стільки ж триває саме коло — «за один прохід».
    expect(loop.rampSeconds).toBeCloseTo((8 * 60) / 90, 6);
  });

  it("німа пісня темпу не веде — плеєр її проминає, і вести від неї нема чого", () => {
    // Акорди без тактових рисок прогресії не дають, тож черга такий сегмент
    // мовчки минає. Але СУСІДОМ програша ця пісня лишається: вступ бере її
    // темп із шапки (`03`), хоч сама вона й не звучала.
    const mute = song(songDoc({ key: "A", bpm: 140, lines: ["Am  F  C"] }));
    const plans = tempoWalk([prev(), mute, sounding(), next()]);

    // Німої пісні в ряду немає — вона не дала проходу.
    expect(plans.map((p) => p.id)).toEqual(["p0", "p2:intro", "p2:loop", "p2:outro", "p3"]);
    // Вступ усе одно стоїть у темпі сусіда, а не тієї пісні, що справді звучала.
    expect(plans.find((p) => p.id === "p2:intro")).toMatchObject({ bpm: 140, rampSeconds: 0 });
  });

  it("різні знаменники — стрибок на тій самій межі й жодного рампу", () => {
    const plans = tempoWalk([prev(), sounding(), next({ timeSignature: "6/8", bpm: 168 })]);

    // Розмір і темп однаково стають новими на межі вступ→луп — міняється лише
    // спосіб: не ведення, а чистий злам.
    expect(plans.find((p) => p.id === "p1:loop")).toEqual({
      id: "p1:loop",
      barBeats: 6,
      bpm: 168,
      rampSeconds: 0,
    });
    expect(plans.every((p) => p.rampSeconds === 0)).toBe(true);
  });
});

describe("старт із акорда — чи грає далі за планом", () => {
  /**
   * Обрізаний сегмент — усе ще сегмент: рулон мусить пройти його й піти далі
   * тим самим планом. Окремо `buildGathering.test.ts` перевіряє, ЩО відрізано,
   * а `queue.test.ts` — як черга ходить; розійтись вони можуть саме тут, на
   * зсунутих межах.
   */
  const points = [
    song(songDoc({ key: "C", bpm: 80, lines: ["| C | G | Am | F |"] })),
    sounding(),
    next(),
  ];
  const gathering = buildGathering(points);

  it("перший сегмент коротшає рівно на пропущене, а межі далі йдуть від нього", () => {
    // Стартуємо з третього такту першої пісні: лишається 2 такти (8 імпульсів),
    // далі вступ (2 такти) і луп — усе за планом, просто на такт ближче.
    const queue = sliceFrom(gathering, "p0:0:0:5");
    const { passes } = pullPasses(createQueueState(queue), 0, 24);

    expect(passes.map((p) => [p.segment.id, p.startBeats])).toEqual([
      ["p0", 0],
      ["p1:intro", 8],
      ["p1:loop", 16],
    ]);
  });

  it("голка починає саме з того акорда, по якому тапнули — і з його ознакою пункту", () => {
    const pass = planPass(sliceFrom(gathering, "p0:0:0:5")[0], 0);

    expect(pass.chords.map((chord) => chord.chord)).toEqual(["Am", "F"]);
    // Ознака пункту на місці: саме нею голка знаходить свою пісню на екрані.
    expect(pass.chords[0].tokenKey).toBe("p0:0:0:5");
    expect(pass.lengthBeats).toBe(8);
  });

  it("тап у лупі програша лишає програш цілим колом — і крутить його далі", () => {
    const queue = sliceFrom(gathering, "p1:0:1:3");
    const { passes, state } = pullPasses(createQueueState(queue), 0, 24);

    // Коло за колом, від нуля: обрізаний луп ішов би коротшим КОЖНЕ коло.
    expect(passes.map((p) => [p.segment.id, p.startBeats])).toEqual([
      ["p1:loop", 0],
      ["p1:loop", 8],
      ["p1:loop", 16],
    ]);
    expect(state.finished).toBe(false);
  });
});
