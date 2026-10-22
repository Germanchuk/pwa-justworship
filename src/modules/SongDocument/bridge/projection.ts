/**
 * Проєкція: який вигляд має рядок моделі у видимому дереві конкретної людини.
 * Лише вибрані доріжки; каркас (структурні примітки й порожні рядки) — завжди.
 *
 * Доріжки рядка у видимому — згори донизу в порядку пісні (ADR-0008): слова й
 * акорди, текстові додані (вигуки) правляться як акорди, клітинкові
 * (прямокутники, таби, кахон) — атомні вузли Slate зі своїм курсором.
 */
import { Node } from "slate";
import { isBuiltinKind, isTextSlot, LANES, laneOf, layout, Line, LineAt, lineKind, songLanes, Song } from "../model";
import type { ViewState } from "./state";

export type LaneDisplay = {
  readonly words: boolean;
  readonly chords: boolean;
  /** id доданих доріжок, яких людина не бачить. */
  readonly hidden?: readonly string[];
  /** Масштаб показу ударів — комірок у цілій ноті (`ZOOMS`, особисте, як капо). */
  readonly zoom?: number;
};

/** Доріжка видимого рядка: `words`, `chords` або id доданої. */
export type ViewLane = string;
/** Вузол клітинкової доріжки — атомний (void). */
export const isCellsNode = (node: Node) => (node as unknown as { type: string }).type === "cells";

/** Рядок видимого дерева: який маркер він показує і які доріжки. */
export type Source = { line: Line; lanes: readonly ViewLane[] };

/** Доріжки, які людина бачить, — згори донизу в порядку пісні. */
export const shownLanes = (song: Song, display: LaneDisplay): ViewLane[] =>
  songLanes(song.doc).flatMap((l) =>
    (isBuiltinKind(l.kind) ? display[l.kind as "words" | "chords"] : !display.hidden?.includes(l.id)) ? [l.id] : [],
  );

/** Які доріжки рядка є у видимому дереві; `null` — рядка у видимому немає. */
export function viewLanes(
  l: LineAt,
  display: LaneDisplay,
  shown: readonly ViewLane[] = LANES.filter((lane) => display[lane as "words" | "chords"]),
): readonly ViewLane[] | null {
  const kind = lineKind(l);
  if (kind === "note") return ["words"];
  if (kind === "empty") return display.words || !display.chords ? ["words"] : ["chords"];
  return shown.length ? shown : null;
}

/** Вузол доріжки: слова й акорди — `type` = id; додана текстова — `text`; клітинкова (і слот, якого ще немає) — `cells`. */
export const laneNode = (l: LineAt, lane: ViewLane) =>
  (lane === "words" || lane === "chords"
    ? { type: lane, children: [{ text: laneOf(l, lane) }] }
    : isTextSlot(l.line, lane)
      ? { type: "text", lane, children: [{ text: laneOf(l, lane) }] }
      : { type: "cells", lane, children: [{ text: "" }] }) as unknown as Node;
/** Тип вузла, яким доріжка має бути зараз (слот міг з'явитись пізніше — `ensureSlots`). */
export const nodeTypeOf = (l: LineAt, lane: ViewLane) => (laneNode(l, lane) as unknown as { type: string }).type;
export const viewNode = (l: LineAt, lanes: readonly ViewLane[]) =>
  ({ type: "line", children: lanes.map((lane) => laneNode(l, lane)) }) as unknown as Node;
/** Доріжка вузла видимого дерева. */
export const laneOfNode = (node: Node): ViewLane => {
  const n = node as unknown as { type: string; lane?: string };
  return n.lane ?? n.type;
};

/** Видимі рядки для поточних рядків моделі. */
export const project = (s: ViewState) => {
  const shown = shownLanes(s.song, s.display);
  return s.lines.flatMap((l) => {
    const lanes = viewLanes(l, s.display, shown);
    return lanes ? [{ l, lanes }] : [];
  });
};

/** Чи видно (і можна правити) доріжку рядка. Посеред команди модель змінюється — тож завжди свіжі рядки. */
export function isShown(s: ViewState, ln: number, lane: ViewLane) {
  const l = layout(s.song)[ln];
  return !!l && (viewLanes(l, s.display, shownLanes(s.song, s.display))?.includes(lane) ?? false);
}
