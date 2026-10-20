/** Динаміка рядка: спільний і особистий колір, Enter і склеювання, одночасне фарбування, undo мазка. */
import { describe, expect, it } from "vitest";
import { dynamicsOf, eraseIn, layout, Line, linesOf, mergeLine, paintDynamics, shownDynamics, Song, splitLine } from "../model";
import { change, makePair } from "./harness";
import { at, setup, tick } from "./testKit";

const SEED = [{ words: "Ти святий" }, { words: "Господь" }, { words: "Алилуя" }];
const colors = (song: Song, layer: string | null = null) => linesOf(song).map((l) => dynamicsOf(l, layer));
const paint = (song: Song, lns: number[], key: Parameters<typeof paintDynamics>[2], layer: string | null = null) =>
  change(song, () => paintDynamics(song, lns.map((ln) => linesOf(song)[ln]), key, layer));

describe("динаміка — модель", () => {
  it("фарба спільна: Оля фарбує — Герман бачить той самий колір; гумка стирає", () => {
    const net = makePair(SEED);
    paint(net.A, [0, 1], "loud");
    expect(colors(net.B)).toEqual(["loud", "loud", null]);
    paint(net.B, [1], null);
    expect(colors(net.A)).toEqual(["loud", null, null]);
  });

  it("порожній рядок і /примітку мазок не фарбує — фарбує лише відрізки", () => {
    const net = makePair([{ words: "/Приспів" }, { words: "Алилуя" }, { words: "" }, { words: "Слава" }]);
    paint(net.A, [0, 1, 2, 3], "loud");
    expect(colors(net.B)).toEqual([null, "loud", null, "loud"]);
  });

  it("відрізок став порожнім — колір лишається в маркері, але його не видно", () => {
    const net = makePair([{ words: "Алилуя", dynamics: "loud" }]);
    change(net.A, () => eraseIn(net.A, 0, "words", 0, 6));
    expect(colors(net.A)).toEqual(["loud"]);
    expect(layout(net.A).map((l) => shownDynamics(l, null))).toEqual([null]);
  });

  it("Enter у пофарбованому рядку — обидві частини того самого кольору", () => {
    const net = makePair([{ words: "Ти святий", dynamics: "calm" }]);
    change(net.A, () => splitLine(net.A, { line: 0, lane: "words", offset: 3 }));
    expect(colors(net.B)).toEqual(["calm", "calm"]);
  });

  it("склеювання — лишається колір першого рядка", () => {
    const net = makePair([
      { words: "Ти святий", dynamics: "calm" },
      { words: "Господь", dynamics: "loud" },
    ]);
    change(net.A, () => mergeLine(net.A, 1));
    expect(colors(net.B)).toEqual(["calm"]);
  });

  it("без мережі обоє фарбують той самий рядок різним — сходяться в один колір; інші рядки кожного цілі", () => {
    const net = makePair(SEED);
    net.unlink();
    paint(net.A, [0, 1], "loud");
    paint(net.B, [1, 2], "calm");
    net.link();
    expect(colors(net.A)).toEqual(colors(net.B));
    expect(colors(net.A)[0]).toBe("loud");
    expect(colors(net.A)[2]).toBe("calm");
    expect(["loud", "calm"]).toContain(colors(net.A)[1]);
  });

  it("мазок по рядку, який тим часом склеїли, — рядка вже немає, фарба його пропускає", () => {
    const net = makePair(SEED);
    const stroke: Line[] = linesOf(net.A).slice(1, 3);
    change(net.B, () => mergeLine(net.B, 1));
    change(net.A, () => paintDynamics(net.A, stroke, "active"));
    expect(colors(net.A)).toEqual([null, "active"]);
    expect(colors(net.B)).toEqual(colors(net.A));
  });
});

describe("динаміка — особиста", () => {
  it("особиста — окремий шар: спільну не чіпає, в інших людей порожня", () => {
    const net = makePair(SEED);
    paint(net.A, [0, 1], "loud");
    paint(net.B, [1], "calm", "Оля");
    const shown = (layer: string | null) => layout(net.A).map((l) => shownDynamics(l, layer));
    expect(shown("Оля")).toEqual([null, "calm", null]);
    expect(shown("Герман")).toEqual([null, null, null]);
    expect(shown(null)).toEqual(["loud", "loud", null]);
  });

  it("гумка в особистому шарі стирає лише своє — спільне на місці", () => {
    const net = makePair(SEED);
    paint(net.A, [0], "loud");
    paint(net.A, [0], "calm", "Оля");
    paint(net.A, [0], null, "Оля");
    expect(shownDynamics(layout(net.B)[0], "Оля")).toBe(null);
    expect(shownDynamics(layout(net.B)[0])).toBe("loud");
  });

  it("Enter — особистий колір в обох частинах; склеювання — лишається колір першого", () => {
    const net = makePair([{ words: "Ти святий", dynamicsBy: { Оля: "calm" } }, { words: "Господь", dynamicsBy: { Оля: "loud" } }]);
    change(net.A, () => splitLine(net.A, { line: 0, lane: "words", offset: 3 }));
    expect(colors(net.B, "Оля")).toEqual(["calm", "calm", "loud"]);
    change(net.A, () => mergeLine(net.A, 2));
    expect(colors(net.B, "Оля")).toEqual(["calm", "calm"]);
  });

  it("двоє одночасно фарбують той самий рядок кожен для себе — обидва кольори цілі", () => {
    const net = makePair(SEED);
    net.unlink();
    paint(net.A, [0], "loud", "Герман");
    paint(net.B, [0], "calm", "Оля");
    net.link();
    expect(colors(net.A, "Герман")[0]).toBe("loud");
    expect(colors(net.A, "Оля")[0]).toBe("calm");
  });
});

describe("динаміка — місток", () => {
  it("мазок — один крок undo; undo і redo повертають фарбу", async () => {
    const { net, A } = setup(SEED);
    A.paint(linesOf(net.A), "loud");
    await tick();
    A.paint(linesOf(net.A).slice(0, 1), "calm");
    expect(colors(net.B)).toEqual(["calm", "loud", "loud"]);
    A.view.undo();
    expect(colors(net.B)).toEqual(["loud", "loud", "loud"]);
    A.view.undo();
    expect(colors(net.B)).toEqual([null, null, null]);
    A.view.redo();
    expect(colors(net.B)).toEqual(["loud", "loud", "loud"]);
  });

  it("мазок одразу після друку — окремий крок: undo знімає фарбу, а надруковане лишає", async () => {
    const { net, A } = setup(SEED);
    at(A, 0, 1, 0);
    A.view.insertText("О ");
    A.paint(linesOf(net.A), "loud");
    A.view.undo();
    expect(colors(net.A)).toEqual([null, null, null]);
    expect(linesOf(net.A).length).toBe(3);
    expect(A.view.children.length).toBe(3);
    await tick();
  });

  it("моє undo не знімає фарби Германа", () => {
    const { net, A, B } = setup(SEED);
    A.paint(linesOf(net.A).slice(0, 1), "loud");
    B.paint(linesOf(net.B).slice(1, 2), "calm");
    A.view.undo();
    expect(colors(net.B)).toEqual([null, "calm", null]);
  });
});
