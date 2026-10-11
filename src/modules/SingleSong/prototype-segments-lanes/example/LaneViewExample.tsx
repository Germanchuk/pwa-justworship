/**
 * Маршрут `/prototype/lane-view-example` — мінімальний приклад мідлвера.
 * Один редактор, два рядки. Ліворуч — те, що бачить користувач; праворуч —
 * документ; знизу — журнал: що мідлвер зробив на кожну дію.
 */
import { useMemo, useState } from "react";
import { createEditor, Descendant, Element, Node, Transforms } from "slate";
import { Editable, RenderElementProps, Slate, withReact } from "slate-react";
import { line, withTextLanes } from "../lanes/textLanes";
import { createMiniLaneView } from "./miniLaneView";

const SONG = [line("Ти святий, Господь", "Am      F       C"), line("Твоє світло серед ночі", "F       C       G")];

export default function LaneViewExample() {
  const [entries, setEntries] = useState<string[]>([]);
  const [showChords, setShowChords] = useState(true);
  const [, rerender] = useState(0);

  const { full, view, mini, log } = useMemo(() => {
    const full = withTextLanes(createEditor());
    full.children = SONG as unknown as Descendant[];
    const view = withReact(createEditor());
    const log = (message: string) => setEntries((all) => [message, ...all].slice(0, 30));
    const mini = createMiniLaneView(full, view, log);
    return { full, view, mini, log };
  }, []);

  /** Чужа правка: змінюємо документ напряму, повз видиме (так приходять правки з мережі). */
  const foreign = (ln: number, lane: number, text: string) => {
    const path = [ln, lane, 0];
    log(`ЧУЖА ПРАВКА в документі: «${text.trim()}» у ${lane === 0 ? "акорди" : "слова"} рядка ${ln + 1}`);
    Transforms.insertText(full, text, { at: { path, offset: Node.string(Node.get(full, path)).length } });
    rerender((v) => v + 1);
  };

  return (
    <div className="min-h-dvh px-4 py-6 text-stone-900" style={{ background: "#f8f5eb" }}>
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-xl font-semibold">Мідлвер: документ ↔ те, що бачить користувач</h1>
        <p className="text-sm text-stone-600">
          Код — <code>example/miniLaneView.ts</code>. Друкуй, тисни Enter і Backspace, вимикай акорди, натискай
          «чужу правку» — і дивись журнал.
        </p>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={showChords}
              onChange={(e) => {
                setShowChords(e.target.checked);
                mini.setShowChords(e.target.checked);
              }}
            />
            показувати акорди
          </label>
          <button className="rounded border border-stone-300 bg-white px-2 py-1" onClick={() => foreign(1, 1, " навіки")}>
            Чужа правка: « навіки» в кінець слів рядка 2
          </button>
          <button className="rounded border border-stone-300 bg-white px-2 py-1" onClick={() => foreign(0, 0, "   D")}>
            Чужа правка: « D» в кінець акордів рядка 1
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-stone-200 bg-white/70 p-3">
            <h2 className="mb-2 text-sm font-semibold text-stone-500">Що бачить користувач (видиме дерево)</h2>
            <Slate editor={view} initialValue={view.children} onChange={() => rerender((v) => v + 1)}>
              <Editable renderElement={renderElement} className="outline-none" />
            </Slate>
          </section>

          <section className="rounded-xl border border-stone-200 bg-white/70 p-3">
            <h2 className="mb-2 text-sm font-semibold text-stone-500">Документ (повне дерево — усі доріжки)</h2>
            <div className="space-y-2 whitespace-pre font-mono text-sm">
              {full.children.map((ln, i) => (
                <div key={i} className="rounded border border-stone-200 px-2 py-1">
                  <div className="text-[11px] text-stone-400">рядок {i + 1}</div>
                  {(ln as Element).children.map((lane, l) => {
                    const type = (lane as unknown as { type: string }).type;
                    const hidden = type === "chords" && !showChords;
                    return (
                      <div key={l} className={hidden ? "text-stone-300" : type === "chords" ? "text-blue-500" : "text-blue-900"}>
                        {type === "chords" ? "акорди" : "слова "} [{l}]: «{Node.string(lane)}»{hidden ? " — схована" : ""}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-stone-200 bg-white/70 p-3">
          <h2 className="mb-2 text-sm font-semibold text-stone-500">Журнал мідлвера (нові зверху)</h2>
          <ol className="space-y-0.5 font-mono text-xs text-stone-700">
            {entries.map((e, i) => (
              <li key={entries.length - i}>{e}</li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

function renderElement({ attributes, children, element }: RenderElementProps) {
  const type = (element as unknown as { type: string }).type;
  if (type === "line") {
    return (
      <div {...attributes} className="mb-1 border-b border-stone-200 pb-1">
        {children}
      </div>
    );
  }
  return (
    <div
      {...attributes}
      className={`whitespace-pre font-mono text-[15px] leading-6 ${type === "chords" ? "font-bold text-blue-500" : "text-blue-900"}`}
    >
      {children}
    </div>
  );
}
