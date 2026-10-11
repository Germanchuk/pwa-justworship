/**
 * МІНІМАЛЬНИЙ ПРИКЛАД мідлвера «документ ↔ те, що бачить користувач».
 * Той самий принцип, що в `lanes/laneView.ts`, але без undo, вставки,
 * приміток, Yjs і крайніх випадків — щоб прочитати за кілька хвилин.
 *
 * Є два редактори Slate:
 *  - `full` — ДОКУМЕНТ. Усі рядки, усі доріжки (акорди + слова). Єдине
 *    джерело правди (у справжньому коді саме він прив'язаний до Yjs).
 *  - `view` — ТЕ, ЩО БАЧИТЬ КОРИСТУВАЧ. Ті самі рядки, але лише вибрані
 *    доріжки. Slate у ньому справді не знає про сховане.
 *
 * Мідлвер — це п'ять речей нижче.
 */
import { Editor, Element, Node, Point, Transforms } from "slate";

type Lane = "chords" | "words";
const laneOf = (node: Node) => (node as { type?: string }).type as Lane;

export function createMiniLaneView(full: Editor, view: Editor, log: (message: string) => void) {
  let showChords = true;
  let syncing = false; // мідлвер сам править видиме — це не дія користувача
  let madeFrom: Node[] = []; // з якого об'єкта документа зроблено кожен видимий рядок

  // ── 1. ПРОЄКЦІЯ: видимий рядок = рядок документа без схованих доріжок ────────
  const visible = (): Lane[] => (showChords ? ["chords", "words"] : ["words"]);
  const project = (line: Node): Node => {
    const { children, ...props } = line as Element;
    return { ...props, children: children.filter((lane) => visible().includes(laneOf(lane))) } as Node;
  };

  // ── 2. ПЕРЕКЛАД ПОЗИЦІЙ: номер доріжки у видимому ≠ номер у документі ───────
  // (рядки в прикладі однакові в обох деревах — ховаємо лише доріжки)
  const toFull = ({ path: [ln, vl, ...rest], offset }: Point): Point => {
    const fullLane = (full.children[ln] as Element).children.findIndex((l) => laneOf(l) === visible()[vl]);
    return { path: [ln, fullLane, ...rest], offset };
  };
  const toView = ({ path: [ln, l, ...rest], offset }: Point): Point | null => {
    const vl = visible().indexOf(laneOf((full.children[ln] as Element).children[l]));
    return vl < 0 ? null : { path: [ln, vl, ...rest], offset };
  };
  const show = (p: Point) => `[${p.path.join(",")}]:${p.offset}`;

  // ── 3. ЗВІРКА: після зміни документа видиме підтягується до нього ──────────
  const sync = () => {
    syncing = true;
    Editor.withoutNormalizing(view, () => {
      full.children.forEach((line, ln) => {
        // Slate створює НОВИЙ об'єкт лише для зміненого рядка. Той самий об'єкт — рядок не мінявся.
        if (madeFrom[ln] === line) return;
        const wanted = project(line);
        // Рядок у документі змінився, але видима частина та сама — змінилась схована доріжка.
        if (JSON.stringify(view.children[ln]) === JSON.stringify(wanted)) {
          log(`звірка: рядок ${ln + 1} — змінилось лише сховане, видиме не чіпаємо`);
          return;
        }
        if (ln < view.children.length) Transforms.removeNodes(view, { at: [ln] });
        Transforms.insertNodes(view, wanted, { at: [ln] });
        log(`звірка: рядок ${ln + 1} оновлено з документа`);
      });
      while (view.children.length > full.children.length) {
        Transforms.removeNodes(view, { at: [view.children.length - 1] });
        log(`звірка: рядок ${view.children.length + 1} прибрано`);
      }
      // Курсор теж береться з документа (там його зсувають і чужі правки).
      const at = full.selection && toView(full.selection.anchor);
      if (at) Transforms.select(view, at);
      else Transforms.deselect(view);
    });
    madeFrom = [...full.children];
    syncing = false;
  };

  // Будь-яка зміна документа (команда, чужа правка) → звірка. Штатний onChange Slate.
  const { onChange } = full;
  full.onChange = (options) => {
    onChange(options);
    if (full.children.some((line, ln) => madeFrom[ln] !== line) || full.children.length !== madeFrom.length) sync();
  };

  /** Курсор (виділення) видимого → у документ: команди виконуються там. */
  const mirrorSelection = () => {
    const sel = view.selection;
    if (sel) Transforms.select(full, { anchor: toFull(sel.anchor), focus: toFull(sel.focus) });
  };

  // ── 4. ДРУК: та сама операція в обох деревах ─────────────────────────────
  // Видиме вже показало символ — рядок не перемальовується, курсор не смикається.
  const { apply } = view;
  view.apply = (op) => {
    if (syncing) return apply(op);
    if (op.type === "set_selection") {
      apply(op);
      mirrorSelection();
      return;
    }
    if (op.type === "insert_text" || op.type === "remove_text") {
      const at = toFull({ path: op.path, offset: op.offset });
      apply(op);
      full.apply({ ...op, path: at.path, offset: at.offset });
      madeFrom[op.path[0]] = full.children[op.path[0]]; // видиме вже збігається з документом
      const what = op.type === "insert_text" ? `друк «${op.text}»` : `стерто «${op.text}»`;
      log(`${what}: видиме ${show({ path: op.path, offset: op.offset })} → документ ${show(at)}, та сама операція`);
      return;
    }
    apply(op);
  };

  // ── 5. КОМАНДИ: усе структурне виконується в документі, не у видимому ──────
  // Правила (Enter ділить рядок, Backspace склеює…) живуть у документі; видиме
  // лише показує результат після звірки.
  const command = (name: string, run: () => void) => {
    mirrorSelection();
    log(`команда «${name}» → виконується в документі`);
    run();
    sync();
  };
  view.insertBreak = () => command("Enter", () => Editor.insertBreak(full));
  view.deleteBackward = (unit) => command("Backspace", () => Editor.deleteBackward(full, { unit }));
  view.deleteForward = (unit) => command("Delete", () => Editor.deleteForward(full, { unit }));
  view.deleteFragment = (options) => command("стерти виділене", () => Editor.deleteFragment(full, options));

  sync();

  return {
    setShowChords(value: boolean) {
      showChords = value;
      madeFrom = []; // склад доріжок змінився — перебудувати всі рядки
      log(value ? "показ: акорди + слова" : "показ: лише слова");
      sync();
    },
  };
}
