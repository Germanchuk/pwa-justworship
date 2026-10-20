/**
 * Проєкція: який вигляд має рядок моделі у видимому дереві конкретної людини.
 * Лише вибрані доріжки; каркас (структурні примітки й порожні рядки) — завжди.
 *
 * Доріжки рядка у видимому — згори донизу (ADR-0008): додані клітинкові
 * (прямокутники, таби, кахон) — атомні вузли Slate, у які не друкують (їх
 * правитиме віджет); під ними акорди, найнижче — слова.
 */
import { Node } from "slate";
import { isTextKind, LANES, LaneType, laneOf, layout, Line, LineAt, lineKind, songLanes, Song } from "../model";
import type { ViewState } from "./state";

export type LaneDisplay = Readonly<Record<LaneType, boolean>> & {
  /** id доданих доріжок, яких людина не бачить. */
  hidden?: readonly string[];
};

/** Доріжка видимого рядка: `words`, `chords` або id клітинкової доріжки. */
export type ViewLane = string;
export const isTextLane = (lane: ViewLane): lane is LaneType => lane === "words" || lane === "chords";

/** Рядок видимого дерева: який маркер він показує і які доріжки. */
export type Source = { line: Line; lanes: readonly ViewLane[] };

/** Клітинкові доріжки, які людина бачить, — згори донизу. */
export const shownCells = (song: Song, display: LaneDisplay): ViewLane[] =>
  songLanes(song.doc).flatMap((l) => (isTextKind(l.kind) || display.hidden?.includes(l.id) ? [] : [l.id]));

/** Які доріжки рядка є у видимому дереві; `null` — рядка у видимому немає. */
export function viewLanes(l: LineAt, display: LaneDisplay, cells: readonly ViewLane[] = []): readonly ViewLane[] | null {
  const kind = lineKind(l);
  if (kind === "note") return ["words"];
  if (kind === "empty") return display.words || !display.chords ? ["words"] : ["chords"];
  const lanes = [...cells, ...LANES.filter((lane) => display[lane])];
  return lanes.length ? lanes : null;
}

export const laneNode = (l: LineAt, lane: ViewLane) =>
  (isTextLane(lane)
    ? { type: lane, children: [{ text: laneOf(l, lane) }] }
    : { type: "cells", lane, children: [{ text: "" }] }) as unknown as Node;
export const viewNode = (l: LineAt, lanes: readonly ViewLane[]) =>
  ({ type: "line", children: lanes.map((lane) => laneNode(l, lane)) }) as unknown as Node;
/** Доріжка вузла видимого дерева. */
export const laneOfNode = (node: Node): ViewLane => {
  const n = node as unknown as { type: string; lane?: string };
  return n.type === "cells" ? n.lane! : n.type;
};

/** Видимі рядки для поточних рядків моделі. */
export const project = (s: ViewState) => {
  const cells = shownCells(s.song, s.display);
  return s.lines.flatMap((l) => {
    const lanes = viewLanes(l, s.display, cells);
    return lanes ? [{ l, lanes }] : [];
  });
};

/** Чи видно (і можна правити) доріжку рядка. Посеред команди модель змінюється — тож завжди свіжі рядки. */
export function isShown(s: ViewState, ln: number, lane: ViewLane) {
  const l = layout(s.song)[ln];
  return !!l && (viewLanes(l, s.display, shownCells(s.song, s.display))?.includes(lane) ?? false);
}
