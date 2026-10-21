/** Точні правки тексту з подій Yjs — у видиме дерево, без вгадування різниці. */
import * as Y from "yjs";
import { Node, Path } from "slate";
import { laneText, Line, LineAt } from "../../model";
import type { ViewState } from "../state";

type Delta = Y.YTextEvent["delta"];

const insertAt = (s: ViewState, path: Path, offset: number, text: string) =>
  s.view.apply({ type: "insert_text", path, offset, text });
const removeAt = (s: ViewState, path: Path, offset: number, length: number) =>
  s.view.apply({ type: "remove_text", path, offset, text: Node.string(Node.get(s.view, path)).slice(offset, offset + length) });

/** Дельта тексту доріжки рядка (акорди, додана текстова) — у видиме як є. */
export function applyLaneDelta(s: ViewState, target: Y.Text, delta: Delta) {
  let vln = -1;
  let vl = -1;
  s.sources.some(({ line, lanes }, i) => {
    const at = lanes.findIndex((lane) => lane !== "words" && laneText(line, lane) === target);
    if (at >= 0) [vln, vl] = [i, at];
    return at >= 0;
  });
  if (vl < 0) return; // доріжку цей учасник не бачить
  const path: Path = [vln, vl, 0];
  let offset = 0;
  delta.forEach((d) => {
    if (d.retain) offset += d.retain;
    else if (typeof d.insert === "string") {
      insertAt(s, path, offset, d.insert);
      offset += d.insert.length;
    } else if (d.delete) removeAt(s, path, offset, d.delete);
  });
}

/**
 * Дельта тексту пісні — у слова видимих рядків. Дельта йде по всьому тексту:
 * старі місця — за рядками `before`, нові — за `s.lines`. Кожен рядок бере
 * свою частину: символ, що лишився в його словах, — пропустити; зник або
 * перейшов в інший рядок (Enter) — стерти; з'явився або перейшов сюди
 * (склеювання) — вставити.
 */
export function applyWordsDelta(s: ViewState, delta: Delta, before: LineAt[], fresh: Set<unknown>) {
  const byLine = (ls: LineAt[]) => new Map<Line, LineAt>(ls.map((l) => [l.line, l]));
  const [old, cur] = [byLine(before), byLine(s.lines)];
  const span = (l: LineAt): [number, number] => [l.at + 1, l.at + 1 + l.words.length];
  s.sources.forEach(({ line, lanes }, vln) => {
    const vl = lanes.indexOf("words");
    const [o0, n0] = [old.get(line), cur.get(line)];
    if (vl < 0 || fresh.has(line) || !o0 || !n0) return;
    const [was, now] = [span(o0), span(n0)];
    const path: Path = [vln, vl, 0];
    const words = n0.words;
    let offset = 0; // у видимих словах рядка
    let o = 0; // у старому тексті пісні
    let n = 0; // у новому
    const inside = ([from, to]: [number, number], i: number) => i >= from && i < to;
    // Решту тексту після останньої правки дельта не називає — вона лишилась як була.
    for (const d of [...delta, { retain: Number.MAX_SAFE_INTEGER }]) {
      if (o >= was[1] && n >= now[1]) break;
      if (d.retain) {
        // Межі обох проміжків ділять шматок на частини з однаковою долею.
        const cuts = [0, d.retain, was[0] - o, was[1] - o, now[0] - n, now[1] - n]
          .filter((k) => k >= 0 && k <= d.retain!)
          .sort((x, y) => x - y);
        for (let c = 0; c < cuts.length - 1; c++) {
          const [k, len] = [cuts[c], cuts[c + 1] - cuts[c]];
          if (!len) continue;
          const wasHere = inside(was, o + k);
          const isHere = inside(now, n + k);
          if (wasHere && isHere) offset += len;
          else if (wasHere) removeAt(s, path, offset, len);
          else if (isHere) {
            insertAt(s, path, offset, words.slice(n + k - now[0], n + k - now[0] + len));
            offset += len;
          }
        }
        o += d.retain;
        n += d.retain;
      } else if (d.delete) {
        const from = Math.max(o, was[0]);
        const to = Math.min(o + d.delete, was[1]);
        if (to > from) removeAt(s, path, offset, to - from);
        o += d.delete;
      } else if (typeof d.insert === "string") {
        const from = Math.max(n, now[0]);
        const to = Math.min(n + d.insert.length, now[1]);
        if (to > from) {
          insertAt(s, path, offset, d.insert.slice(from - n, to - n));
          offset += to - from;
        }
        n += d.insert.length;
      } else if (d.insert) n += 1; // маркер
    }
  });
}
