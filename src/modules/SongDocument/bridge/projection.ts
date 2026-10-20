/**
 * Проєкція: який вигляд має рядок моделі у видимому дереві конкретної людини.
 * Лише вибрані доріжки; каркас (структурні примітки й порожні рядки) — завжди.
 */
import { Node } from "slate";
import { LaneType, laneOf, layout, Line, LineAt, lineKind, textLaneOrder } from "../model";
import type { ViewState } from "./state";

export type LaneDisplay = Readonly<Record<LaneType, boolean>>;

/** Рядок видимого дерева: який маркер він показує і які доріжки. */
export type Source = { line: Line; lanes: readonly LaneType[] };

/**
 * Які доріжки рядка є у видимому дереві, у порядку пісні `order`; `null` —
 * рядка у видимому немає. Клітинкові доріжки — поза Slate (віджет рядка).
 */
export function viewLanes(l: LineAt, display: LaneDisplay, order: readonly LaneType[]): readonly LaneType[] | null {
  const kind = lineKind(l);
  if (kind === "note") return ["words"];
  if (kind === "empty") return display.words || !display.chords ? ["words"] : ["chords"];
  const lanes = order.filter((lane) => display[lane]);
  return lanes.length ? lanes : null;
}

export const laneNode = (l: LineAt, lane: LaneType) => ({ type: lane, children: [{ text: laneOf(l, lane) }] }) as unknown as Node;
export const viewNode = (l: LineAt, lanes: readonly LaneType[]) =>
  ({ type: "line", children: lanes.map((lane) => laneNode(l, lane)) }) as unknown as Node;
export const laneTypeOf = (node: Node) => (node as unknown as { type: LaneType }).type;

/** Видимі рядки для поточних рядків моделі. */
export const project = (s: ViewState) => {
  const order = textLaneOrder(s.song.doc);
  return s.lines.flatMap((l) => {
    const lanes = viewLanes(l, s.display, order);
    return lanes ? [{ l, lanes }] : [];
  });
};

/** Чи видно (і можна правити) доріжку рядка. Посеред команди модель змінюється — тож завжди свіжі рядки. */
export function isShown(s: ViewState, ln: number, lane: LaneType) {
  const l = layout(s.song)[ln];
  return !!l && (viewLanes(l, s.display, textLaneOrder(s.song.doc))?.includes(lane) ?? false);
}
