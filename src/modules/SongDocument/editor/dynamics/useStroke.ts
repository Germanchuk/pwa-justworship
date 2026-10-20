/**
 * Мазок динаміки: палець (чи миша) по смужці біля рядків. Ліва смужка — спільна
 * динаміка, права — моя особиста: шар мазка задає смужка, з якої він почався.
 * Поки веде — рядки під мазком лише показуються новим кольором; відпустив —
 * одна правка моделі. Рядки під мазком — маркери, не номери: чужий Enter
 * посеред мазка не зсуне фарбу на інший рядок.
 */
import { PointerEvent, useRef, useState } from "react";
import { DynamicsLayer, DynamicsStepKey, Line, linesOf, Song } from "../../model";
import type { Paint } from "../../bridge/to-model/paint";

/** Колір пензля; `null` — гумка. */
export type Brush = DynamicsStepKey | null;

export type Stroke = {
  /** Як показати рядок під мазком у шарі `layer`; `undefined` — рядок не під мазком. */
  preview: (line: Line, layer: DynamicsLayer) => Brush | undefined;
  /** Обробники смужки шару `layer` рядка `ln` (номер у моделі). */
  zoneProps: (
    ln: number,
    layer: DynamicsLayer,
  ) => {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
  };
};

/** Номер рядка, чия смужка того самого боку на висоті `y` у тому самому редакторі. */
function lineAtY(from: HTMLElement, y: number): number | null {
  const side = from.dataset.dynSide;
  const zones = from.closest("[data-song-editor]")?.querySelectorAll<HTMLElement>(`[data-dyn-side="${side}"]`) ?? [];
  for (const zone of zones) {
    const { top, bottom } = zone.getBoundingClientRect();
    if (y >= top && y < bottom) return Number(zone.dataset.dynLine);
  }
  return null;
}

export function useStroke(song: Song, brush: Brush, paint: Paint): Stroke {
  const stroke = useRef<{ lines: Line[]; last: number; layer: DynamicsLayer } | null>(null);
  const [, redraw] = useState(0);

  /** Додати рядки від попереднього до `ln` — швидкий мазок перескакує смужки. */
  const reach = (ln: number) => {
    const s = stroke.current;
    if (!s || ln === s.last) return;
    const all = linesOf(song);
    const [from, to] = s.last < ln ? [s.last, ln] : [ln, s.last];
    all.slice(from, to + 1).forEach((line) => s.lines.includes(line) || s.lines.push(line));
    s.last = ln;
    redraw((n) => n + 1);
  };
  const finish = () => {
    const s = stroke.current;
    stroke.current = null;
    if (s) paint(s.lines, brush, s.layer);
    redraw((n) => n + 1);
  };

  return {
    preview: (line, layer) => {
      const s = stroke.current;
      return s && s.layer === layer && s.lines.includes(line) ? brush : undefined;
    },
    zoneProps: (ln, layer) => ({
      onPointerDown: (e) => {
        e.preventDefault(); // не чіпати курсор і виділення в тексті
        e.currentTarget.setPointerCapture(e.pointerId);
        stroke.current = { lines: [linesOf(song)[ln]], last: ln, layer };
        redraw((n) => n + 1);
      },
      onPointerMove: (e) => {
        if (!stroke.current) return;
        const under = lineAtY(e.currentTarget, e.clientY);
        if (under !== null) reach(under);
      },
      onPointerUp: finish,
      onPointerCancel: finish,
    }),
  };
}
