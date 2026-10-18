/**
 * Примітки на доріжці рядка: позначки слів — позиції в спільному тексті
 * пісні, тож при Enter і склеюванні переїжджає лише запис. Акорди — у рядку
 * акордів свого рядка. `expect` фіксує те, ЩО Є.
 */
import { describe, expect, it } from "vitest";
import { Editor } from "slate";
import { change } from "./harness";
import { LaneView } from "../bridge/laneView";
import { addNote, ALL, LaneType, linesOf, notesOf, resolveNotes, Song } from "../model";
import { at, setup } from "./testKit";

const SONG = [
  //       0123456789012345678
  { words: "Ти святий, Господь", chords: "Am F       C   G" },
  { words: "Твоє світло серед ночі", chords: "F    C      G     Am" },
];

const note = (song: Song, ln: number, lane: LaneType, from: number, to: number, id: string, visibleFor = [ALL]) =>
  change(song, () => addNote(song, ln, lane, from, to, { id, author: "Оля", visibleFor, color: "#F5C518", body: id }));

/** Примітки коротко: доріжка, рядок картки, стан і що зараз позначено. */
const notes = (song: Song, audience: string[] = []) =>
  resolveNotes(song, audience, () => true).map((n) => ({
    id: n.note.id,
    status: n.status,
    at: n.at ? `${n.lane}@${n.at.line}:${n.at.from}-${n.at.to}` : `${n.lane}@${n.line}:втрачено`,
  }));

// З показом «усе» у відрізку доріжки у видимому: 0 — акорди, 1 — слова.
const enter = (h: LaneView, ln: number, offset: number) => {
  at(h, ln, 1, offset);
  Editor.insertBreak(h.view);
};
const backspace = (h: LaneView, ln: number) => {
  at(h, ln, 1, 0);
  Editor.deleteBackward(h.view);
};
const type = (h: LaneView, ln: number, lane: number, offset: number, text: string) => {
  at(h, ln, lane, offset);
  Editor.insertText(h.view, text);
};

describe("примітки при Enter і склеюванні", () => {
  it("примітка на хвості слів переїжджає з ним у новий рядок", () => {
    const { net, A } = setup(SONG);
    note(net.A, 0, "words", 11, 18, "тихо"); // «Господь»
    enter(A, 0, 11);
    expect(notes(net.B)).toEqual([{ id: "тихо", status: "visible", at: "words@1:0-7" }]);
    expect(notesOf(linesOf(net.B)[1], "words").has("тихо")).toBe(true);
  });

  it("примітка на голові слів лишається на першій частині", () => {
    const { net, A } = setup(SONG);
    note(net.A, 0, "words", 0, 2, "сильно"); // «Ти»
    enter(A, 0, 11);
    expect(notes(net.B)).toEqual([{ id: "сильно", status: "visible", at: "words@0:0-2" }]);
  });

  it("примітка акордів при Enter лишається на першій частині", () => {
    const { net, A } = setup(SONG);
    note(net.A, 0, "chords", 12, 16, "акорд"); // «C   »
    enter(A, 0, 3);
    expect(notes(net.B)).toEqual([{ id: "акорд", status: "visible", at: "chords@0:12-16" }]);
  });

  it("Enter посеред позначеного — позначка лишається першій частині й закінчується на розрізі", () => {
    const { net, A } = setup(SONG);
    note(net.A, 0, "words", 3, 18, "фраза"); // «святий, Господь»
    enter(A, 0, 11);
    expect(notes(net.B)).toEqual([{ id: "фраза", status: "visible", at: "words@0:3-11" }]);
  });

  it("Enter → Backspace — позначка знову на всьому, що була", () => {
    const { net, A } = setup(SONG);
    note(net.A, 0, "words", 3, 18, "фраза");
    enter(A, 0, 11);
    backspace(A, 1);
    expect(notes(net.B)).toEqual([{ id: "фраза", status: "visible", at: "words@0:3-18" }]);
  });

  it("склеювання: примітки другого рядка переїжджають; слова — ті самі символи, акорди — зсунуті", () => {
    const { net, A } = setup(SONG);
    note(net.A, 1, "words", 5, 11, "світло"); // «світло»
    note(net.A, 1, "chords", 5, 6, "C"); // «C»
    backspace(A, 1);
    // слова: 18 + 5…18 + 11; акорди: «Am F       C   G» (16) + 2 пробіли + 5
    expect(notes(net.B)).toEqual([
      { id: "C", status: "visible", at: "chords@0:23-24" },
      { id: "світло", status: "visible", at: "words@0:23-29" },
    ]);
  });

  it("дописане по краях позначки в неї не входить", () => {
    const { net, A } = setup(SONG);
    note(net.A, 0, "words", 11, 18, "Господь");
    type(A, 0, 1, 18, "!");
    type(A, 0, 1, 11, "о ");
    expect(notes(net.B)[0].at).toBe("words@0:13-20");
  });

  it("стерли все позначене — примітка втрачена, але лишається на своєму рядку", () => {
    const { net, A } = setup(SONG);
    note(net.A, 0, "words", 0, 2, "Ти");
    at(A, 0, 1, 2);
    Editor.deleteBackward(A.view);
    Editor.deleteBackward(A.view);
    expect(notes(net.B)).toEqual([{ id: "Ти", status: "lost", at: "words@0:втрачено" }]);
  });
});

