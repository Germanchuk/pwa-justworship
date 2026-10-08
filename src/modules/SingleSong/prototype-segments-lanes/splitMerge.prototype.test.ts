/**
 * PROTOTYPE — питання №1–3 handoff-у ADR-0006 на справжньому Slate + @slate-yjs
 * (headless, два Y.Doc). Не тести продукту, а зафіксовані спостереження:
 * кожен `expect` описує те, ЩО Є, а не те, що мало б бути.
 *
 * Нотація: `G@seg1:4'о'` = акорд G стоїть у відрізку 1 над символом №4 «о»;
 * `''` — кінець рядка; `(ключ на seg1)` — ключ записаний на іншому відрізку,
 * ніж той, куди вказує позиція; `segnull` — позицію не вдалося знайти.
 */
import { describe, expect, it } from "vitest";
import {
  addChordOnSegment,
  addChordStored,
  backspaceAtStart,
  backspaceAtStartRemapped,
  chordsOnSegments,
  chordsStored,
  deleteRange,
  fmt,
  lyrics,
  makePair,
  pressEnter,
  removeSegment,
  segmentProps,
  setSegmentProps,
  typeAt,
} from "./harness";

//            0         1
//            012345678901234567
const LINE = "Ти святий, Господь";
// Am над «Т»(0), F над «с»(3), C над «Г»(11), G над «о»(15)
const CHORDS: [number, string][] = [
  [0, "Am"],
  [3, "F"],
  [11, "C"],
  [15, "G"],
];
const ORIGINAL = ["Am@seg0:0'Т'", "C@seg0:11'Г'", "F@seg0:3'с'", "G@seg0:15'о'"];

describe("як @slate-yjs пише split_node / merge_node", () => {
  it("Enter = скопіювати хвіст у НОВИЙ Y.XmlText і видалити його зі старого", () => {
    const { A } = makePair([LINE]);
    const before = A.root.toDelta()[0].insert;
    pressEnter(A, 0, 11);
    const [first, second] = A.root.toDelta().map((d: { insert: unknown }) => d.insert);
    expect(first).toBe(before); // перша половина — той самий Y-обʼєкт
    expect(second).not.toBe(before); // хвіст — новий обʼєкт, символи — копії
    expect(lyrics(A)).toEqual(["Ти святий, ", "Господь"]);
  });
});

describe("A: chord:<id> на відрізку (як записано в ADR-0006)", () => {
  it("Enter посеред слів: КОЖЕН ключ задвоюється, акорди хвоста зʼїжджають у кінець першої половини", () => {
    const { A, B } = makePair([LINE]);
    CHORDS.forEach(([o, n], i) => addChordOnSegment(A, 0, o, `c${i}`, n));
    expect(fmt(chordsOnSegments(B))).toEqual(ORIGINAL);

    pressEnter(A, 0, 11); // «Ти святий, |Господь»

    expect(lyrics(B)).toEqual(["Ти святий, ", "Господь"]);
    expect(fmt(chordsOnSegments(B))).toEqual([
      "Am@seg0:0'Т'",
      "Am@seg0:0'Т'(ключ на seg1)", // Slate копіює всі атрибути в нову половину
      "C@seg0:11''", // C і G — на точці розрізу, у ПЕРШІЙ половині
      "C@seg0:11''(ключ на seg1)",
      "F@seg0:3'с'",
      "F@seg0:3'с'(ключ на seg1)",
      "G@seg0:11''",
      "G@seg0:11''(ключ на seg1)",
    ]);
  });

  it("Enter + Backspace НЕ взаємно зворотні: G втрачає свій символ", () => {
    const { A, B } = makePair([LINE]);
    CHORDS.forEach(([o, n], i) => addChordOnSegment(A, 0, o, `c${i}`, n));
    pressEnter(A, 0, 11);
    backspaceAtStart(A, 1);
    expect(lyrics(B)).toEqual([LINE]);
    // дублікати зникли лише тому, що в обох половинах ті самі id;
    // C «повернувся» випадково (розріз якраз перед ним), G — ні
    expect(fmt(chordsOnSegments(B))).toEqual([
      "Am@seg0:0'Т'",
      "C@seg0:11'Г'",
      "F@seg0:3'с'",
      "G@seg0:11'Г'",
    ]);
  });

  it("решта атрибутів відрізка (динаміка, заголовок, кахон) так само копіюються в обидві половини", () => {
    const { A, B } = makePair([LINE]);
    setSegmentProps(A, 0, { dyn: 3, heading: true, "cajon:1.1": "B" });
    pressEnter(A, 0, 11);
    expect(segmentProps(B)).toEqual([
      { dyn: 3, heading: true, "cajon:1.1": "B" },
      { dyn: 3, heading: true, "cajon:1.1": "B" },
    ]);
  });
});

