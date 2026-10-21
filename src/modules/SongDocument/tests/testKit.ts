/** Спільне для тестів ядра: два учасники, у кожного своє видиме дерево. */
import { Editor, Element, Node, Transforms } from "slate";
import { docLines, makePair } from "./harness";
import { createLaneView, LaneDisplay, LaneView } from "../bridge/laneView";
import { chordsString, dynamicsOf, layout, LineInit, Song } from "../model";

export const ALL: LaneDisplay = { words: true, chords: true };
export const WORDS: LaneDisplay = { words: true, chords: false };
export const CHORDS: LaneDisplay = { words: false, chords: true };
export const NONE: LaneDisplay = { words: false, chords: false };

export function setup(seed: LineInit[], a: LaneDisplay = ALL, b: LaneDisplay = ALL) {
  const net = makePair(seed);
  return { net, A: createLaneView(net.A, a), B: createLaneView(net.B, b) };
}

/** Видиме дерево: рядок = доріжки через « | », тип доріжки — першою літерою. */
export const shown = (h: LaneView) =>
  h.view.children.map((l) =>
    (l as Element).children.map((c) => `${(c as unknown as { type: string }).type[0]}:${Node.string(c)}`).join(" | "),
  );

/** Документ рядками «акорди / слова». */
export const doc = (song: Song) => docLines(song);

/** Документ з динамікою — для перевірки атрибутів рядка. */
export const rows = (song: Song) =>
  layout(song).map((l) => ({ chords: chordsString(l.line), words: l.words, dynamics: dynamicsOf(l.line) }));

/** Поставити курсор у видимому дереві: рядок, доріжка (номер у видимому), символ. */
export const at = (h: LaneView, ln: number, lane: number, offset: number) =>
  Transforms.select(h.view, { path: [ln, lane, 0], offset });

/** Тік між діями — як між справжніми подіями введення. */
export const tick = () => new Promise((r) => setTimeout(r, 0));

/** Стерти виділене; через кілька рядків — ще й підтвердити попередження (`SONG-91`), як людина вдруге тисне Delete. */
export function deleteSelection(h: LaneView) {
  Editor.deleteFragment(h.view);
  if (h.removal.pending()?.kind === "range") h.removal.confirm();
}

/** Підтвердити попередження, якщо воно є (людина вдруге тисне ту саму клавішу). */
export function confirmed(h: LaneView) {
  if (h.removal.pending()) h.removal.confirm();
}
