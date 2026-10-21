/** Склад рядків і доріжок видимого дерева — за моделлю. */
import { Element, Transforms } from "slate";
import { laneText, layout, LineAt } from "../../model";
import { laneNode, laneOfNode, nodeTypeOf, project, viewNode, type ViewLane } from "../projection";
import type { ViewState } from "../state";

/**
 * Маркери — ті самі об'єкти, тож незмінні початок і кінець списку
 * вирівнюються за ідентичністю, а різниця посередині — це додані й прибрані
 * рядки. Повертає доріжки, зібрані наново з моделі (маркер — його слова, текст
 * акордів — акорди): їхні дельти вже враховано.
 */
export function alignLines(s: ViewState): Set<unknown> {
  const { view } = s;
  const fresh = new Set<unknown>();
  // Клітинкові доріжки тексту не мають — дельт для них немає.
  const mark = (l: LineAt, lane: ViewLane) => {
    const text = lane === "words" ? l.line : laneText(l.line, lane);
    if (text) fresh.add(text);
  };
  const prev = s.sources;
  const next = project(s);
  let pre = 0;
  while (pre < prev.length && pre < next.length && prev[pre].line === next[pre].l.line) pre++;
  let suf = 0;
  while (
    suf < prev.length - pre &&
    suf < next.length - pre &&
    prev[prev.length - 1 - suf].line === next[next.length - 1 - suf].l.line
  ) suf++;

  for (let i = prev.length - suf - 1; i >= pre; i--) Transforms.removeNodes(view, { at: [i] });
  for (let i = pre; i < next.length - suf; i++) {
    Transforms.insertNodes(view, viewNode(next[i].l, next[i].lanes), { at: [i] });
    next[i].lanes.forEach((lane) => mark(next[i].l, lane));
  }
  // Рядки, що лишились, могли змінити вид (порожній ↔ відрізок) — тоді й склад доріжок.
  next.forEach(({ l, lanes }, vln) => {
    if (vln >= pre && vln < next.length - suf) return;
    const nodes = (view.children[vln] as Element).children;
    const had = nodes.map(laneOfNode);
    // Доріжки переставили (порядок доданих) або доріжка змінила вид вузла (слот
    // дописали пізніше) — рядок збирається наново.
    const kept = had.filter((lane) => lanes.includes(lane));
    const retyped = nodes.some((n, i) => lanes.includes(had[i]) && (n as unknown as { type: string }).type !== nodeTypeOf(l, had[i]));
    if (retyped || kept.join() !== lanes.filter((lane) => had.includes(lane)).join()) {
      Transforms.removeNodes(view, { at: [vln] });
      Transforms.insertNodes(view, viewNode(l, lanes), { at: [vln] });
      lanes.forEach((lane) => mark(l, lane));
      return;
    }
    for (let i = had.length - 1; i >= 0; i--) {
      if (!lanes.includes(had[i])) Transforms.removeNodes(view, { at: [vln, i] });
    }
    lanes.forEach((lane, i) => {
      if (had.includes(lane)) return;
      Transforms.insertNodes(view, laneNode(l, lane), { at: [vln, i] });
      mark(l, lane);
    });
  });
  s.sources = next.map(({ l, lanes }) => ({ line: l.line, lanes }));
  return fresh;
}

/** Зібрати видиме наново з моделі — на старті й коли щось пройшло в обхід правил. */
export function rebuild(s: ViewState) {
  s.lines = layout(s.song);
  const next = project(s);
  s.sources = next.map(({ l, lanes }) => ({ line: l.line, lanes }));
  s.view.children = next.map(({ l, lanes }) => viewNode(l, lanes)) as never;
  s.view.selection = null;
  s.view.onChange();
}
