/**
 * PROTOTYPE (гілка `prototype/segments-lanes`) — ітерація 4: два дерева.
 *
 * Повне дерево — редактор Slate, прив'язаний до Yjs через `@slate-yjs`: усі
 * рядки, усі доріжки, правила `withTextLanes`. Користувач його не бачить.
 *
 * Видиме дерево — звичайний редактор Slate без Yjs: лише ті рядки й доріжки,
 * які цей користувач вибрав до показу. Slate справді не знає про сховане —
 * навігація, виділення, видалення в ньому рідні.
 *
 * Мідлвер між ними:
 *  - друк і стирання символів у видимому → та сама операція в повному
 *    (перенумерація шляху), видиме застосовує її саме — курсор і введення
 *    з клавіатури не смикаються;
 *  - Enter, Backspace/Delete, видалення виділення → команда в повному
 *    дереві з перекладеним курсором;
 *  - після будь-якої зміни повного (своєї чи чужої з мережі) видиме
 *    звіряється з проєкцією: незмінні рядки не чіпаємо, у змінених — правимо
 *    текст доріжок мінімальною різницею, змінився склад доріжок — додаємо чи
 *    прибираємо доріжку; курсор повертаємо з повного дерева.
 */
import { createEditor, Editor, Element, Node, Operation, Path, Point, Range, Transforms } from "slate";
import { LaneType, lanePath, laneText, lineKind, slashAllowed } from "./textLanes";

export type LaneDisplay = { words: boolean; chords: boolean };
const ORDER: LaneType[] = ["chords", "words"];
const typeOf = (n: unknown) => (n as { type?: string }).type as LaneType;

/**
 * Які доріжки рядка є у видимому дереві; `null` — рядка у видимому немає.
 * Каркас (структурна примітка `/…`, порожній рядок) видно завжди.
 */
export function viewLanes(full: Editor, ln: number, d: LaneDisplay): LaneType[] | null {
  const kind = lineKind(full, ln);
  if (kind === "note") return ["words"];
  if (kind === "empty") return d.words ? ["words"] : d.chords ? ["chords"] : ["words"];
  const lanes = ORDER.filter((l) => d[l]);
  return lanes.length ? lanes : null;
}

export type Projection = { lines: number[]; lanes: LaneType[][]; nodes: Node[] };

export function project(full: Editor, d: LaneDisplay): Projection {
  const out: Projection = { lines: [], lanes: [], nodes: [] };
  full.children.forEach((line, ln) => {
    const vl = viewLanes(full, ln, d);
    if (!vl) return;
    const { children: _c, ...props } = line as Element & Record<string, unknown>;
    out.lines.push(ln);
    out.lanes.push(vl);
    out.nodes.push({ ...props, children: vl.map((l) => Node.get(full, lanePath(full, ln, l))) } as Node);
  });
  return out;
}

export function toFullPoint(full: Editor, p: Projection, vp: Point): Point {
  const [vln, vl, ...rest] = vp.path;
  const ln = p.lines[vln];
  return { path: [ln, lanePath(full, ln, p.lanes[vln][vl])[1], ...rest], offset: vp.offset };
}

export function toViewPoint(full: Editor, p: Projection, fp: Point): Point | null {
  const [ln, l, ...rest] = fp.path;
  const vln = p.lines.indexOf(ln);
  if (vln < 0) return null;
  const vl = p.lanes[vln].indexOf(typeOf(Node.get(full, [ln, l])));
  return vl < 0 ? null : { path: [vln, vl, ...rest], offset: fp.offset };
}

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Мінімальна правка тексту однієї доріжки: спільні початок і кінець лишаються. */
function patchText(view: Editor, path: Path, from: string, to: string) {
  let pre = 0;
  while (pre < from.length && pre < to.length && from[pre] === to[pre]) pre++;
  let suf = 0;
  while (suf < from.length - pre && suf < to.length - pre && from[from.length - 1 - suf] === to[to.length - 1 - suf]) suf++;
  const removed = from.slice(pre, from.length - suf);
  const inserted = to.slice(pre, to.length - suf);
  if (removed) view.apply({ type: "remove_text", path: [...path, 0], offset: pre, text: removed });
  if (inserted) view.apply({ type: "insert_text", path: [...path, 0], offset: pre, text: inserted });
}

/** Довести один рядок видимого дерева до бажаного, не замінюючи його цілком. */
function patchLine(view: Editor, vln: number, want: Element & Record<string, unknown>) {
  const cur = view.children[vln] as Element & Record<string, unknown>;
  const { children: _a, ...curProps } = cur;
  const { children: _b, ...wantProps } = want;
  if (!same(curProps, wantProps)) {
    const unset = Object.fromEntries(Object.keys(curProps).filter((k) => !(k in wantProps)).map((k) => [k, null]));
    Transforms.setNodes(view, { ...unset, ...wantProps } as Partial<Node>, { at: [vln] });
  }
  // Склад доріжок: прибрати зайві, вставити відсутні (на своє місце).
  const wantLanes = want.children.map(typeOf);
  for (let i = cur.children.length - 1; i >= 0; i--) {
    if (!wantLanes.includes(typeOf((view.children[vln] as Element).children[i]))) Transforms.removeNodes(view, { at: [vln, i] });
  }
  wantLanes.forEach((lane, i) => {
    const have = (view.children[vln] as Element).children.map(typeOf);
    if (have[i] !== lane) Transforms.insertNodes(view, want.children[i], { at: [vln, i] });
  });
  wantLanes.forEach((_, i) => {
    patchText(view, [vln, i], Node.string((view.children[vln] as Element).children[i]), Node.string(want.children[i]));
  });
}

