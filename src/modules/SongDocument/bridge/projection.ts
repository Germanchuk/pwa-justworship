/**
 * Проєкція: який вигляд має рядок моделі у видимому дереві конкретної людини.
 * Лише вибрані доріжки; каркас (структурні примітки й порожні рядки) — завжди.
 *
 * Доріжки рядка у видимому — згори донизу (ADR-0008): додані в порядку пісні —
 * текстові (вигуки) правляться як акорди, клітинкові (прямокутники, таби,
 * кахон) — атомні вузли Slate зі своїм курсором; під ними акорди, найнижче — слова.
 */
import { Node } from "slate";
import { isBuiltinKind, isTextSlot, LANES, laneOf, layout, Line, LineAt, lineKind, songLanes, Song } from "../model";
import type { ViewState } from "./state";

export type LaneDisplay = {
  readonly words: boolean;
  readonly chords: boolean;
  /** id доданих доріжок, яких людина не бачить. */
  readonly hidden?: readonly string[];
};

/** Доріжка видимого рядка: `words`, `chords` або id доданої. */
export type ViewLane = string;
/** Вузол клітинкової доріжки — атомний (void). */
export const isCellsNode = (node: Node) => (node as unknown as { type: string }).type === "cells";

/** Рядок видимого дерева: який маркер він показує і які доріжки. */
export type Source = { line: Line; lanes: readonly ViewLane[] };

/** Додані доріжки, які людина бачить, — згори донизу. */
export const shownAdded = (song: Song, display: LaneDisplay): ViewLane[] =>
  songLanes(song.doc).flatMap((l) => (isBuiltinKind(l.kind) || display.hidden?.includes(l.id) ? [] : [l.id]));

/** Які доріжки рядка є у видимому дереві; `null` — рядка у видимому немає. */
export function viewLanes(l: LineAt, display: LaneDisplay, added: readonly ViewLane[] = []): readonly ViewLane[] | null {
  const kind = lineKind(l);
  if (kind === "note") return ["words"];
  if (kind === "empty") return display.words || !display.chords ? ["words"] : ["chords"];
  const lanes = [...added, ...LANES.filter((lane) => display[lane as "words" | "chords"])];
  return lanes.length ? lanes : null;
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
  const added = shownAdded(s.song, s.display);
  return s.lines.flatMap((l) => {
    const lanes = viewLanes(l, s.display, added);
    return lanes ? [{ l, lanes }] : [];
  });
};

/** Чи видно (і можна правити) доріжку рядка. Посеред команди модель змінюється — тож завжди свіжі рядки. */
export function isShown(s: ViewState, ln: number, lane: ViewLane) {
  const l = layout(s.song)[ln];
  return !!l && (viewLanes(l, s.display, shownAdded(s.song, s.display))?.includes(lane) ?? false);
}
