/**
 * PROTOTYPE (гілка `prototype/segments-lanes`) — викинути після оцінки ADR-0006.
 * Маршрут: `/prototype/segments-lanes`. Усе в памʼяті, жодного сервера.
 *
 * Ітерація 4 (2026-10-10): два дерева — повне (Yjs) і видиме (лише вибрані
 * користувачем доріжки), мідлвер `laneView.ts`. Правити можна, бачачи
 * частину доріжок.
 * Ітерація 3 (2026-10-09): записничок без «рядків-кіборгів» — рядок
 * `[акорди, слова]`, чим він є, визначає вміст (порожній — не відрізок,
 * `/текст` — структурна примітка). Динаміки, заголовка, нумерації немає.
 * Ітерація 2: акорди — текстова доріжка, не на буквах слів.
 * Ітерація 1 (акорди на буквах) — у `splitMerge.prototype.test.ts` і git.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createEditor, Editor, Element, Node, NodeEntry, Range, Text, Transforms } from "slate";
import { Editable, ReactEditor, RenderElementProps, RenderLeafProps, Slate, useSlateStatic, withReact } from "slate-react";
import { flush, Pair, Peer, removeSegment, setSegmentProps } from "./harness";
import { CAJON_STEPS, cajonKey, cajonOf, inherited } from "./model";
import { LaneNoteView, laneNotes, makeLanesPair, resolveLaneNotes, TextMark, textMark, textMarks, transposeLine } from "./lanesModel";
import { LaneType, lanePath, laneText, lineKind } from "./textLanes";
import { createLaneView, toFullPoint, toViewPoint } from "./laneView";

type Who = "A" | "B";
const NAMES: Record<Who, string> = { A: "Оля", B: "Герман" };
const other = (w: Who): Who => (w === "A" ? "B" : "A");
type Display = { words: boolean; chords: boolean; cajon: boolean; semis: number };
// Кахон за замовчуванням схований: це доріжка музиканта, а не частина записничка.
const DEFAULT_DISPLAY: Display = { words: true, chords: true, cajon: false, semis: 0 };
const LANE_LABEL: Record<LaneType | "cajon", string> = { words: "слова", chords: "акорди", cajon: "кахон" };

const newId = () => Math.random().toString(36).slice(2, 7);

type PaneCtx = {
  who: Who;
  peer: Peer;
  notes: LaneNoteView[];
  display: Display;
  otherHere: number | null;
  /** рядок (у повному дереві), де мій курсор */
  myLine: number | null;
  /** видимий рядок → рядок повного дерева */
  lines: number[];
};
const Ctx = createContext<PaneCtx | null>(null);
const usePane = () => useContext(Ctx)!;

// ── сторінка ───────────────────────────────────────────────────────────────

