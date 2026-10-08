/**
 * PROTOTYPE (гілка `prototype/segments-lanes`) — викинути після оцінки ADR-0006.
 * Маршрут: `/prototype/segments-lanes`. Усе в памʼяті, жодного сервера.
 *
 * Ітерація 2 (2026-10-09): акорди НЕ привʼязані до букв — це рядок тексту на
 * відрізку, своя доріжка з курсором, як слова. Enter у словах — новий
 * відрізок: перша частина отримує все, друга — порожні доріжки.
 * Ітерація 1 (акорди на буквах) — у `splitMerge.prototype.test.ts` і git.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createEditor, Editor, Element, Node, NodeEntry, Range, Text, Transforms } from "slate";
import { Editable, ReactEditor, RenderElementProps, RenderLeafProps, Slate, withReact } from "slate-react";
import { flush, Pair, Peer, removeSegment, setSegmentProps } from "./harness";
import { CAJON_STEPS, cajonKey, cajonOf, inherited } from "./model";
import { LaneNoteView, laneNotes, makeLanesPair, resolveLaneNotes, TextMark, textMark, transposeLine } from "./lanesModel";
import { LaneType, lanePath, laneText } from "./textLanes";

type Who = "A" | "B";
const NAMES: Record<Who, string> = { A: "Оля", B: "Герман" };
const other = (w: Who): Who => (w === "A" ? "B" : "A");
type Display = { words: boolean; chords: boolean; cajon: boolean; semis: number };
const DEFAULT_DISPLAY: Display = { words: true, chords: true, cajon: true, semis: 0 };
const LANE_LABEL: Record<LaneType | "cajon", string> = { words: "слова", chords: "акорди", cajon: "кахон" };

const newId = () => Math.random().toString(36).slice(2, 7);

type PaneCtx = { who: Who; peer: Peer; notes: LaneNoteView[]; display: Display; otherHere: number | null };
const Ctx = createContext<PaneCtx | null>(null);
const usePane = () => useContext(Ctx)!;

// ── сторінка ───────────────────────────────────────────────────────────────

export default function SegmentsLanesPrototype() {
  const [gen, setGen] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pair = useMemo(() => makeLanesPair(() => withReact(createEditor())), [gen]);
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
    <div className="min-h-dvh bg-stone-50 text-stone-900 px-4 py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <AskHost />
        <header className="space-y-2">
          <div className="text-xs font-semibold tracking-wider text-amber-700 uppercase">
            Прототип · викинути після оцінки · ADR-0006 · ітерація 2
          </div>
          <h1 className="text-2xl font-semibold">Відрізки й доріжки замість секцій</h1>
          <p className="text-stone-600 max-w-3xl">
            Пісня — ряд відрізків. На кожному доріжки: <b>акорди</b> і <b>слова</b> — два рядки тексту з курсором
            (акорди не привʼязані до букв), <b>кахон</b> — клітинки. Динаміка й заголовок — атрибути відрізка.
            Enter у словах — новий відрізок: перша частина отримує все, друга — порожні доріжки. Нижче — два
            редактори на двох окремих копіях документа; вимкни мережу, щоб правки зійшлися пізніше.
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
            Пиши прямо в рядках акордів і слів · Enter лише в словах · примітка: виділи текст → «позначити»
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
  const notes = resolveLaneNotes(peer, display);
  const [pending, setPending] = useState<TextMark[]>([]);

  const ranges = notes.flatMap((n) => n.marks.filter((m) => m.range && display[m.mark.lane]).map((m) => m.range!));
  const decorate = useCallback(
    ([node, path]: NodeEntry) => {
      if (!Text.isText(node)) return [];
      return ranges
        .map((r) => Range.intersection(r, Editor.range(peer.editor, path)))
        .filter((r): r is Range => !!r && !Range.isCollapsed(r))
        .map((r) => ({ ...r, noted: true }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(ranges), peer],
  );

  const markSelection = () => {
    const sel = peer.editor.selection;
    const m = sel && textMark(peer, sel);
    if (!m) return void ask("Виділи шматок тексту в одному рядку — акордів або слів.", null);
    setPending((p) => [...p, m]);
  };
  const createNote = async () => {
    if (!pending.length) return void ask("Спершу позначи виділений текст (можна кілька разів, у різних доріжках).", null);
    const text = await ask(`Текст примітки (позначено: ${pending.map((m) => `«${m.quote}»`).join(", ")})`, "");
    if (!text) return;
    const id = newId();
    laneNotes(peer).set(id, { id, text, author: NAMES[who], marks: pending });
    setPending([]);
  };

  return (
    <Ctx.Provider value={{ who, peer, notes, display, otherHere: props.otherHere }}>
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-stone-100 bg-stone-50">
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
            editor={peer.editor as unknown as ReactEditor}
            initialValue={peer.editor.children}
            onChange={() => {
              const sel = peer.editor.selection;
              props.onPresence(sel ? sel.anchor.path[0] : null);
              props.bump();
            }}
          >
            <Editable
              renderElement={(p) => <LanesElement {...p} />}
              renderLeaf={Leaf}
              decorate={decorate}
              className="outline-none space-y-1"
            />
          </Slate>
        </div>

        <StatePanel peer={peer} notes={notes} />
      </div>
    </Ctx.Provider>
  );
}

function Leaf({ attributes, children, leaf }: RenderLeafProps) {
  const noted = (leaf as { noted?: boolean }).noted;
  return (
    <span {...attributes} className={noted ? "bg-amber-100 underline decoration-amber-500 decoration-2 underline-offset-4" : ""}>
      {children}
    </span>
  );
}

function LanesElement(props: RenderElementProps) {
  const type = (props.element as unknown as { type: string }).type;
  if (type === "segment") return <SegmentElement {...props} />;
  return <TextLane {...props} lane={type as LaneType} />;
}

// ── відрізок ───────────────────────────────────────────────────────────────

function SegmentElement({ attributes, children, element }: RenderElementProps) {
  const pane = usePane();
  let index = -1;
  try {
    index = ReactEditor.findPath(pane.peer.editor as unknown as ReactEditor, element)[0];
  } catch {
    /* вузол щойно зник */
  }
  const node = element as unknown as Record<string, unknown>;
  const nodes = pane.peer.editor.children;
  const dyn = typeof node.dyn === "number" ? node.dyn : undefined;
  const dynInherited = dyn === undefined ? inherited(nodes, index, (n) => (n as { dyn?: number }).dyn) : undefined;
  const cards = pane.notes.filter((n) => n.cardAt === index);
  const otherName = NAMES[other(pane.who)];

  const remove = async () => {
    if (pane.otherHere === index && (await ask(`Тут зараз пише ${otherName}. Видалити відрізок?`, null)) === null) return;
    removeSegment(pane.peer, index);
  };
  const setDyn = (v: number | null) => setSegmentProps(pane.peer, index, { dyn: v });
  const base = dyn ?? dynInherited?.value ?? 3;

  return (
    <div
      {...attributes}
      className={`group relative rounded-md border px-2 py-1 ${node.heading ? "bg-stone-50" : ""} border-transparent hover:border-stone-200`}
    >
      {cards.map((c) => (
        <NoteCard key={c.note.id} view={c} />
      ))}
      <div contentEditable={false} className="flex items-center gap-2 text-[11px] text-stone-400 select-none">
        <span className="font-mono">#{index}</span>
        <button
          className={`px-1 rounded ${node.heading ? "bg-stone-800 text-white" : "border"}`}
          title="заголовок"
          onClick={() => setSegmentProps(pane.peer, index, { heading: node.heading ? null : true })}
        >
          H
        </button>
        <span className="flex items-center gap-1">
          <button className="px-1 border rounded" onClick={() => setDyn(Math.max(1, base - 1))}>
            −
          </button>
          {dyn !== undefined ? (
            <span className="text-stone-700">dyn {dyn}</span>
          ) : dynInherited ? (
            <span className="italic">dyn {dynInherited.value} (як у #{dynInherited.from})</span>
          ) : (
            <span className="italic">dyn —</span>
          )}
          <button className="px-1 border rounded" onClick={() => setDyn(Math.min(5, base + 1))}>
            +
          </button>
          {dyn !== undefined && (
            <button className="px-1" title="прибрати" onClick={() => setDyn(null)}>
              ×
            </button>
          )}
        </span>
        {pane.otherHere === index && <span className="rounded bg-sky-100 text-sky-800 px-1.5">✎ тут {otherName}</span>}
        <span className="flex-1" />
        <button className="opacity-0 group-hover:opacity-100 text-rose-600" onClick={remove}>
          видалити відрізок
        </button>
      </div>
      {children}
      {pane.display.cajon && <CajonLane index={index} />}
    </div>
  );
}

