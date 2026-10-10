/**
 * Особистий показ доріжок: видиме дерево поверх повного.
 *
 * Повне дерево — редактор, прив'язаний до Yjs через `@slate-yjs`, з усіма
 * рядками й доріжками та правилами `withTextLanes`. Він — єдине джерело правди.
 *
 * Видиме дерево — звичайний редактор Slate без Yjs, який бачить користувач:
 * лише вибрані ним доріжки (каркас — структурні примітки й порожні рядки —
 * завжди). Slate справді не знає про сховане, тож навігація, виділення й
 * видалення в ньому рідні, а сховане не правиться.
 *
 * Як вони тримаються разом:
 *  - друк і стирання символів у видимому застосовуються в обох деревах тією
 *    самою операцією (шлях перекладено) — без перемальовування рядка;
 *  - решта правок (Enter, склеювання, видалення виділення, вставка, undo) —
 *    команди повного дерева з перекладеним курсором;
 *  - після кожної зміни повного (через команду, в обхід видимого, чужої з
 *    мережі, undo — штатні `onChange` і `applyRemoteEvents`) видиме звіряється з
 *    ним: рядки, чий об'єкт у повному дереві не змінився, не чіпаються; у
 *    змінених правиться лише різниця тексту й складу доріжок; курсор
 *    повертається з повного дерева.
 */
import { createEditor, Editor, Element, Node, Operation, Path, Point, Range, Transforms } from "slate";
import { insertPlainText, LANES, LaneType, laneTypeOf, lineKind, setLaneAccess, slashAllowed } from "./textLanes";

export type LaneDisplay = Readonly<Record<LaneType, boolean>>;

/**
 * Які доріжки рядка є у видимому дереві; `null` — рядка у видимому немає.
 * Каркас видно завжди: у структурної примітки — слова, у порожнього рядка —
 * та доріжка, в яку учасник може писати.
 */
export function viewLanes(full: Editor, ln: number, display: LaneDisplay): readonly LaneType[] | null {
  const kind = lineKind(full, ln);
  if (kind === "note") return ["words"];
  if (kind === "empty") return display.words || !display.chords ? ["words"] : ["chords"];
  const lanes = LANES.filter((l) => display[l]);
  return lanes.length ? lanes : null;
}

/** Рядок видимого дерева: з якого рядка повного він зроблений і які доріжки показує. */
type Source = { node: Element; ln: number; lanes: readonly LaneType[] };

const sameLanes = (a: readonly LaneType[], b: readonly LaneType[]) =>
  a.length === b.length && a.every((lane, i) => lane === b[i]);

function viewNode({ node, lanes }: Source): Node {
  const { children, ...props } = node as Element & Record<string, unknown>;
  return { ...props, children: lanes.map((lane) => children.find((c) => laneTypeOf(c) === lane)!) } as Node;
}

/** Найменша правка тексту доріжки: спільні початок і кінець лишаються. */
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

/** Довести рядок видимого дерева до вигляду `src`, не замінюючи його цілком. */
function patchLine(view: Editor, vln: number, src: Source) {
  const want = viewNode(src) as Element & Record<string, unknown>;
  const cur = view.children[vln] as Element & Record<string, unknown>;
  const changed = Object.fromEntries(
    [...new Set([...Object.keys(cur), ...Object.keys(want)])]
      .filter((k) => k !== "children" && cur[k] !== want[k])
      .map((k) => [k, want[k] ?? null]),
  );
  if (Object.keys(changed).length) Transforms.setNodes(view, changed as Partial<Node>, { at: [vln] });

  const lanesNow = () => (view.children[vln] as Element).children.map(laneTypeOf);
  const had = lanesNow();
  for (let l = had.length - 1; l >= 0; l--) {
    if (!src.lanes.includes(had[l])) Transforms.removeNodes(view, { at: [vln, l] });
  }
  src.lanes.forEach((lane, l) => {
    if (lanesNow()[l] !== lane) Transforms.insertNodes(view, want.children[l], { at: [vln, l] });
  });
  src.lanes.forEach((_, l) =>
    patchText(view, [vln, l], Node.string((view.children[vln] as Element).children[l]), Node.string(want.children[l])),
  );
}