describe("хто бачить примітку", () => {
  it("приватну бачить лише її адресат, адресну — кожен з адресатів, набір очей — спільне для всіх з набору, публічну — усі", () => {
    const { net } = setup(SONG);
    note(net.A, 0, "words", 0, 2, "своя", ["Оля"]);
    note(net.A, 0, "words", 3, 9, "адресна", ["Оля", "Герман"]);
    note(net.A, 1, "words", 0, 4, "усім");
    const ids = (...audience: string[]) => notes(net.B, audience).map((n) => n.id);
    expect(ids("Оля")).toEqual(["своя", "адресна", "усім"]);
    expect(ids("Герман")).toEqual(["адресна", "усім"]);
    expect(ids("Вова")).toEqual(["усім"]);
    expect(ids()).toEqual(["усім"]);
    expect(ids("Оля", "Герман")).toEqual(["адресна", "усім"]);
  });

  it("схована доріжка — схована її примітка", () => {
    const { net } = setup(SONG);
    note(net.A, 0, "chords", 0, 2, "Am");
    note(net.A, 0, "words", 0, 2, "Ти");
    const statuses = resolveNotes(net.B, [], (_, lane) => lane === "words").map((n) => `${n.note.id}:${n.status}`);
    expect(statuses).toEqual(["Am:hidden", "Ти:visible"]);
  });
});

describe("примітки конкурентно", () => {
  it("B позначає хвіст, поки A ділить рядок, — картка над рядком, де тепер позначене", () => {
    const { net, A } = setup(SONG);
    net.unlink();
    enter(A, 0, 11);
    note(net.B, 0, "words", 11, 18, "Господь");
    net.link();
    expect(notes(net.A)).toEqual([{ id: "Господь", status: "visible", at: "words@1:0-7" }]);
    expect(notes(net.B)).toEqual(notes(net.A));
  });

  it("B лишає примітку на рядку, який A в цю мить склеює, — примітка ЗНИКАЄ разом із маркером", () => {
    const { net, A } = setup(SONG);
    net.unlink();
    backspace(A, 1);
    note(net.B, 1, "words", 5, 11, "світло");
    net.link();
    expect(notes(net.A)).toEqual([]);
    expect(notes(net.B)).toEqual([]);
  });

  it("двоє одночасно додають різні примітки на той самий рядок — обидві цілі", () => {
    const { net } = setup(SONG);
    net.unlink();
    note(net.A, 0, "words", 0, 2, "перша");
    note(net.B, 0, "chords", 0, 2, "друга");
    net.link();
    expect(notes(net.A).map((n) => n.id).sort()).toEqual(["друга", "перша"]);
    expect(notes(net.B)).toEqual(notes(net.A));
  });
});
