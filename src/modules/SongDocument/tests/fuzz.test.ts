/**
 * Випадкові правки двох учасників через видимі дерева — перевірка мідлвера.
 * Після кожної дії видиме дерево кожного має точно збігатися з проєкцією
 * його моделі (як після перезапуску), а після зустрічі мережі моделі однакові.
 * Зерно в назві тесту — щоб відтворити падіння.
 */
import { describe, expect, it } from "vitest";
import { Editor, Node, Point, Transforms } from "slate";
import { createLaneView, LaneDisplay, LaneView } from "../bridge/laneView";
import { layout } from "../model";
import { ALL, CHORDS, doc, NONE, setup, shown, WORDS, deleteSelection } from "./testKit";

const SONG = [
  { words: "/Куплет" },
  { words: "Ти святий, Господь", chords: "Am F       C   G" },
  { words: "Твоє світло серед ночі", chords: "F    C      G     Am" },
  { words: "" },
  { words: "Алилуя", chords: "F G" },
];
const DISPLAYS = [ALL, ALL, WORDS, CHORDS, NONE];
const TEXTS = ["а", "Ми ", "/", "Am ", "x", "  ", "/Міст"];
const PASTES = ["рядок\nще рядок", "\n", "Dm\nC", "/Приспів\n"];

/** Детермінований генератор (mulberry32). */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomPoint(h: LaneView, r: () => number): Point | null {
  const lanes = Array.from(Node.texts(h.view));
  if (!lanes.length) return null;
  const [text, path] = lanes[Math.floor(r() * lanes.length)];
  return { path, offset: Math.floor(r() * (text.text.length + 1)) };
}

const clipboard = (text: string) => ({ getData: (t: string) => (t === "text/plain" ? text : "") }) as DataTransfer;

function act(h: LaneView, r: () => number, withUndo: boolean) {
  const anchor = randomPoint(h, r);
  if (!anchor) return "нічого";
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const roll = r();
  Transforms.select(h.view, anchor);
  if (roll < 0.3) {
    const text = pick(TEXTS);
    Editor.insertText(h.view, text);
    return `друк «${text}» @${JSON.stringify(anchor)}`;
  }
  if (roll < 0.45) {
    Editor.insertBreak(h.view);
    return `Enter @${JSON.stringify(anchor)}`;
  }
  if (roll < 0.6) {
    Editor.deleteBackward(h.view);
    return `Backspace @${JSON.stringify(anchor)}`;
  }
  if (roll < 0.68) {
    Editor.deleteForward(h.view);
    return `Delete @${JSON.stringify(anchor)}`;
  }
  if (roll < 0.8) {
    const focus = randomPoint(h, r)!;
    Transforms.select(h.view, { anchor, focus });
    deleteSelection(h);
    return `стерти ${JSON.stringify(anchor)}…${JSON.stringify(focus)}`;
  }
  if (roll < 0.86) {
    const text = pick(PASTES);
    h.view.insertData(clipboard(text));
    return `вставка ${JSON.stringify(text)} @${JSON.stringify(anchor)}`;
  }
  if (!withUndo) return "нічого";
  const history = h.view as unknown as { undo: () => void; redo: () => void };
  if (roll < 0.93) {
    history.undo();
    return "undo";
  }
  history.redo();
  return "redo";
}

function fuzz(seed: number, withUndo: boolean) {
  const STEPS = 40;
  const known = withUndo && YJS_UNDO_BUG.has(seed);
  const r = rng(seed);
  const dA = DISPLAYS[Math.floor(r() * DISPLAYS.length)];
  const dB = DISPLAYS[Math.floor(r() * DISPLAYS.length)];
  const { net, A, B } = setup(SONG, dA, dB);
  const log: string[] = [];
  const check = (who: "A" | "B", h: LaneView, d: LaneDisplay) => {
    const fresh = createLaneView(net[who], d);
    try {
      expect(shown(h), `${who} розійшовся з моделлю після:\n${log.join("\n")}`).toEqual(shown(fresh));
      expect(layout(net[who])[0]?.at, "перший символ тексту — маркер").toBe(0);
    } finally {
      fresh.destroy();
    }
  };
  for (let step = 0; step < STEPS; step++) {
    if (r() < 0.15) {
      if (net.online) net.unlink();
      else net.link();
      log.push(net.online ? "мережа є" : "мережі немає");
    }
    const [who, h] = r() < 0.5 ? (["A", A] as const) : (["B", B] as const);
    log.push(`${who}: ${act(h, r, withUndo)}`);
    if (net.online && !known) expect(doc(net.A), `моделі розійшлися онлайн після:\n${log.join("\n")}`).toEqual(doc(net.B));
    check("A", A, dA);
    check("B", B, dB);
  }
  net.link();
  check("A", A, dA);
  check("B", B, dB);
  if (!known) expect(doc(net.A), `моделі розійшлися після:\n${log.join("\n")}`).toEqual(doc(net.B));
  A.destroy();
  B.destroy();
}

const SEEDS = Number(process.env.FUZZ_SEEDS ?? 300);
/**
 * Зерна, де моделі розходяться через ваду Yjs в undo вкладених типів
 * (`yjsUndoBug.test.ts`). Видиме дерево й там мусить збігатися зі своєю моделлю.
 */
const YJS_UNDO_BUG = new Set([112]);

describe("випадкові правки двох учасників (без undo)", () => {
  for (let seed = 1; seed <= SEEDS; seed++) it(`зерно ${seed}`, () => fuzz(seed, false));
});

describe("випадкові правки двох учасників (з undo/redo)", () => {
  for (let seed = 1; seed <= SEEDS; seed++) it(`зерно ${seed}`, () => fuzz(seed, true));
});