function TextLane({ attributes, children, element, lane }: RenderElementProps & { lane: LaneType }) {
  const pane = usePane();
  const text = Node.string(element);
  const shown = pane.display[lane];
  const transposed = lane === "chords" && pane.display.semis !== 0;
  let seg = -1;
  try {
    seg = ReactEditor.findPath(pane.peer.editor as unknown as ReactEditor, element)[0];
  } catch {
    /* */
  }
  const heading = !!(pane.peer.editor.children[seg] as { heading?: boolean } | undefined)?.heading;

  // Сховану доріжку і транспонований рядок лишаємо в DOM для Slate, але не показуємо.
  const hiddenStyle = { position: "absolute", opacity: 0, height: 0, overflow: "hidden", pointerEvents: "none" } as const;
  return (
    <div
      {...attributes}
      className={`relative font-mono text-[15px] leading-6 whitespace-pre ${
        lane === "chords" ? "text-amber-700 font-semibold min-h-6" : heading ? "font-bold uppercase tracking-wide" : ""
      }`}
    >
      {shown && transposed && (
        <div contentEditable={false} className="select-none" title="транспоновано — лише показ, правити при тоні 0">
          {transposeLine(text, pane.display.semis) || " "}
        </div>
      )}
      <div style={!shown || transposed ? hiddenStyle : undefined}>{children}</div>
      {shown && !transposed && text === "" && (
        <span
          contentEditable={false}
          className="absolute left-0 top-0 text-stone-300 italic text-xs font-normal select-none pointer-events-none"
        >
          {lane === "chords" ? "акорди порожні" : "слова порожні"}
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
    <div contentEditable={false} className="flex items-center gap-1 mt-1 select-none" onMouseDown={(e) => e.preventDefault()}>
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
    <div contentEditable={false} className="mb-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs select-none">
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

function StatePanel({ peer, notes }: { peer: Peer; notes: LaneNoteView[] }) {
  return (
    <details className="border-t border-stone-100 bg-stone-50/60 px-4 py-2 text-xs" open>
      <summary className="cursor-pointer text-stone-500 font-medium">Що лежить у документі</summary>
      <table className="w-full mt-2 font-mono">
        <tbody>
          {peer.editor.children.map((n, i) => {
            const el = n as Element;
            const props = Object.entries(n).filter(([k]) => !["type", "children"].includes(k));
            const lanes = el.children.map((c) => (c as unknown as { type: string }).type);
            const dup = lanes.length !== new Set(lanes).size;
            return (
              <tr key={i} className="align-top border-b border-stone-100">
                <td className="pr-2 text-stone-400">#{i}</td>
                <td className="pr-2 whitespace-pre">
                  <div className="text-amber-800">{laneText(peer.editor, i, "chords") || "·"}</div>
                  <div>{laneText(peer.editor, i, "words") || "·"}</div>
                </td>
                <td className={`pr-2 ${dup ? "text-rose-700 font-bold" : "text-stone-400"}`}>{lanes.join("+")}</td>
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
              {n.status === "visible" ? `картка над #${n.cardAt}` : n.status === "hidden" ? "схована (її доріжки приховані)" : "втрачена"}
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
    <details className="rounded-xl border border-stone-200 bg-white p-4 text-sm" open>
      <summary className="cursor-pointer font-semibold">Що показав прототип (ітерація 2)</summary>
      <ul className="list-disc pl-5 mt-2 space-y-1 text-stone-700">
        <li>
          <b>Enter і Backspace тепер прості й зворотні.</b> Перша частина отримує все, друга — порожні доріжки;
          злиття дописує акорди другого вирівняними під кінець слів першого. Enter → Backspace дає рівно те, що було.
        </li>
        <li>
          <b>Правки акордів і слів не заважають одна одній</b>: поки Оля ділить рядок, Герман спокійно править його
          акорди — правка ціла й лишається першій частині.
        </li>
        <li>
          <b>Слова зʼїжджають під акордами</b>: дописав «О, » на початку — акорди стоять на своїх колонках. Ціна того,
          що акорди не привʼязані до букв.
        </li>
        <li className="text-rose-800">
          <b>Двоє тиснуть Enter в одному рядку (без мережі) — хвіст слів задвоюється.</b> Кожен копіює хвіст у свій
          новий відрізок.
        </li>
        <li className="text-rose-800">
          <b>Оля склеює рядки, а Герман пише в другий — набране Германом зникає</b> (і в словах, і в акордах).
        </li>
        <li>
          Як і раніше: якщо Оля ділить рядок, а Герман пише в його хвіст, набране опиняється в кінці першої частини;
          видалення відрізка перемагає набір у ньому. Ці три проблеми — від того, як @slate-yjs ділить і склеює
          вузли, і нинішній редактор має їх так само.
        </li>
      </ul>
    </details>
  );
}

// ── сценарії ───────────────────────────────────────────────────────────────

type ScenarioCtx = { pair: Pair; setDisplay: (who: Who, d: Partial<Display>) => void };
type Scenario = { title: string; what: string; watch: string; steps: { label: string; run: (c: ScenarioCtx) => void }[] };

function enter(p: Peer, seg: number, offset: number) {
  Transforms.select(p.editor, { path: [seg, 1, 0], offset });
  Editor.insertBreak(p.editor);
  flush(p);
}
function backspace(p: Peer, seg: number) {
  Transforms.select(p.editor, { path: [seg, 1, 0], offset: 0 });
  Editor.deleteBackward(p.editor, { unit: "character" });
  flush(p);
}
function typeIn(p: Peer, seg: number, lane: LaneType, offset: number | "end", text: string) {
  const path = [...lanePath(p.editor, seg, lane), 0];
  const at = offset === "end" ? laneText(p.editor, seg, lane).length : offset;
  Transforms.insertText(p.editor, text, { at: { path, offset: at } });
  flush(p);
}
function eraseIn(p: Peer, seg: number, lane: LaneType, from: number, to: number) {
  const path = [...lanePath(p.editor, seg, lane), 0];
  Transforms.delete(p.editor, { at: { anchor: { path, offset: from }, focus: { path, offset: to } } });
  flush(p);
}
function markText(p: Peer, seg: number, lane: LaneType, from: number, to: number) {
  const path = [...lanePath(p.editor, seg, lane), 0];
  return textMark(p, { anchor: { path, offset: from }, focus: { path, offset: to } })!;
}

const offline = { label: "Вимкнути мережу", run: (c: ScenarioCtx) => c.pair.unlink() };
const online = { label: "Увімкнути мережу — правки зустрічаються", run: (c: ScenarioCtx) => c.pair.link() };
const olyaEnter = { label: "Оля: Enter перед «Господь» (#1)", run: (c: ScenarioCtx) => enter(c.pair.A, 1, 11) };

const SCENARIOS: Scenario[] = [
  {
    title: "Enter посеред рядка",
    what: "Оля ставить курсор перед «Господь» і тисне Enter.",
    watch:
      "Весь рядок акордів, динаміка й кахон лишаються першій частині; у «Господь» — порожні доріжки (кахон і динаміка показуються «як у #1»).",
    steps: [olyaEnter],
  },
  {
    title: "Enter, а потім Backspace",
    what: "Ділимо рядок і одразу склеюємо назад.",
    watch: "Має вийти рівно те, що було — і в словах, і в акордах, і в атрибутах.",
    steps: [olyaEnter, { label: "Оля: Backspace на початку «Господь» (#2)", run: (c) => backspace(c.pair.A, 2) }],
  },
  {
    title: "Склеїти два рядки з акордами",
    what: "Оля тисне Backspace на початку «Твоє світло…» (#2).",
    watch: "Акорди #2 дописуються в кінець рядка акордів #1, вирівняні під кінець слів #1. Кахон і динаміка — від #1.",
    steps: [{ label: "Оля: Backspace на початку #2", run: (c) => backspace(c.pair.A, 2) }],
  },
  {
    title: "Ділення, поки інший пише акорди",
    what: "Без мережі Оля ділить рядок #1, а Герман дописує « D» у рядок акордів #1.",
    watch: "Правка Германа ціла й лишається першій частині — акорди й слова не заважають одне одному.",
    steps: [
      offline,
      olyaEnter,
      { label: "Герман: дописує « D» в акорди #1", run: (c) => typeIn(c.pair.B, 1, "chords", "end", " D") },
      online,
    ],
  },
  {
    title: "Ділення, поки інший пише слова",
    what: "Без мережі Оля ділить рядок #1, а Герман дописує «, Царю» в кінець слів #1.",
    watch: "«, Царю» опиняється в кінці ПЕРШОЇ частини («Ти святий, , Царю»), а не після «Господь».",
    steps: [
      offline,
      olyaEnter,
      { label: "Герман: дописує «, Царю» в кінець слів #1", run: (c) => typeIn(c.pair.B, 1, "words", "end", ", Царю") },
      online,
    ],
  },
  {
    title: "Двоє тиснуть Enter",
    what: "Без мережі обоє ставлять курсор перед «Господь» і тиснуть Enter.",
    watch: "«Господь» задвоюється — два відрізки з тим самим словом.",
    steps: [offline, olyaEnter, { label: "Герман: Enter перед «Господь» (#1)", run: (c) => enter(c.pair.B, 1, 11) }, online],
  },
  {
    title: "Склеїли, поки інший пише",
    what: "Без мережі Оля склеює #2 з #1, а Герман дописує « ясне» в слова #2 і «Dm » в його акорди.",
    watch: "Набране Германом зникає — і слова, і акорди.",
    steps: [
      offline,
      { label: "Оля: Backspace на початку #2", run: (c) => backspace(c.pair.A, 2) },
      {
        label: "Герман: пише в слова й акорди #2",
        run: (c) => {
          typeIn(c.pair.B, 2, "words", 4, " ясне");
          typeIn(c.pair.B, 2, "chords", 0, "Dm ");
        },
      },
      online,
    ],
  },
  {
    title: "Видалили відрізок, поки інший пише",
    what: "Без мережі Герман дописує в #1, а Оля видаляє #1.",
    watch: "Видалення перемагає: набране Германом зникає разом із рядком.",
    steps: [
      offline,
      { label: "Герман: дописує «, Царю» в кінець слів #1", run: (c) => typeIn(c.pair.B, 1, "words", "end", ", Царю") },
      { label: "Оля: видаляє #1", run: (c) => removeSegment(c.pair.A, 1) },
      online,
    ],
  },
  {
    title: "Дописали слова — акорди стоять",
    what: "Герман дописує «О, » на початку слів #1.",
    watch: "Акорди лишаються на своїх колонках, слова зʼїжджають під ними — тепер C стоїть не над «Г». Вирівнювати — справа людини.",
    steps: [{ label: "Герман: «О, » на початку #1", run: (c) => typeIn(c.pair.B, 1, "words", 0, "О, ") }],
  },
  {
    title: "Кахон: двоє в ту саму клітинку",
    what: "У #2 кахону немає (sim.). Без мережі Оля і Герман водночас починають його писати.",
    watch: "Доріжка не двоїться: кожна клітинка — один ключ, на спільній перемагає хтось один.",
    steps: [
      offline,
      { label: "Оля: B на долю 1 і 3 у #2", run: (c) => setSegmentProps(c.pair.A, 2, { [cajonKey(1)]: "B", [cajonKey(3)]: "B" }) },
      { label: "Герман: t на долю 3 і 7 у #2", run: (c) => setSegmentProps(c.pair.B, 2, { [cajonKey(3)]: "t", [cajonKey(7)]: "t" }) },
      online,
    ],
  },
  {
    title: "Примітка на акордах і словах",
    what: "Оля лишає примітку на акордах «C   G» і словах «Господь». Далі Герман транспонує й ховає доріжки, а Оля стирає позначене.",
    watch: "Картка переживає транспонування; ховається, лише коли сховані ВСІ її доріжки; втрачається, коли зникло все позначене.",
    steps: [
      {
        label: "Оля: примітка «тут тихо» на «C   G» і «Господь»",
        run: (c) => {
          const p = c.pair.A;
          const id = newId();
          laneNotes(p).set(id, {
            id,
            text: "тут тихо",
            author: "Оля",
            marks: [markText(p, 1, "chords", 11, 16), markText(p, 1, "words", 11, 18)],
          });
        },
      },
      { label: "Герман: транспонує собі на +2", run: (c) => c.setDisplay("B", { semis: 2 }) },
      { label: "Герман: ховає акорди", run: (c) => c.setDisplay("B", { chords: false }) },
      { label: "Герман: ховає ще й слова", run: (c) => c.setDisplay("B", { words: false }) },
      { label: "Герман: показує все", run: (c) => c.setDisplay("B", { words: true, chords: true, semis: 0 }) },
      { label: "Оля: стирає «Господь»", run: (c) => eraseIn(c.pair.A, 1, "words", 11, 18) },
      { label: "Оля: стирає «C   G»", run: (c) => eraseIn(c.pair.A, 1, "chords", 11, 16) },
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
