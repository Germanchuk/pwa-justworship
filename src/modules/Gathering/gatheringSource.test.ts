import { describe, expect, it } from "vitest";
import type { Descendant } from "slate";

import { gatheringFromApi } from "./gatheringSource";

const doc = (text: string): Descendant[] =>
  [{ type: "section", children: [{ type: "line", children: [{ text }] }] }] as unknown as Descendant[];

const songPoint = (id: number | null, slate: Descendant[] | null) => ({
  __component: "list.song-point",
  song: id == null ? null : { id, name: `Пісня ${id}` },
  slate,
});

const notePoint = (text: string, sounding = false) => ({
  __component: "list.note-point",
  text,
  sounding,
});

describe("gatheringFromApi", () => {
  it("вміст пісні зшивається по id, а не по місцю в ряду", () => {
    // Пісню першого пункту видалили з бібліотеки — межа його відсіює, і ряди
    // розʼїжджаються на один. По індексу другій пісні дістався б чужий текст.
    const list = gatheringFromApi({
      points: [songPoint(null, doc("сирота")), songPoint(5, doc("моя"))],
    });

    expect(list.points).toHaveLength(1);
    expect((list.points[0] as { slate?: Descendant[] }).slate).toEqual(doc("моя"));
  });

  it("та сама пісня двічі в служінні (реприза) отримує свій вміст обидва рази", () => {
    const list = gatheringFromApi({
      points: [songPoint(5, doc("моя")), notePoint("Молитва"), songPoint(5, doc("моя"))],
    });

    expect(list.points.map((point) => point.kind)).toEqual(["song", "note", "song"]);
    expect((list.points[2] as { slate?: Descendant[] }).slate).toEqual(doc("моя"));
  });

  it("примітка вмісту не має й не отримує", () => {
    const list = gatheringFromApi({ points: [notePoint("Програш", true)] });

    expect(list.points[0]).toMatchObject({ kind: "note", sounding: true });
    expect(list.points[0]).not.toHaveProperty("slate");
  });

  it("порожня відповідь — порожнє служіння, а не падіння", () => {
    expect(gatheringFromApi(null).points).toEqual([]);
    expect(gatheringFromApi({}).points).toEqual([]);
  });

  it("дата й підпис доїжджають як є — з них складається шапка екрана", () => {
    const list = gatheringFromApi({ date: "2026-08-23", title: "Ранкове", points: [] });

    expect(list).toMatchObject({ date: "2026-08-23", title: "Ранкове" });
  });
});
