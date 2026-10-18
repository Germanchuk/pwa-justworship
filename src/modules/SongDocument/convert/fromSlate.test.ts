import { describe, expect, it } from "vitest";
import {
  chordsString,
  dynamicsOf,
  layout,
  readCapo,
  readHiddenLanes,
  readMeta,
  resolveNotes,
  songOf,
} from "../model";
import { convertSong, OldNode, RowDecision } from "./fromSlate";

const t = (text: string, comment?: unknown[]) => (comment ? { text, comment } : { text });
const chords = (text: string): OldNode => ({ type: "chord-line", children: [t(text)] });
const words = (...leaves: OldNode[]): OldNode => ({ type: "line", children: leaves });
const empty: OldNode = { type: "empty-line", children: [t("")] };
const section = (children: OldNode[], extra: Record<string, unknown> = {}): OldNode => ({ type: "section", children, ...extra });

const header = (meta: Record<string, unknown> = {}, capo: Record<string, unknown> = {}): OldNode[] => [
  { type: "song-name", children: [t("Ти святий")] },
  {
    type: "song-meta-row",
    ...meta,
    children: [
      { type: "bpm", children: [t("72")] },
      { type: "time-signature", children: [t("6/8")] },
      { type: "song-key", keyValue: "D", children: [t("")] },
      { type: "capo", ...capo, children: [t("")] },
    ],
  },
];

const rows = (nodes: OldNode[], decisions?: RowDecision[]) => {
  const song = songOf(convertSong(nodes, decisions).doc);
  return layout(song).map((l) => `${chordsString(l.line)} / ${l.words}`);
};

describe("перенесення пісні зі старого документа", () => {
  it("шапка — у meta; капо й сховані доріжки — особисте", () => {
    const { doc } = convertSong([
      ...header({ chordsHiddenFor: ["Оля"], lyricsHiddenFor: ["Вова"] }, { valuesBy: { Оля: 2, Вова: 0 }, disabledFor: ["Оля"] }),
      section([words(t("Алилуя"))]),
    ]);
    expect(readMeta(doc)).toEqual({ name: "Ти святий", bpm: 72, timeSignature: "6/8", key: "D" });
    expect(readCapo(doc, "Оля")).toEqual({ fret: 2, off: true });
    expect(readCapo(doc, "Вова")).toEqual({ fret: 0, off: false });
    expect(readHiddenLanes(doc, "Оля")).toEqual(["chords"]);
    expect(readHiddenLanes(doc, "Вова")).toEqual(["words"]);
  });

  it("акорди беруть слова під собою; акорди без слів — рядок самих акордів; порожні між секціями лишаються", () => {
    const nodes = [
      ...header(),
      section([chords("Am  F"), words(t("Ти святий")), words(t("Господь")), chords("C G"), chords("Am")]),
      empty,
      section([chords("D"), words(t("Алилуя"))]),
    ];
    expect(rows(nodes)).toEqual([
      "Am  F / Ти святий",
      " / Господь",
      "C G / ",
      "Am / ",
      " / ",
      "D / Алилуя",
    ]);
  });

  it("повтор x2 — секцію прописано двічі через порожній рядок", () => {
    const nodes = [...header(), section([chords("G"), words(t("Слава"))], { repeat: 2 })];
    expect(rows(nodes)).toEqual(["G / Слава", " / ", "G / Слава"]);
  });

  it("ручні рішення: мітка → /…, мітка з акордами → /мітка і акорди окремим рядком, «слова»-акорди → акорди", () => {
    const nodes = [
      ...header(),
      section([words(t("Приспів:")), words(t("D   G   Hm")), words(t("Ти святий"))]),
      section([words(t("[CHORUS] G A Hm D")), words(t("Слава"))]),
    ];
    const decisions: RowDecision[] = [
      { sec: 1, row: 0, text: "Приспів:", as: "note", note: "/Приспів:" },
      { sec: 1, row: 1, text: "D   G   Hm", as: "chords" },
      { sec: 2, row: 0, text: "[CHORUS] G A Hm D", as: "note+chords", note: "/[CHORUS]", chords: "G A Hm D" },
    ];
    expect(rows(nodes, decisions)).toEqual([
      " / /Приспів:",
      "D   G   Hm / Ти святий",
      " / /[CHORUS]",
      "G A Hm D / ",
      " / Слава",
    ]);
  });

  it("рішення, текст якого вже інший (пісню правили), — зупиняє перенесення", () => {
    const nodes = [...header(), section([words(t("Приспів 2:"))])];
    expect(() => convertSong(nodes, [{ sec: 1, row: 0, text: "Приспів:", as: "note" }])).toThrow(/застаріло/);
  });

  it("динаміка секції — по її відрізках пропорційно; мітка й порожні не фарбуються", () => {
    const nodes = [
      ...header(),
      section([words(t("/Куплет")), words(t("раз")), words(t("два")), words(t("три")), words(t("чотири"))], {
        dynamicsSteps: ["calm", "loud"],
      }),
    ];
    const song = songOf(convertSong(nodes).doc);
    expect(layout(song).map((l) => dynamicsOf(l.line))).toEqual([null, "calm", "calm", "loud", "loud"]);
  });

  it("примітки: запис і колір зі старого; багаторядкова — до першого рядка; акорди+слова — лише слова; підсвітка без запису — порожній текст", () => {
    const mark = (commentId: string, visibleFor = ["Оля"]) => ({ commentId, visibleFor, color: "#F5C518", author: "gmann" });
    const nodes = [
      ...header({
        "note:n1": { body: "тихо", color: "#2196F3", visibleFor: ["Оля", "Вова"], author: "gmann" },
        "note:n2": { body: "разом", color: "strike", visibleFor: ["all"], author: "gmann" },
      }),
      section([
        chords("Am      F"),
        words(t("Ти "), t("святий", [mark("n1")]), t(" Господь")),
        { type: "chord-line", children: [t("C "), t("G", [mark("n2")])] },
        words(t("Твоє ", [mark("n2")]), t("світло", [mark("n2"), mark("h1")])),
        words(t("серед ночі", [mark("h1")])),
      ]),
    ];
    const song = songOf(convertSong(nodes).doc);
    const notes = resolveNotes(song, ["Оля"], () => true).map((n) => ({
      id: n.note.id,
      lane: n.lane,
      at: n.at && [n.at.line, n.at.from, n.at.to],
      body: n.note.body,
      color: n.note.color,
      visibleFor: n.note.visibleFor,
    }));
    expect(notes).toEqual([
      { id: "n1", lane: "words", at: [0, 3, 9], body: "тихо", color: "#2196F3", visibleFor: ["Оля", "Вова"] },
      { id: "n2", lane: "words", at: [1, 0, 11], body: "разом", color: "strike", visibleFor: ["all"] },
      { id: "h1", lane: "words", at: [1, 5, 11], body: "", color: "#F5C518", visibleFor: ["Оля"] },
    ]);
  });

  it("мітка, перетворена на /…, — позначка зсувається на «/»", () => {
    const nodes = [
      ...header({ "note:n1": { body: "голосно", color: "#2196F3", visibleFor: ["all"], author: "gmann" } }),
      section([words(t("  Приспів", [{ commentId: "n1" }]))]),
    ];
    const song = songOf(convertSong(nodes, [{ sec: 1, row: 0, text: "  Приспів", as: "note", note: "/Приспів" }]).doc);
    const [note] = resolveNotes(song, [], () => true);
    expect(note.at).toEqual({ line: 0, from: 1, to: 8 });
  });
});