export default function SegmentsLanesPrototype() {
  const [gen, setGen] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // Повні дерева — невидимі (без React); видимі створює кожна панель.
  const pair = useMemo(() => makeLanesPair(() => createEditor()), [gen]);
  (window as unknown as { __proto_pair?: Pair }).__proto_pair = pair; // налагодження
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const [display, setDisplay] = useState<Record<Who, Display>>({ A: DEFAULT_DISPLAY, B: DEFAULT_DISPLAY });
  const [presence, setPresence] = useState<Record<Who, number | null>>({ A: null, B: null });
  const [scenario, setScenario] = useState<number | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    pair.A.doc.on("update", bump);
    pair.B.doc.on("update", bump);
    return () => {
      pair.A.doc.off("update", bump);
      pair.B.doc.off("update", bump);
    };
  }, [pair, bump]);

  const reset = () => {
    setGen((g) => g + 1);
    setDisplay({ A: DEFAULT_DISPLAY, B: DEFAULT_DISPLAY });
    setPresence({ A: null, B: null });
    setStep(0);
  };
  const ctx: ScenarioCtx = {
    pair,
    setDisplay: (who, d) => setDisplay((all) => ({ ...all, [who]: { ...all[who], ...d } })),
  };

  return (
    <div className="min-h-dvh text-stone-900 px-4 py-6" style={{ background: "#f8f5eb" }}>
      <div className="max-w-6xl mx-auto space-y-6">
        <style>{'@import url("https://fonts.googleapis.com/css2?family=Pangolin&display=swap");'}</style>
        <AskHost />
        <header className="space-y-2">
          <div className="text-xs font-semibold tracking-wider text-amber-700 uppercase">
            Прототип · викинути після оцінки · ADR-0006 · ітерація 4
          </div>
          <h1 className="text-2xl font-semibold">Відрізки й доріжки замість секцій</h1>
          <p className="text-stone-600 max-w-3xl">
            Пісня — записничок із рядків. Рядок зі словами чи акордами — <b>відрізок</b>: на ньому доріжки{" "}
            <b>акорди</b> і <b>слова</b> (два рядки тексту з курсором, акорди не привʼязані до букв) і{" "}
            <b>кахон</b> (клітинки, за замовчуванням схований). Порожній рядок — не відрізок. Рядок, що
            починається з <code>/</code>, — структурна примітка. Enter у словах — новий рядок: перша частина
            отримує все, друга — порожні доріжки. Нижче — два редактори на двох окремих копіях документа; вимкни
            мережу, щоб правки зійшлися пізніше.
          </p>
        </header>

        <Findings />

        <section className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              if (pair.online) pair.unlink();
              else pair.link();
              bump();
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              pair.online ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
            }`}
          >
            {pair.online ? "● Мережа є — натисни, щоб вимкнути" : `○ Мережі немає (у черзі ${pair.queued}) — увімкнути`}
          </button>
          <button onClick={reset} className="rounded-full px-4 py-1.5 text-sm border border-stone-300 bg-white">
            Почати пісню наново
          </button>
          <span className="text-xs text-stone-500">
            Галочки — що бачиш і правиш саме ти · Enter лише в словах · «/» — лише на початку порожнього рядка · примітка: виділи текст → «позначити»
          </span>
        </section>

        <Scenarios
          active={scenario}
          step={step}
          onPick={(i) => {
            reset();
            setScenario(i);
          }}
          onStep={(i) => {
            SCENARIOS[scenario!].steps[i].run(ctx);
            setStep(i + 1);
            bump();
          }}
          onRestart={reset}
        />

        <div className="grid md:grid-cols-2 gap-4" key={gen}>
          {(["A", "B"] as Who[]).map((who) => (
            <PeerPane
              key={who}
              who={who}
              pair={pair}
              display={display[who]}
              setDisplay={(d) => ctx.setDisplay(who, d)}
              otherHere={pair.online ? presence[other(who)] : null}
              onPresence={(seg) => setPresence((p) => (p[who] === seg ? p : { ...p, [who]: seg }))}
              bump={bump}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── панель учасника ────────────────────────────────────────────────────────

function PeerPane(props: {
  who: Who;
  pair: Pair;
  display: Display;
  setDisplay: (d: Partial<Display>) => void;
  otherHere: number | null;
  onPresence: (seg: number | null) => void;
  bump: () => void;
}) {
  const { who, pair, display } = props;
  const peer = pair[who];
  // Видиме дерево цього учасника: лише вибрані доріжки (ітерація 4).
  const handle = useMemo(
    () =>
      createLaneView(peer.editor as Parameters<typeof createLaneView>[0], display, {
        base: () => withReact(createEditor()),
        afterFullChange: () => flush(peer),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [peer],
  );
  useEffect(() => handle.setDisplay({ words: display.words, chords: display.chords }), [handle, display.words, display.chords]);
  const view = handle.view;
  const proj = handle.projection();
  const notes = resolveLaneNotes(peer, display);
  const [pending, setPending] = useState<TextMark[]>([]);

  // Діапазони приміток живуть у повному дереві — перекладаємо у видиме.
  const ranges = notes.flatMap((n) =>
    n.marks.flatMap((m) => {
      if (!m.range) return [];
      const a = toViewPoint(peer.editor, proj, m.range.anchor);
      const f = toViewPoint(peer.editor, proj, m.range.focus);
      return a && f ? [{ anchor: a, focus: f }] : [];
    }),
  );
  const decorate = useCallback(
    ([node, path]: NodeEntry) => {
      if (!Text.isText(node)) return [];
      const lane = (Node.parent(view, path) as unknown as { type: string }).type;
      const slash =
        lane === "words" && node.text.startsWith("/")
          ? [{ anchor: { path, offset: 0 }, focus: { path, offset: 1 }, slash: true }]
          : [];
      return [
        ...slash,
        ...ranges
          .map((r) => Range.intersection(r, Editor.range(view, path)))
          .filter((r): r is Range => !!r && !Range.isCollapsed(r))
          .map((r) => ({ ...r, noted: true })),
      ];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(ranges), view],
  );

  const fullRange = (r: Range) => ({ anchor: toFullPoint(peer.editor, proj, r.anchor), focus: toFullPoint(peer.editor, proj, r.focus) });
  const markSelection = () => {
    const sel = view.selection;
    const ms = sel ? textMarks(peer, fullRange(sel), display) : [];
    if (!ms.length) return void ask("Виділи текст — можна через кілька рядків.", null);
    setPending((p) => [...p, ...ms]);
  };
  const createNote = async () => {
    if (!pending.length) return void ask("Спершу позначи виділений текст (можна кілька разів, у різних доріжках).", null);
    const text = await ask(`Текст примітки (позначено: ${pending.map((m) => `«${m.quote}»`).join(", ")})`, "");
    if (!text) return;
    const id = newId();
    laneNotes(peer).set(id, { id, text, author: NAMES[who], marks: pending });
    setPending([]);
  };

  const myLine = view.selection ? proj.lines[view.selection.anchor.path[0]] ?? null : null;

  return (
    <Ctx.Provider value={{ who, peer, notes, display, otherHere: props.otherHere, myLine, lines: proj.lines }}>
      <div className="rounded-xl border border-stone-200 shadow-sm overflow-hidden" style={{ background: "#fdfbf0" }}>
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-stone-200/70 bg-stone-100/40">
          <span className="font-semibold">{NAMES[who]}</span>
          <span className="text-xs text-stone-400">моя копія</span>
          <span className="flex-1" />
          {(["chords", "words", "cajon"] as const).map((lane) => (
            <label key={lane} className="text-xs flex items-center gap-1">
              <input type="checkbox" checked={display[lane]} onChange={(e) => props.setDisplay({ [lane]: e.target.checked })} />
              {LANE_LABEL[lane]}
            </label>
          ))}
          <span className="text-xs flex items-center gap-1">
            тон
            <button className="px-1 border rounded" onClick={() => props.setDisplay({ semis: display.semis - 1 })}>
              −
            </button>
            {display.semis > 0 ? `+${display.semis}` : display.semis}
            <button className="px-1 border rounded" onClick={() => props.setDisplay({ semis: display.semis + 1 })}>
              +
            </button>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-1.5 border-b border-stone-100 text-xs">
          <button onMouseDown={(e) => e.preventDefault()} onClick={markSelection} className="rounded border px-2 py-0.5">
            позначити виділене{pending.length ? ` (${pending.length})` : ""}
          </button>
          <button onClick={createNote} className="rounded border border-amber-400 bg-amber-50 px-2 py-0.5">
            + примітка
          </button>
          {pending.length > 0 && (
            <button className="text-stone-400" onClick={() => setPending([])}>
              скинути позначки
            </button>
          )}
        </div>

        <div className="px-4 py-3">
          <Slate
            editor={view as unknown as ReactEditor}
            initialValue={view.children}
            onChange={() => {
              const sel = view.selection;
              props.onPresence(sel ? handle.projection().lines[sel.anchor.path[0]] ?? null : null);
              props.bump();
            }}
          >
            <Editable renderElement={(p) => <LanesElement {...p} />} renderLeaf={Leaf} decorate={decorate} className="outline-none" />
          </Slate>
        </div>

        <StatePanel peer={peer} notes={notes} />
      </div>
    </Ctx.Provider>
  );
}

function Leaf({ attributes, children, leaf }: RenderLeafProps) {
  const { noted, slash } = leaf as { noted?: boolean; slash?: boolean };
  return (
    <span
      {...attributes}
      className={noted ? "bg-amber-100 underline decoration-amber-500 decoration-2 underline-offset-4" : ""}
      style={slash ? { opacity: 0.35 } : undefined}
    >
      {children}
    </span>
  );
}

function LanesElement(props: RenderElementProps) {
  const type = (props.element as unknown as { type: string }).type;
  if (type === "line") return <LineElement {...props} />;
  return <TextLane {...props} lane={type as LaneType} />;
}

// ── рядок записничка ───────────────────────────────────────────────────────

/** Стилі бойового редактора: папір, лінійки, чорнило. */
const RULE = "inset 0 -1px 0 0 rgba(120, 95, 50, 0.18)";
const INK = { words: "#1e3a8a", chords: "#3b82f6" };

/** Номер рядка в повному дереві для вузла видимого дерева (−1 — вузол щойно зник). */
function useFullLine(element: Element) {
  const pane = usePane();
  const editor = useSlateStatic();
  try {
    return pane.lines[ReactEditor.findPath(editor, element)[0]] ?? -1;
  } catch {
    return -1;
  }
}

function LineElement({ attributes, children, element }: RenderElementProps) {
  const pane = usePane();
  const ln = useFullLine(element);
  const kind = ln < 0 ? "empty" : lineKind(pane.peer.editor, ln);
  const cards = pane.notes.filter((n) => n.cardAt === ln);
  const otherHere = pane.otherHere === ln;
  return (
    <div
      {...attributes}
      data-kind={kind}
      className="relative"
      style={{ borderLeft: `3px solid ${otherHere ? "#7dd3fc" : "transparent"}` }}
      title={otherHere ? `тут пише ${NAMES[other(pane.who)]}` : undefined}
    >
      {cards.map((c) => (
        <NoteCard key={c.note.id} view={c} />
      ))}
      {children}
      {pane.display.cajon && kind === "segment" && <CajonLane index={ln} />}
    </div>
  );
}

/** Доріжка є у видимому дереві — отже її видно й можна правити (крім транспонування). */
function TextLane({ attributes, children, element, lane }: RenderElementProps & { lane: LaneType }) {
  const pane = usePane();
  const text = Node.string(element);
  const ln = useFullLine(element);
  const kind = ln < 0 ? "empty" : lineKind(pane.peer.editor, ln);
  const transposed = lane === "chords" && pane.display.semis !== 0;
  const note = lane === "words" && kind === "note";
  return (
    <div
      {...attributes}
      className="relative whitespace-pre"
      style={{
        paddingLeft: 16,
        fontSize: 16,
        lineHeight: 1.6,
        minHeight: "1.6em",
        boxShadow: RULE,
        color: INK[lane],
        fontWeight: lane === "chords" || note ? 700 : 500,
        letterSpacing: note ? "0.01em" : undefined,
      }}
    >
      {transposed && (
        <div contentEditable={false} className="select-none" title="транспоновано — лише показ, правити при тоні 0">
          {transposeLine(text, pane.display.semis) || " "}
        </div>
      )}
      <div contentEditable={transposed ? false : undefined} style={transposed ? { display: "none" } : undefined}>
        {children}
      </div>
      {!transposed && lane === "chords" && text === "" && (kind !== "empty" || pane.myLine === ln) && (
        <span
          contentEditable={false}
          className="absolute left-4 top-0 italic text-sm font-normal select-none pointer-events-none"
          style={{ color: "rgba(59,130,246,0.45)" }}
        >
          акорди…
        </span>
      )}
    </div>
  );
}

const CAJON_CYCLE = ["", "B", "t", "S"];

function CajonLane({ index }: { index: number }) {
  const pane = usePane();
  const nodes = pane.peer.editor.children;
  const own = nodes[index] ? cajonOf(nodes[index]) : {};
  const empty = Object.keys(own).length === 0;
  const inh = empty
    ? inherited(nodes, index, (n) => {
        const c = cajonOf(n);
        return Object.keys(c).length ? c : undefined;
      })
    : undefined;
  const shown = empty ? inh?.value ?? {} : own;
  return (
    <div
      contentEditable={false}
      className="flex items-center gap-1 py-0.5 select-none"
      style={{ paddingLeft: 16, boxShadow: RULE }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <span className="text-[10px] text-stone-400 w-10">кахон</span>
      {CAJON_STEPS.map((s) => (
        <button
          key={s}
          onClick={() => {
            const next = CAJON_CYCLE[(CAJON_CYCLE.indexOf(own[s] ?? "") + 1) % CAJON_CYCLE.length];
            setSegmentProps(pane.peer, index, { [cajonKey(s)]: next || null });
          }}
          className={`w-6 h-5 text-[11px] font-mono rounded border ${
            own[s] ? "bg-stone-800 text-white border-stone-800" : shown[s] ? "text-stone-300 border-dashed" : "border-stone-200"
          } ${s === 5 ? "ml-1.5" : ""}`}
        >
          {shown[s] ?? "·"}
        </button>
      ))}
      {empty && inh && <span className="text-[10px] italic text-stone-400 ml-1">sim. (як у #{inh.from})</span>}
    </div>
  );
}

function NoteCard({ view }: { view: LaneNoteView }) {
  const pane = usePane();
  return (
    <div
      contentEditable={false}
      className="my-1 ml-4 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-sm select-none"
      style={{ fontFamily: "Pangolin, cursive", color: "#7c4a03" }}
    >
      <b>{view.note.author}:</b> {view.note.text}{" "}
      <span className="text-stone-500">
        ({view.marks.map((m) => `${LANE_LABEL[m.mark.lane]} «${m.mark.quote}»${m.lost ? " — втрачено" : ""}`).join("; ")})
      </span>
      <button className="ml-2 text-stone-400" onClick={() => laneNotes(pane.peer).delete(view.note.id)}>
        ×
      </button>
    </div>
  );
}

// ── стан документа ─────────────────────────────────────────────────────────

const KIND_LABEL = { segment: "відрізок", empty: "порожній", note: "примітка" } as const;

function StatePanel({ peer, notes }: { peer: Peer; notes: LaneNoteView[] }) {
  return (
    <details className="border-t border-stone-200/70 bg-stone-100/40 px-4 py-2 text-xs">
      <summary className="cursor-pointer text-stone-500 font-medium">Що лежить у документі</summary>
      <table className="w-full mt-2 font-mono">
        <tbody>
          {peer.editor.children.map((n, i) => {
            const el = n as Element;
            const props = Object.entries(n).filter(([k]) => !["type", "children"].includes(k));
            const lanes = el.children.map((c) => (c as unknown as { type: string }).type);
            const dup = lanes.length !== new Set(lanes).size;
            return (
              <tr key={i} className="align-top border-b border-stone-200/60">
                <td className="pr-2 text-stone-400">{i}</td>
                <td className="pr-2 text-stone-500">{KIND_LABEL[lineKind(peer.editor, i)]}</td>
                <td className="pr-2 whitespace-pre">
                  <div className="text-blue-500">{laneText(peer.editor, i, "chords") || "·"}</div>
                  <div className="text-blue-900">{laneText(peer.editor, i, "words") || "·"}</div>
                </td>
                <td className={`pr-2 ${dup ? "text-rose-700 font-bold" : "hidden"}`}>{lanes.join("+")}</td>
                <td className="text-stone-500">{props.map(([k, v]) => `${k}=${String(v)}`).join(" ")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {notes.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {notes.map((n) => (
            <li key={n.note.id}>
              примітка «{n.note.text}»:{" "}
              {n.status === "visible" ? `картка над рядком ${n.cardAt}` : n.status === "hidden" ? "схована (її доріжки приховані)" : "втрачена"}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

// ── підсумок ───────────────────────────────────────────────────────────────

function Findings() {
  return (
    <details className="rounded-xl border border-stone-200 bg-white/60 p-4 text-sm">
      <summary className="cursor-pointer font-semibold">Що показав прототип (ітерації 1–3)</summary>
      <ul className="list-disc pl-5 mt-2 space-y-1 text-stone-700">
        <li>
          <b>Записничок без кіборгів.</b> Рядок не має кнопок, номерів, динаміки чи заголовка. Чим він є,
          визначає вміст: порожній — не відрізок, <code>/текст</code> — структурна примітка, решта — відрізок.
          Рядок акордів показується, лише коли в ньому щось є або там курсор.
        </li>
        <li>
          <b>Enter і Backspace прості й зворотні.</b> Перша частина отримує все, друга — порожні доріжки; злиття
          дописує акорди другого вирівняними під кінець слів першого.
        </li>
        <li>
          <b>Правки акордів і слів не заважають одна одній</b> — навіть коли один ділить рядок, а другий править його
          акорди.
        </li>
        <li>
          <b>Слова зʼїжджають під акордами</b>: дописав «О, » на початку — акорди стоять на своїх колонках. Ціна того,
          що акорди не привʼязані до букв.
        </li>
        <li className="text-rose-800">
          <b>Двоє тиснуть Enter в одному рядку (без мережі) — хвіст слів задвоюється.</b>
        </li>
        <li className="text-rose-800">
          <b>Один склеює рядки, другий пише в другий — набране другим зникає</b> (і слова, і акорди).
        </li>
        <li>
          Як і раніше: ділення під час набору в хвіст — набране опиняється в кінці першої частини; видалення рядка
          перемагає набір у ньому. Ці ризики — від того, як @slate-yjs ділить і склеює вузли; нинішній редактор має
          їх так само.
        </li>
      </ul>
    </details>
  );
}

// ── сценарії ───────────────────────────────────────────────────────────────

type ScenarioCtx = { pair: Pair; setDisplay: (who: Who, d: Partial<Display>) => void };
type Scenario = { title: string; what: string; watch: string; steps: { label: string; run: (c: ScenarioCtx) => void }[] };

function enter(p: Peer, ln: number, offset: number | "end") {
  const at = offset === "end" ? laneText(p.editor, ln, "words").length : offset;
  Transforms.select(p.editor, { path: [ln, 1, 0], offset: at });
  Editor.insertBreak(p.editor);
  flush(p);
}
function backspace(p: Peer, ln: number) {
  Transforms.select(p.editor, { path: [ln, 1, 0], offset: 0 });
  Editor.deleteBackward(p.editor, { unit: "character" });
  flush(p);
}
function typeIn(p: Peer, ln: number, lane: LaneType, offset: number | "end", text: string) {
  const path = [...lanePath(p.editor, ln, lane), 0];
  const at = offset === "end" ? laneText(p.editor, ln, lane).length : offset;
  Transforms.insertText(p.editor, text, { at: { path, offset: at } });
  flush(p);
}
function eraseIn(p: Peer, ln: number, lane: LaneType, from: number, to: number) {
  const path = [...lanePath(p.editor, ln, lane), 0];
  Transforms.delete(p.editor, { at: { anchor: { path, offset: from }, focus: { path, offset: to } } });
  flush(p);
}
function markText(p: Peer, ln: number, lane: LaneType, from: number, to: number) {
  const path = [...lanePath(p.editor, ln, lane), 0];
  return textMark(p, { anchor: { path, offset: from }, focus: { path, offset: to } })!;
}

const offline = { label: "Вимкнути мережу", run: (c: ScenarioCtx) => c.pair.unlink() };
const online = { label: "Увімкнути мережу — правки зустрічаються", run: (c: ScenarioCtx) => c.pair.link() };
const olyaEnter = { label: "Оля: Enter перед «Господь»", run: (c: ScenarioCtx) => enter(c.pair.A, 1, 11) };

const SCENARIOS: Scenario[] = [
  {
    title: "Enter посеред рядка",
    what: "Оля ставить курсор перед «Господь» і тисне Enter.",
    watch:
      "Рядок акордів лишається першій частині; над «Господь» акордів немає — рядок акордів зʼявиться, лише якщо поставити туди курсор.",
    steps: [olyaEnter],
  },
  {
    title: "Enter, а потім Backspace",
    what: "Ділимо рядок і одразу склеюємо назад.",
    watch: "Має вийти рівно те, що було.",
    steps: [olyaEnter, { label: "Оля: Backspace на початку «Господь»", run: (c) => backspace(c.pair.A, 2) }],
  },
  {
    title: "Склеїти два рядки з акордами",
    what: "Оля тисне Backspace на початку «Твоє світло…».",
    watch: "Акорди другого рядка дописуються в кінець першого, вирівняні під кінець його слів.",
    steps: [{ label: "Оля: Backspace на початку «Твоє світло…»", run: (c) => backspace(c.pair.A, 2) }],
  },
  {
    title: "Порожній рядок і /примітка",
    what: "Оля тисне Enter у кінці «Твоє світло…», пише в новому рядку «/Міст», потім стирає «/».",
    watch: "Порожній рядок — не відрізок (у таблиці «порожній»). З «/» — структурна примітка, без рядка акордів. Без «/» — звичайний відрізок «Міст».",
    steps: [
      { label: "Оля: Enter у кінці «Твоє світло…»", run: (c) => enter(c.pair.A, 2, "end") },
      { label: "Оля: пише «/Міст»", run: (c) => typeIn(c.pair.A, 3, "words", 0, "/Міст") },
      { label: "Оля: стирає «/»", run: (c) => eraseIn(c.pair.A, 3, "words", 0, 1) },
    ],
  },
  {
    title: "Ділення, поки інший пише акорди",
    what: "Без мережі Оля ділить рядок «Ти святий, Господь», а Герман дописує « D» у його акорди.",
    watch: "Правка Германа ціла й лишається першій частині — акорди й слова не заважають одне одному.",
    steps: [offline, olyaEnter, { label: "Герман: дописує « D» в акорди", run: (c) => typeIn(c.pair.B, 1, "chords", "end", " D") }, online],
  },
  {
    title: "Ділення, поки інший пише слова",
    what: "Без мережі Оля ділить рядок, а Герман дописує «, Царю» в кінець «…Господь».",
    watch: "«, Царю» опиняється в кінці ПЕРШОЇ частини («Ти святий, , Царю»), а не після «Господь».",
    steps: [offline, olyaEnter, { label: "Герман: дописує «, Царю» в кінець", run: (c) => typeIn(c.pair.B, 1, "words", "end", ", Царю") }, online],
  },
  {
    title: "Двоє тиснуть Enter",
    what: "Без мережі обоє ставлять курсор перед «Господь» і тиснуть Enter.",
    watch: "«Господь» задвоюється — два рядки з тим самим словом.",
    steps: [offline, olyaEnter, { label: "Герман: Enter перед «Господь»", run: (c) => enter(c.pair.B, 1, 11) }, online],
  },
  {
    title: "Склеїли, поки інший пише",
    what: "Без мережі Оля склеює «Твоє світло…» з попереднім рядком, а Герман дописує туди « ясне» і акорд «Dm ».",
    watch: "Набране Германом зникає — і слова, і акорди.",
    steps: [
      offline,
      { label: "Оля: Backspace на початку «Твоє світло…»", run: (c) => backspace(c.pair.A, 2) },
      {
        label: "Герман: пише в слова й акорди «Твоє світло…»",
        run: (c) => {
          typeIn(c.pair.B, 2, "words", 4, " ясне");
          typeIn(c.pair.B, 2, "chords", 0, "Dm ");
        },
      },
      online,
    ],
  },
  {
    title: "Видалили рядок, поки інший пише",
    what: "Без мережі Герман дописує в «Ти святий, Господь», а Оля цей рядок видаляє.",
    watch: "Видалення перемагає: набране Германом зникає разом із рядком.",
    steps: [
      offline,
      { label: "Герман: дописує «, Царю» в кінець", run: (c) => typeIn(c.pair.B, 1, "words", "end", ", Царю") },
      { label: "Оля: видаляє рядок", run: (c) => removeSegment(c.pair.A, 1) },
      online,
    ],
  },
  {
    title: "Дописали слова — акорди стоять",
    what: "Герман дописує «О, » на початку «Ти святий, Господь».",
    watch: "Акорди лишаються на своїх колонках, слова зʼїжджають під ними — вирівнювати справа людини.",
    steps: [{ label: "Герман: «О, » на початку", run: (c) => typeIn(c.pair.B, 1, "words", 0, "О, ") }],
  },
  {
    title: "Кахон: двоє в ту саму клітинку",
    what: "У «Твоє світло…» кахону немає (sim.). Без мережі Оля і Герман водночас починають його писати.",
    watch: "Доріжка не двоїться: кожна клітинка — один ключ, на спільній перемагає хтось один.",
    steps: [
      {
        label: "Обоє вмикають показ кахону",
        run: (c) => {
          c.setDisplay("A", { cajon: true });
          c.setDisplay("B", { cajon: true });
        },
      },
      offline,
      { label: "Оля: B на долю 1 і 3", run: (c) => setSegmentProps(c.pair.A, 2, { [cajonKey(1)]: "B", [cajonKey(3)]: "B" }) },
      { label: "Герман: t на долю 3 і 7", run: (c) => setSegmentProps(c.pair.B, 2, { [cajonKey(3)]: "t", [cajonKey(7)]: "t" }) },
      online,
    ],
  },
  {
    title: "Примітка на акордах і словах",
    what: "Оля лишає примітку на акордах «C       G» і словах «Господь». Далі Герман транспонує й ховає доріжки, а Оля стирає позначене.",
    watch: "Картка переживає транспонування; ховається, лише коли сховані ВСІ її доріжки; втрачається, коли зникло все позначене.",
    steps: [
      {
        label: "Оля: примітка «тут тихо» на «C       G» і «Господь»",
        run: (c) => {
          const p = c.pair.A;
          const id = newId();
          laneNotes(p).set(id, {
            id,
            text: "тут тихо",
            author: "Оля",
            marks: [markText(p, 1, "chords", 19, 28), markText(p, 1, "words", 11, 18)],
          });
        },
      },
      { label: "Герман: транспонує собі на +2", run: (c) => c.setDisplay("B", { semis: 2 }) },
      { label: "Герман: ховає акорди", run: (c) => c.setDisplay("B", { chords: false }) },
      { label: "Герман: ховає ще й слова", run: (c) => c.setDisplay("B", { words: false }) },
      { label: "Герман: показує все", run: (c) => c.setDisplay("B", { words: true, chords: true, semis: 0 }) },
      { label: "Оля: стирає «Господь»", run: (c) => eraseIn(c.pair.A, 1, "words", 11, 18) },
      { label: "Оля: стирає «C       G»", run: (c) => eraseIn(c.pair.A, 1, "chords", 19, 28) },
    ],
  },
];

function Scenarios(props: {
  active: number | null;
  step: number;
  onPick: (i: number) => void;
  onStep: (i: number) => void;
  onRestart: () => void;
}) {
  const s = props.active == null ? null : SCENARIOS[props.active];
  return (
    <section className="rounded-xl border border-stone-200 bg-white">
      <div className="flex flex-wrap gap-1 border-b border-stone-100 p-2">
        <span className="text-xs text-stone-500 self-center px-2">Сценарії:</span>
        {SCENARIOS.map((sc, i) => (
          <button
            key={i}
            onClick={() => props.onPick(i)}
            className={`text-xs rounded-full px-3 py-1 ${i === props.active ? "bg-stone-900 text-white" : "bg-stone-100 hover:bg-stone-200"}`}
          >
            {sc.title}
          </button>
        ))}
      </div>
      {s && (
        <div className="p-4 space-y-3 text-sm">
          <p>{s.what}</p>
          <p className="text-stone-500">
            <b>Дивись:</b> {s.watch}
          </p>
          <ol className="flex flex-wrap gap-2">
            {s.steps.map((st, i) => (
              <li key={i}>
                <button
                  disabled={i !== props.step}
                  onClick={() => props.onStep(i)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    i < props.step
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : i === props.step
                        ? "border-amber-600 bg-amber-600 text-white"
                        : "border-stone-200 text-stone-400"
                  }`}
                >
                  {i + 1}. {st.label}
                </button>
              </li>
            ))}
            {props.step >= s.steps.length && (
              <li>
                <button onClick={props.onRestart} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm">
                  ↺ ще раз
                </button>
              </li>
            )}
          </ol>
        </div>
      )}
    </section>
  );
}

