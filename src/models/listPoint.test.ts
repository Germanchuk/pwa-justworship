import { describe, expect, it } from "vitest";

import {
  SOUNDING_NOTE_TEXT,
  dropEmptyNotes,
  fromApi,
  makeNotePoint,
  makeSoundingNote,
  numberSongs,
  toApi,
  type ListPoint,
} from "./listPoint";

/**
 * Межа з сервером — єдине місце, що знає про динамічну зону Strapi. Перевіряємо
 * саме її зовнішню поведінку: що приїхало з сервера — який union вийшов, і що
 * поїхало назад.
 *
 * Ключі пунктів живуть лише в пам'яті екрана й щоразу нові, тож порівнюємо
 * пункти без них.
 */
const withoutKeys = (points: ReadonlyArray<ListPoint>) =>
  points.map(({ key, ...rest }) => rest);

const songComponent = (id: number, name = "Пісня") => ({
  __component: "list.song-point",
  song: { id, name, key: "C", bpm: 80 },
});

describe("fromApi", () => {
  it("читає пісню разом зі знімком її даних", () => {
    expect(withoutKeys(fromApi([songComponent(7, "Великий Бог")]))).toEqual([
      { kind: "song", songId: 7, name: "Великий Бог", songKey: "C", bpm: 80 },
    ]);
  });

  it("розгортає реляцію, загорнуту REST-колекцією", () => {
    const raw = [
      {
        __component: "list.song-point",
        song: { data: { id: 3, attributes: { name: "Свят", key: "D", bpm: 72 } } },
      },
    ];

    expect(withoutKeys(fromApi(raw))).toEqual([
      { kind: "song", songId: 3, name: "Свят", songKey: "D", bpm: 72 },
    ]);
  });

  it("відсіює пісенний пункт, у якого пісню видалили з бібліотеки", () => {
    expect(fromApi([{ __component: "list.song-point", song: null }])).toEqual([]);
  });

  it("читає примітку разом з ознакою «звучить»", () => {
    const raw = [
      { __component: "list.note-point", text: "далі — молитва", sounding: false },
      { __component: "list.note-point", text: "поки збирають пожертву", sounding: true },
    ];

    expect(withoutKeys(fromApi(raw))).toEqual([
      { kind: "note", text: "далі — молитва", sounding: false },
      { kind: "note", text: "поки збирають пожертву", sounding: true },
    ]);
  });

  it("вважає примітку без ознаки беззвучною", () => {
    expect(withoutKeys(fromApi([{ __component: "list.note-point", text: "молитва" }]))).toEqual([
      { kind: "note", text: "молитва", sounding: false },
    ]);
  });

  it("читає старий компонент програша як примітку, що звучить", () => {
    expect(
      withoutKeys(fromApi([{ __component: "list.interlude-point", custom: null }]))
    ).toEqual([{ kind: "note", text: SOUNDING_NOTE_TEXT, sounding: true }]);
  });

  it("дає той самий union для обох форм програша", () => {
    const oldForm = fromApi([{ __component: "list.interlude-point", custom: null }]);
    const newForm = fromApi([
      { __component: "list.note-point", text: SOUNDING_NOTE_TEXT, sounding: true },
    ]);

    expect(withoutKeys(oldForm)).toEqual(withoutKeys(newForm));
  });

  it("зберігає порядок пунктів, змішуючи обидві форми", () => {
    const raw = [
      songComponent(1, "Перша"),
      { __component: "list.interlude-point", custom: null },
      songComponent(2, "Друга"),
      { __component: "list.note-point", text: "молитва", sounding: false },
      songComponent(3, "Третя"),
    ];

    expect(fromApi(raw).map((point) => (point.kind === "song" ? point.name : point.text))).toEqual([
      "Перша",
      SOUNDING_NOTE_TEXT,
      "Друга",
      "молитва",
      "Третя",
    ]);
  });

  it("не пропускає порожню примітку", () => {
    const raw = [
      { __component: "list.note-point", text: "" },
      { __component: "list.note-point", text: "   " },
      { __component: "list.note-point" },
      songComponent(1, "Єдина"),
    ];

    expect(withoutKeys(fromApi(raw))).toEqual([
      { kind: "song", songId: 1, name: "Єдина", songKey: "C", bpm: 80 },
    ]);
  });

  it("дає різні ключі однаковим пунктам — та сама пісня може стояти двічі", () => {
    const points = fromApi([songComponent(1), songComponent(1)]);

    expect(points[0].key).not.toBe(points[1].key);
  });

  it("порожня або невідома зона дає порожній список", () => {
    expect(fromApi(null)).toEqual([]);
    expect(fromApi([])).toEqual([]);
    expect(fromApi([{ __component: "list.something-else" }])).toEqual([]);
  });
});

describe("toApi", () => {
  it("шле примітку разом з ознакою «звучить»", () => {
    expect(toApi([makeNotePoint("молитва"), makeSoundingNote()])).toEqual([
      { __component: "list.note-point", text: "молитва", sounding: false },
      { __component: "list.note-point", text: SOUNDING_NOTE_TEXT, sounding: true },
    ]);
  });

  it("шле пісню самим посиланням", () => {
    expect(toApi(fromApi([songComponent(9)]))).toEqual([
      { __component: "list.song-point", song: 9 },
    ]);
  });

  it("не шле порожню примітку — на сервері такої не буває", () => {
    expect(toApi([makeNotePoint(""), makeNotePoint("   "), makeNotePoint(" молитва ")])).toEqual([
      { __component: "list.note-point", text: "молитва", sounding: false },
    ]);
  });

  it("після читання й запису ознака «звучить» лишається на місці", () => {
    const raw = [
      songComponent(1, "Перша"),
      { __component: "list.interlude-point", custom: null },
      { __component: "list.note-point", text: "молитва", sounding: false },
    ];

    expect(toApi(fromApi(raw))).toEqual([
      { __component: "list.song-point", song: 1 },
      { __component: "list.note-point", text: SOUNDING_NOTE_TEXT, sounding: true },
      { __component: "list.note-point", text: "молитва", sounding: false },
    ]);
  });
});

describe("dropEmptyNotes", () => {
  it("прибирає недописані примітки й підрізає решту", () => {
    const points = [
      makeNotePoint(""),
      makeNotePoint("   "),
      makeNotePoint(" молитва "),
      makeSoundingNote(),
    ];

    expect(dropEmptyNotes(points).map((point) => point.kind === "note" && point.text)).toEqual([
      "молитва",
      SOUNDING_NOTE_TEXT,
    ]);
  });

  it("пісень не чіпає — порожньою пісня не буває", () => {
    const points = fromApi([songComponent(1), songComponent(2)]);

    expect(dropEmptyNotes(points)).toEqual(points);
  });
});

describe("makeSoundingNote", () => {
  it("додана як програш примітка одразу має текст і звучить", () => {
    const point = makeSoundingNote();

    expect(point.kind).toBe("note");
    expect(point.text).toBe(SOUNDING_NOTE_TEXT);
    expect(point.sounding).toBe(true);
  });
});

describe("numberSongs", () => {
  it("рахує пісні, а не пункти — примітки нумерацію не зсувають", () => {
    const points = fromApi([
      songComponent(1),
      { __component: "list.note-point", text: "молитва" },
      songComponent(2),
      { __component: "list.interlude-point", custom: null },
      songComponent(3),
    ]);

    expect(numberSongs(points)).toEqual([1, null, 2, null, 3]);
  });
});