export type LaneView = {
  /** Редактор, який бачить і править користувач. */
  view: Editor;
  setDisplay: (display: LaneDisplay) => void;
  /** Номер рядка повного дерева для рядка видимого (−1 — такого вже немає). */
  fullLine: (vln: number) => number;
  /** Чи видно (і можна правити) доріжку рядка повного дерева. */
  isShown: (ln: number, lane: LaneType) => boolean;
  toFull: (p: Point) => Point;
  toView: (p: Point) => Point | null;
  /** Виділення видимого → шматки по доріжках у повному дереві (лише видиме). */
  fullPieces: (r: Range) => Range[];
};

type FullEditor = Editor & {
  applyRemoteEvents?: (...args: never[]) => void;
  undo?: () => void;
  redo?: () => void;
  undoManager?: { stopCapturing: () => void };
};

/**
 * @param full редактор з `withYjs` + `withTextLanes` (і, за бажанням, `withYHistory`)
 * @param opts.base фабрика видимого редактора (на сторінці — `withReact(createEditor())`)
 * @param opts.flush віддати зміни повного в Yjs одразу (у тестах; у браузері це робить `onChange`)
 */
export function createLaneView(
  fullEditor: Editor,
  initialDisplay: LaneDisplay,
  opts: { base?: () => Editor; flush?: () => void } = {},
): LaneView {
  const full = fullEditor as FullEditor;
  const view = (opts.base ?? createEditor)();
  let display = initialDisplay;
  let sources: Source[] = [];
  let synced: Node[] | null = null; // `full.children`, з якими видиме звірене
  let syncing = false;

  const project = (): Source[] =>
    full.children.flatMap((node, ln) => {
      const lanes = viewLanes(full, ln, display);
      return lanes ? [{ node: node as Element, ln, lanes }] : [];
    });

  const isShown = (ln: number, lane: LaneType) => viewLanes(full, ln, display)?.includes(lane) ?? false;
  setLaneAccess(full, isShown);

  // ── переклад позицій ─────────────────────────────────────────────────────

  const toFull = ({ path: [vln, vl, ...rest], offset }: Point): Point => {
    const { node, ln, lanes } = sources[vln];
    return { path: [ln, node.children.findIndex((c) => laneTypeOf(c) === lanes[vl]), ...rest], offset };
  };

  const toView = ({ path: [ln, l, ...rest], offset }: Point): Point | null => {
    const vln = sources.findIndex((s) => s.ln === ln);
    if (vln < 0) return null;
    const vl = sources[vln].lanes.indexOf(laneTypeOf((full.children[ln] as Element).children[l]));
    return vl < 0 ? null : { path: [vln, vl, ...rest], offset };
  };

  // ── звірка видимого з повним ─────────────────────────────────────────────

  const quietly = (fn: () => void) => {
    syncing = true;
    try {
      Editor.withoutNormalizing(view, fn);
    } finally {
      syncing = false;
    }
  };

  const syncContent = (force = false) => {
    if (!force && full.children === synced) return;
    const prev = sources;
    const next = project();
    const same = (x: Source, y: Source) => x.node === y.node && sameLanes(x.lanes, y.lanes);
    let pre = 0;
    while (pre < prev.length && pre < next.length && same(prev[pre], next[pre])) pre++;
    let suf = 0;
    while (suf < prev.length - pre && suf < next.length - pre && same(prev[prev.length - 1 - suf], next[next.length - 1 - suf])) suf++;
    const prevMid = prev.length - pre - suf;
    const nextMid = next.length - pre - suf;
    const common = Math.min(prevMid, nextMid);
    quietly(() => {
      for (let i = 0; i < common; i++) patchLine(view, pre + i, next[pre + i]);
      for (let i = prevMid - 1; i >= common; i--) Transforms.removeNodes(view, { at: [pre + i] });
      for (let i = common; i < nextMid; i++) Transforms.insertNodes(view, viewNode(next[pre + i]), { at: [pre + i] });
    });
    sources = next;
    synced = full.children;
  };

  const syncSelection = () => {
    const sel = full.selection;
    const anchor = sel && toView(sel.anchor);
    const focus = sel && toView(sel.focus);
    quietly(() => (anchor && focus ? Transforms.select(view, { anchor, focus }) : Transforms.deselect(view)));
  };

  const sync = (force = false) => {
    syncContent(force);
    syncSelection();
  };

  /** Курсор видимого → курсор повного (команди виконуються в повному). */
  const mirrorSelection = () => {
    const sel = view.selection;
    if (!sel) Transforms.deselect(full);
    else Transforms.select(full, { anchor: toFull(sel.anchor), focus: toFull(sel.focus) });
  };

  // ── правки ───────────────────────────────────────────────────────────────

  /** Команда в повному дереві — окремий крок історії undo. */
  const command = (run: () => void) => {
    full.undoManager?.stopCapturing();
    mirrorSelection();
    run();
    opts.flush?.();
    full.undoManager?.stopCapturing();
    sync();
  };

  /** Друк і стирання символу: та сама операція в обох деревах. */
  const typed = (op: Extract<Operation, { type: "insert_text" | "remove_text" }>, apply: (op: Operation) => void) => {
    const at = toFull({ path: op.path, offset: op.offset });
    apply(op);
    full.apply({ ...op, path: at.path, offset: at.offset });
    opts.flush?.();
    // Друк міг змінити вид рядка (порожній ↔ відрізок) — тоді змінюється й склад доріжок.
    const vln = op.path[0];
    const { ln, lanes } = sources[vln];
    const now = viewLanes(full, ln, display);
    if (now && sameLanes(now, lanes)) {
      sources[vln] = { ...sources[vln], node: full.children[ln] as Element };
      synced = full.children;
    } else sync();
  };

  /** Щось змінило видиме дерево в обхід команд — відкочуємо його до документа. */
  let resetQueued = false;
  const reset = () => {
    resetQueued = false;
    sources = project();
    synced = full.children;
    view.children = sources.map(viewNode) as never;
    view.selection = null;
    syncSelection();
    view.onChange();
  };

  const { apply } = view;
  view.apply = (op) => {
    if (syncing) return apply(op);
    if (op.type === "set_selection") {
      apply(op);
      return mirrorSelection();
    }
    if (op.type === "insert_text" || op.type === "remove_text") return typed(op, apply);
    apply(op);
    if (!resetQueued) {
      resetQueued = true;
      console.warn(`laneView: операція «${op.type}» не через команду — видиме відкочено до документа`);
      queueMicrotask(reset);
    }
  };

  // Видиме дерево — проєкція валідного повного, нормалізувати нічого.
  view.normalizeNode = () => {};

  view.insertText = (text) => {
    const sel = view.selection;
    if (!sel) return;
    if (Range.isExpanded(sel)) return command(() => Editor.insertText(full, text));
    if (slashAllowed(full, toFull(sel.anchor), text)) Transforms.insertText(view, text);
  };
  view.insertBreak = () => command(() => Editor.insertBreak(full));
  view.deleteBackward = (unit) => command(() => Editor.deleteBackward(full, { unit }));
  view.deleteForward = (unit) => command(() => Editor.deleteForward(full, { unit }));
  view.deleteFragment = (options) => command(() => Editor.deleteFragment(full, options));
  view.insertData = (data) => {
    const text = data.getData("text/plain");
    if (text) command(() => insertPlainText(full, text));
  };
  if (full.undo && full.redo) {
    Object.assign(view, { undo: () => command(full.undo!), redo: () => command(full.redo!) });
  }

  // Будь-яка зміна повного дерева (своя в обхід видимого, чужа, undo) —
  // штатний `onChange` Slate; звірка ідемпотентна, зайвий виклик нічого не коштує.
  const { onChange } = full;
  full.onChange = (options) => {
    onChange(options);
    sync();
  };
  // Чужі правки — ще й одразу, без очікування `onChange`: штатна точка розширення @slate-yjs.
  if (full.applyRemoteEvents) {
    const { applyRemoteEvents } = full;
    full.applyRemoteEvents = (...args) => {
      applyRemoteEvents(...args);
      sync();
    };
  }

  reset();

  return {
    view,
    setDisplay: (next) => {
      display = next;
      sync(true);
    },
    fullLine: (vln) => sources[vln]?.ln ?? -1,
    isShown,
    toFull,
    toView,
    fullPieces: (r) =>
      Array.from(Editor.nodes(view, { at: r, match: (_, path) => path.length === 2 }), ([, path]) =>
        Range.intersection(r, Editor.range(view, path)),
      )
        .filter((piece): piece is Range => !!piece && Range.isExpanded(piece))
        .map((piece) => ({ anchor: toFull(piece.anchor), focus: toFull(piece.focus) })),
  };
}