// ── вікно введення (prompt/confirm у вбудованих браузерах і PWA не працюють) ──

type AskState = { question: string; value: string | null; resolve: (v: string | null) => void };
let openAsk: ((s: AskState) => void) | null = null;

/** `initial === null` — питання без поля (OK/Скасувати); OK повертає "". */
function ask(question: string, initial: string | null): Promise<string | null> {
  return new Promise((resolve) => openAsk?.({ question, value: initial, resolve }));
}

function AskHost() {
  const [state, setState] = useState<AskState | null>(null);
  useEffect(() => {
    openAsk = setState;
    return () => {
      openAsk = null;
    };
  }, []);
  if (!state) return null;
  const done = (v: string | null) => {
    state.resolve(v);
    setState(null);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onMouseDown={() => done(null)}>
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          done(state.value ?? "");
        }}
        className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl space-y-3"
      >
        <div className="text-sm">{state.question}</div>
        {state.value !== null && (
          <input
            autoFocus
            value={state.value}
            onChange={(e) => setState({ ...state, value: e.target.value })}
            className="w-full rounded border border-stone-300 px-2 py-1.5 font-mono"
          />
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => done(null)} className="rounded px-3 py-1 text-sm border border-stone-300">
            Скасувати
          </button>
          <button type="submit" autoFocus={state.value === null} className="rounded px-3 py-1 text-sm bg-amber-600 text-white">
            OK
          </button>
        </div>
      </form>
    </div>
  );
}