describe("B: stored position @slate-yjs (атрибут кореня, бібліотека переносить сама)", () => {
  it("Enter посеред слів: акорди хвоста переїжджають у новий відрізок на свої символи", () => {
    const { A, B } = makePair([LINE]);
    CHORDS.forEach(([o, n], i) => addChordStored(A, 0, o, `c${i}`, n));
    pressEnter(A, 0, 11);
    expect(fmt(chordsStored(B))).toEqual([
      "Am@seg0:0'Т'",
      "C@seg1:0'Г'",
      "F@seg0:3'с'",
      "G@seg1:4'о'",
    ]);
  });

  it("Backspace (злиття): акорди другого відрізка ГУБЛЯТЬСЯ — баг mergeNode у 1.0.2", () => {
    const { A, B } = makePair([LINE]);
    CHORDS.forEach(([o, n], i) => addChordStored(A, 0, o, `c${i}`, n));
    pressEnter(A, 0, 11);
    backspaceAtStart(A, 1);
    expect(fmt(chordsStored(B))).toEqual([
      "Am@seg0:0'Т'",
      "C@segnull:null'null'",
      "F@seg0:3'с'",
      "G@segnull:null'null'",
    ]);
  });

  it("…доказ, що це баг офсету: акорд, що стоїть далі за довжину першого відрізка, переноситься", () => {
    const { A, B } = makePair(["Ти", "святий Господь"]); // довжина першого = 2
    addChordStored(A, 1, 1, "x", "D"); // «в» (1 < 2) — загубиться
    addChordStored(A, 1, 7, "y", "E"); // «Г» (7 ≥ 2) — переживе
    backspaceAtStart(A, 1);
    expect(lyrics(B)).toEqual(["Тисвятий Господь"]);
    expect(fmt(chordsStored(B))).toEqual(["D@segnull:null'null'", "E@seg0:9'Г'"]);
  });

  it("з власним переносом при злитті Enter + Backspace взаємно зворотні", () => {
    const { A, B } = makePair([LINE]);
    CHORDS.forEach(([o, n], i) => addChordStored(A, 0, o, `c${i}`, n));
    pressEnter(A, 0, 11);
    backspaceAtStartRemapped(A, 1);
    expect(lyrics(B)).toEqual([LINE]);
    expect(fmt(chordsStored(B))).toEqual(ORIGINAL);
  });
});

describe("конкурентно: Enter у A, поки B (офлайн) пише в хвіст", () => {
  it("набране B в хвості опиняється в кінці ПЕРШОЇ половини", () => {
    const net = makePair([LINE]);
    const { A, B } = net;
    net.unlink();
    pressEnter(A, 0, 11);
    typeAt(B, 0, 14, "Х"); // B вставляє посеред «Господь»: «Гос|Хподь»
    net.link();
    expect(lyrics(A)).toEqual(lyrics(B));
    expect(lyrics(A)).toEqual(["Ти святий, Х", "Господь"]);
  });

  it("акорд, який B ставить у хвіст, так само падає на точку розрізу (обидва способи)", () => {
    const net = makePair([LINE]);
    const { A, B } = net;
    net.unlink();
    pressEnter(A, 0, 11);
    addChordStored(B, 0, 13, "s", "Dm"); // над «с» у «Господь»
    addChordOnSegment(B, 0, 13, "k", "Em");
    net.link();
    expect(fmt(chordsStored(A))).toEqual(["Dm@seg0:11''"]);
    // ключ спосіб A ставив на відрізок 0 у B — лишився там же, позиція на розрізі
    expect(fmt(chordsOnSegments(A)).filter((s) => s.startsWith("Em"))).toEqual(["Em@seg0:11''"]);
  });
});

describe("інші конкурентні сценарії", () => {
  it("видалення символу під акордом — акорд переїжджає на наступний, не зникає", () => {
    const { A, B } = makePair([LINE]);
    addChordStored(A, 0, 11, "c", "C");
    addChordOnSegment(A, 0, 11, "k", "C");
    deleteRange(B, 0, 11, 12); // B стирає «Г»
    expect(fmt(chordsStored(A))).toEqual(["C@seg0:11'о'"]);
    expect(fmt(chordsOnSegments(A))).toEqual(["C@seg0:11'о'"]);
  });

  it("видалення відрізка, поки інший у ньому пише: видалення перемагає, набране зникає", () => {
    const net = makePair(["Перший рядок", LINE]);
    const { A, B } = net;
    addChordStored(A, 1, 3, "c", "F");
    net.unlink();
    removeSegment(A, 1);
    typeAt(B, 1, 18, " навіки");
    net.link();
    expect(lyrics(A)).toEqual(["Перший рядок"]);
    expect(lyrics(B)).toEqual(["Перший рядок"]);
    expect(fmt(chordsStored(A))).toEqual(["F@segnull:null'null'"]); // ключ-сирота лишається
  });

  it("двоє одночасно «створюють» одну клітинку кахону — одна перемагає, нічого не двоїться", () => {
    const net = makePair([LINE]);
    const { A, B } = net;
    net.unlink();
    setSegmentProps(A, 0, { "cajon:1.1": "B" });
    setSegmentProps(B, 0, { "cajon:1.1": "t", "cajon:1.3": "t" });
    net.link();
    expect(segmentProps(A)).toEqual(segmentProps(B));
    expect(Object.keys(segmentProps(A)[0]).sort()).toEqual(["cajon:1.1", "cajon:1.3"]);
  });

  it("різні доріжки одного відрізка паралельно (слова в A, акорд і динаміка в B) — усе зливається", () => {
    const net = makePair([LINE]);
    const { A, B } = net;
    net.unlink();
    typeAt(A, 0, 0, "О, ");
    addChordOnSegment(B, 0, 3, "f", "F");
    setSegmentProps(B, 0, { dyn: 2 });
    net.link();
    expect(lyrics(A)).toEqual(["О, Ти святий, Господь"]);
    expect(fmt(chordsOnSegments(A))).toEqual(["F@seg0:6'с'"]);
    expect(segmentProps(A)).toEqual([{ dyn: 2 }]);
  });
});
