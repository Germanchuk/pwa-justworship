/** Програвання доріжок (ADR-0009): що звучить у рядку і коли. */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { change, makePair } from "./harness";
import { addLane, linesOf, setLineLength } from "../model";
import { linePlan, nextLine, tickSeconds } from "../playback/timeline";

const cellsAt = (net: ReturnType<typeof makePair>, ln: number, id: string) => (linesOf(net.A)[ln].get(id) as Y.Map<unknown>).get("cells") as Y.Map<string>;

function song(seed = [{ words: "Ти святий" }, { words: "" }, { words: "/Приспів" }, { words: "Господь" }]) {
  const net = makePair(seed);
  const ids = { tab: "", cajon: "", blocks: "" };
  change(net.A, () => {
    ids.tab = addLane(net.A, "tab", linesOf(net.A));
    ids.cajon = addLane(net.A, "cajon", linesOf(net.A));
    ids.blocks = addLane(net.A, "blocks", linesOf(net.A));
  });
  return { net, ...ids };
}

describe("програвання: що звучить у рядку", () => {
  it("таби, кахон і прямокутники — за часом; акорд — до наступного або до кінця такту", () => {
    const { net, tab, cajon, blocks } = song();
    change(net.A, () => {
      setLineLength(linesOf(net.A)[0], 16); // два такти
      cellsAt(net, 0, tab).set("1.25/6", "3"); // друга шістнадцята, низька E
      cellsAt(net, 0, tab).set("1.49/1", "x");
      cellsAt(net, 0, cajon).set("1.1/1", "o");
      cellsAt(net, 0, cajon).set("1.97/3", "o");
      ["1.1", "1.2", "1.3"].forEach((k, i) => cellsAt(net, 0, blocks).set(k, i ? "-" : "Am"));
      cellsAt(net, 0, blocks).set("1.9", "F");
      cellsAt(net, 0, blocks).set("2.1", "G");
    });
    const plan = linePlan(net.B, 0, [])!;
    expect(plan.length).toBe(768);
    expect(plan.hits.map(({ lane, ...h }) => ({ lane: lane === tab ? "tab" : lane === cajon ? "cajon" : "blocks", ...h }))).toEqual([
      { lane: "cajon", tick: 0, kind: "cajon", hit: "B" },
      { lane: "blocks", tick: 0, kind: "chord", name: "Am", length: 192 }, // до F
      { lane: "tab", tick: 24, kind: "tab", string: 6, fret: 3 },
      { lane: "tab", tick: 48, kind: "tab", string: 1, fret: "x" },
      { lane: "cajon", tick: 96, kind: "cajon", hit: "g" },
      { lane: "blocks", tick: 192, kind: "chord", name: "F", length: 192 }, // до кінця такту
      { lane: "blocks", tick: 384, kind: "chord", name: "G", length: 384 },
    ]);
  });

  it("сховане людиною не звучить; записане за кінцем рядка — теж", () => {
    const { net, tab, cajon } = song();
    change(net.A, () => {
      cellsAt(net, 0, tab).set("1.1/1", "0");
      cellsAt(net, 0, cajon).set("1.1/1", "o");
      cellsAt(net, 0, cajon).set("2.1/1", "o");
      setLineLength(linesOf(net.A)[0], 8); // рядок вкоротили до такту: другий такт схований
    });
    expect(linePlan(net.B, 0, [tab])!.hits.map((h) => h.kind)).toEqual(["cajon"]);
  });

  it("порожній відрізок — такт тиші; порожній рядок і структурна примітка часу не займають", () => {
    const { net } = song();
    expect(linePlan(net.B, 0, [])).toEqual({ length: 384, hits: [] });
    expect(linePlan(net.B, 1, [])).toBe(null);
    expect(linePlan(net.B, 2, [])).toBe(null);
    expect(nextLine(net.B, 0, [])).toEqual({ line: 3, from: 0, to: 384 });
    expect(nextLine(net.B, 3, [])).toBe(null);
  });

  it("тік у секундах: BPM рахує долю розміру, темп — у відсотках", () => {
    expect(tickSeconds(120, "4/4", 100) * 384).toBeCloseTo(2); // ціла нота — чотири чверті по 0.5 с
    expect(tickSeconds(120, "4/4", 50) * 384).toBeCloseTo(4);
    expect(tickSeconds(180, "6/8", 100) * 48).toBeCloseTo(1 / 3); // вісімка при 180 вісімок на хвилину
  });

  it("правка рядка видна в наступному плані — двигун читає пісню наперед", () => {
    const { net, tab } = song();
    expect(linePlan(net.B, 3, [])!.hits).toEqual([]);
    change(net.A, () => cellsAt(net, 3, tab).set("1.1/2", "1"));
    expect(linePlan(net.B, 3, [])!.hits).toHaveLength(1);
  });
});