/** Звірити видиме дерево з проєкцією: незмінні рядки на початку й у кінці не чіпаємо. */
function reconcile(view: Editor, want: Node[]) {
  const cur = view.children;
  let pre = 0;
  while (pre < cur.length && pre < want.length && same(cur[pre], want[pre])) pre++;
  let suf = 0;
  while (suf < cur.length - pre && suf < want.length - pre && same(cur[cur.length - 1 - suf], want[want.length - 1 - suf])) suf++;
  const curMid = cur.length - pre - suf;
  const wantMid = want.length - pre - suf;
  // Спільна частина середини — правимо рядок у рядок; решту вставляємо/прибираємо.
  const common = Math.min(curMid, wantMid);
  for (let i = 0; i < common; i++) patchLine(view, pre + i, want[pre + i] as Element & Record<string, unknown>);
  for (let i = curMid - 1; i >= common; i--) Transforms.removeNodes(view, { at: [pre + i] });
  for (let i = common; i < wantMid; i++) Transforms.insertNodes(view, want[pre + i], { at: [pre + i] });
}

export type LaneViewHandle = {
  view: Editor;
  setDisplay: (d: LaneDisplay) => void;
  /** Звірити видиме з повним (викликається сам після змін повного). */
  sync: () => void;
  projection: () => Projection;
};

/**
 * Створити видимий редактор поверх повного. `full` — редактор з `withYjs` +
 * `withTextLanes`; `afterFullChange` — що зробити після команди в повному
 * (у тестах — віддати зміни в Yjs одразу).
 */
export function createLaneView(
  full: Editor & { sharedRoot?: { observeDeep: (f: () => void) => void } },
  display: LaneDisplay,
  opts: { base?: () => Editor; afterFullChange?: () => void } = {},
): LaneViewHandle {
  const view = (opts.base ?? createEditor)();
  let d = display;
  let proj = project(full, d);
  let syncing = false;

  // Що може правити видимий редактор у повному: лише доріжки, які видно.
  (full as unknown as { laneEditable: (ln: number, lane: LaneType) => boolean }).laneEditable = (ln, lane) =>
    (viewLanes(full, ln, d) ?? []).includes(lane);

  const fullSelectionFromView = () => {
    const sel = view.selection;
    if (!sel) return Transforms.deselect(full);
    Transforms.select(full, { anchor: toFullPoint(full, proj, sel.anchor), focus: toFullPoint(full, proj, sel.focus) });
  };

  const sync = () => {
    proj = project(full, d);
    syncing = true;
    try {
      Editor.withoutNormalizing(view, () => reconcile(view, proj.nodes));
      const fs = full.selection;
      const a = fs && toViewPoint(full, proj, fs.anchor);
      const f = fs && toViewPoint(full, proj, fs.focus);
      if (a && f) Transforms.select(view, { anchor: a, focus: f });
      else Transforms.deselect(view);
    } finally {
      syncing = false;
    }
  };

  /** Виконати команду в повному дереві з курсором, перекладеним з видимого. */
  const inFull = (run: () => void) => {
    // Структурна дія — окремий крок історії (Y.UndoManager склеює все за 500 мс).
    const um = (full as unknown as { undoManager?: { stopCapturing: () => void } }).undoManager;
    um?.stopCapturing();
    fullSelectionFromView();
    run();
    opts.afterFullChange?.();
    um?.stopCapturing();
    sync();
  };

  const { apply } = view;
  view.apply = (op: Operation) => {
    if (syncing) return apply(op);
    if (op.type === "set_selection") {
      apply(op);
      return fullSelectionFromView();
    }
    if (op.type === "insert_text" || op.type === "remove_text") {
      // Гарячий шлях друку: видиме застосовує саме, повне — та сама операція.
      const fp = toFullPoint(full, proj, { path: op.path, offset: op.offset });
      apply(op);
      full.apply({ ...op, path: fp.path, offset: fp.offset });
      opts.afterFullChange?.();
      proj = project(full, d);
      // Друк міг змінити вид рядка (порожній ↔ відрізок) — тоді й склад доріжок.
      if (!same(view.children, proj.nodes)) sync();
      return;
    }
    throw new Error(`laneView: структурна операція ${op.type} мала піти через команду повного дерева`);
  };

  view.insertText = (text) => {
    const sel = view.selection;
    if (!sel) return;
    if (!Range.isCollapsed(sel)) view.deleteFragment();
    const at = view.selection!.anchor;
    if (!slashAllowed(full, toFullPoint(full, proj, at), text)) return;
    Transforms.insertText(view, text);
  };
  // Undo/redo — штатний `withYHistory` повного дерева (Y.UndoManager); курсор
  // бібліотека відновлює після транзакції, тому вирівнюємо видиме вже після.
  const history = full as unknown as { undo?: () => void; redo?: () => void };
  if (typeof history.undo === "function") {
    (view as unknown as { undo: () => void }).undo = () => {
      history.undo!();
      sync();
    };
    (view as unknown as { redo: () => void }).redo = () => {
      history.redo!();
      sync();
    };
  }

  view.insertBreak = () => inFull(() => Editor.insertBreak(full));
  view.deleteBackward = (unit) => inFull(() => Editor.deleteBackward(full, { unit }));
  view.deleteForward = (unit) => inFull(() => Editor.deleteForward(full, { unit }));
  view.deleteFragment = (options) => inFull(() => Editor.deleteFragment(full, options));

  // Чужі правки: @slate-yjs підписався на Yjs раніше, тож ми бачимо вже оновлене повне дерево.
  full.sharedRoot?.observeDeep(() => {
    if (!syncing) sync();
  });

  view.children = proj.nodes as never;
  return {
    view,
    setDisplay: (next) => {
      d = next;
      sync();
    },
    sync,
    projection: () => proj,
  };
}

export { laneText };
