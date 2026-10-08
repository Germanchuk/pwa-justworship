/**
 * PROTOTYPE (гілка `prototype/segments-lanes`) — викинути після оцінки ADR-0006.
 * Маршрут: `/prototype/segments-lanes`. Усе в памʼяті, жодного сервера.
 *
 * Два редактори (Оля й Герман) на двох Y.Doc, справжні Slate + @slate-yjs,
 * мережа між ними вмикається й вимикається. Пісня — ряд відрізків, на кожному
 * доріжки: слова (текст із курсором), акорди (позиції в словах), кахон
 * (клітинки-ключі). Динаміка й заголовок — атрибути відрізка.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createEditor, Editor, Node, NodeEntry, Range, Text } from "slate";
import {
  Editable,
  ReactEditor,
  RenderElementProps,
  RenderLeafProps,
  Slate,
  useSlateStatic,
  withReact,
} from "slate-react";
import {
  backspaceAtStart,
  deleteRange,
  fmt,
  Pair,
  Peer,
  pressEnter,
  removeSegment,
  setSegmentProps,
  typeAt,
} from "./harness";
import {
  CAJON_STEPS,
  cajonKey,
  cajonOf,
  ChordView,
  chordOps,
  inherited,
  makeSongPair,
  mockChordId,
  NoteView,
  notesMap,
  resolveNotes,
  transposeName,
  VariantId,
  VARIANTS,
  Visibility,
  wordsMark,
} from "./model";

type Who = "A" | "B";
const NAMES: Record<Who, string> = { A: "Оля", B: "Герман" };
type Display = Visibility & { semis: number };
const DEFAULT_DISPLAY: Display = { words: true, chords: true, cajon: true, semis: 0 };

const newId = () => Math.random().toString(36).slice(2, 7);

// ── контекст однієї панелі (для рендера відрізків) ─────────────────────────

type PaneCtx = {
  who: Who;
  peer: Peer;
  variant: VariantId;
  chords: ChordView[];
  notes: NoteView[];
  display: Display;
  otherHere: number | null;
  selectedChords: Set<string>;
  toggleChord: (id: string) => void;
};
const Ctx = createContext<PaneCtx | null>(null);
const usePane = () => useContext(Ctx)!;

// ── сторінка ───────────────────────────────────────────────────────────────

export default function SegmentsLanesPrototype() {
  const [variant, setVariant] = useState<VariantId>("A");
  const [gen, setGen] = useState(0);
  const pair = useMemo(
    () => makeSongPair(variant, () => withReact(createEditor())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [variant, gen],
  );
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

  const reset = (v: VariantId = variant) => {
    setVariant(v);
    setGen((g) => g + 1);
    setDisplay({ A: DEFAULT_DISPLAY, B: DEFAULT_DISPLAY });
    setPresence({ A: null, B: null });
    setStep(0);
  };

  const ctx: ScenarioCtx = {
    pair,
    variant,
    setDisplay: (who, d) => setDisplay((all) => ({ ...all, [who]: { ...all[who], ...d } })),
  };

  return (
    <div className="min-h-dvh bg-stone-50 text-stone-900 px-4 py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="space-y-2">
          <div className="text-xs font-semibold tracking-wider text-amber-700 uppercase">
            Прототип · викинути після оцінки · ADR-0006
          </div>
          <h1 className="text-2xl font-semibold">Відрізки й доріжки замість секцій</h1>
          <p className="text-stone-600 max-w-3xl">
            Питання: чи витримує модель «пісня = ряд відрізків, на кожному доріжки» спільне
            редагування — передусім <b>Enter посеред слів</b> (ділення відрізка), <b>Backspace на
            початку</b> (злиття) і правки двох людей одночасно. Нижче — два редактори на двох окремих
            копіях документа, справжні Slate і @slate-yjs. Вимкни мережу, щоб правки зійшлися пізніше.
          </p>
        </header>

        <AskHost />
        <Findings />

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
            Як акорди привʼязані до слів
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {(Object.keys(VARIANTS) as VariantId[]).map((id) => (
              <button
                key={id}
                onClick={() => reset(id)}
                className={`text-left rounded-lg border p-3 text-sm ${
                  id === variant ? "border-amber-600 bg-amber-50" : "border-stone-200 bg-white hover:border-stone-400"
                }`}
              >
                <div className="font-medium">{VARIANTS[id].title}</div>
                <div className="text-stone-500 mt-1">{VARIANTS[id].short}</div>
              </button>
            ))}
          </div>
        </section>

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
          <button onClick={() => reset()} className="rounded-full px-4 py-1.5 text-sm border border-stone-300 bg-white">
            Почати пісню наново
          </button>
          <span className="text-xs text-stone-500">
            Клік над словами — поставити акорд · клік по акорду — перейменувати (порожньо = видалити) ·
            Shift+клік по акорду — вибрати для примітки
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
          onRestart={() => reset()}
        />

        <div className="grid md:grid-cols-2 gap-4" key={`${variant}-${gen}`}>
          {(["A", "B"] as Who[]).map((who) => (
            <PeerPane
              key={who}
              who={who}
              pair={pair}
              variant={variant}
              display={display[who]}
              setDisplay={(d) => ctx.setDisplay(who, d)}
              otherHere={pair.online ? presence[who === "A" ? "B" : "A"] : null}
              onPresence={(seg) => setPresence((p) => (p[who] === seg ? p : { ...p, [who]: seg }))}
              bump={bump}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── панель одного учасника ─────────────────────────────────────────────────

function PeerPane(props: {
  who: Who;
  pair: Pair;
  variant: VariantId;
  display: Display;
  setDisplay: (d: Partial<Display>) => void;
  otherHere: number | null;
  onPresence: (seg: number | null) => void;
  bump: () => void;
}) {
  const { who, pair, variant, display } = props;
  const peer = pair[who];
  const ops = chordOps(variant);
  const chords = ops.list(peer);
  const notes = resolveNotes(peer, chords, ops.home, display);
  const [selectedChords, setSelectedChords] = useState<Set<string>>(new Set());
  const toggleChord = (id: string) =>
    setSelectedChords((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const wordRanges = notes.flatMap((n) => n.marks.filter((m) => m.range && display.words).map((m) => m.range!));
  const decorate = useCallback(
    ([node, path]: NodeEntry) => {
      if (!Text.isText(node)) return [];
      return wordRanges
        .map((r) => Range.intersection(r, Editor.range(peer.editor, path)))
        .filter((r): r is Range => !!r && !Range.isCollapsed(r))
        .map((r) => ({ ...r, noted: true }));
    },
    // перераховуємо щоразу — прототип
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(wordRanges), peer],
  );

  const addNote = async () => {
    const sel = peer.editor.selection;
    const marks = [
      ...(sel && !Range.isCollapsed(sel) ? [wordsMark(peer, sel)] : []),
      ...[...selectedChords].map((chord) => ({ lane: "chords" as const, chord })),
    ];
    if (!marks.length) {
      void ask("Спершу виділи слова в редакторі та/або Shift+клікни акорди.", null);
      return;
    }
    const text = await ask("Текст примітки", "");
    if (!text) return;
    const id = newId();
    notesMap(peer).set(id, { id, text, author: NAMES[who], marks });
    setSelectedChords(new Set());
  };

  return (
    <Ctx.Provider
      value={{ who, peer, variant, chords, notes, display, otherHere: props.otherHere, selectedChords, toggleChord }}
    >
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-stone-100 bg-stone-50">
          <span className="font-semibold">{NAMES[who]}</span>
          <span className="text-xs text-stone-400">моя копія документа</span>
          <span className="flex-1" />
          {(["words", "chords", "cajon"] as const).map((lane) => (
            <label key={lane} className="text-xs flex items-center gap-1">
              <input
                type="checkbox"
                checked={display[lane]}
                onChange={(e) => props.setDisplay({ [lane]: e.target.checked })}
              />
              {{ words: "слова", chords: "акорди", cajon: "кахон" }[lane]}
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
          <button onClick={addNote} className="text-xs rounded border border-amber-400 bg-amber-50 px-2 py-0.5">
            + примітка{selectedChords.size ? ` (акордів: ${selectedChords.size})` : ""}
          </button>
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
              readOnly={!display.words}
              renderElement={(p) => <SegmentElement {...p} />}
              renderLeaf={Leaf}
              decorate={decorate}
              className="outline-none space-y-1"
            />
          </Slate>
        </div>

        <StatePanel peer={peer} chords={chords} notes={notes} variant={variant} />
      </div>
    </Ctx.Provider>
  );
}

function Leaf({ attributes, children, leaf }: RenderLeafProps) {
  const noted = (leaf as { noted?: boolean }).noted;
  return (
    <span {...attributes} className={noted ? "underline decoration-amber-500 decoration-2 underline-offset-4" : ""}>
      {children}
    </span>
  );
}

// ── відрізок ───────────────────────────────────────────────────────────────

function SegmentElement({ attributes, children, element }: RenderElementProps) {
  const pane = usePane();
  const editor = useSlateStatic();
  let index = -1;
  try {
    index = ReactEditor.findPath(editor, element)[0];
  } catch {
    /* вузол щойно зник */
  }
  const node = element as unknown as Record<string, unknown>;
  const nodes = pane.peer.editor.children;
  const text = Node.string(element);
  const dyn = typeof node.dyn === "number" ? node.dyn : undefined;
  const dynInherited = dyn === undefined ? inherited(nodes, index, (n) => (n as { dyn?: number }).dyn) : undefined;
  const cards = pane.notes.filter((n) => n.cardAt === index);

  const remove = async () => {
    if (
      pane.otherHere === index &&
      (await ask(`Тут зараз пише ${NAMES[pane.who === "A" ? "B" : "A"]}. Видалити відрізок?`, null)) === null
    )
      return;
    removeSegment(pane.peer, index);
  };

  return (
    <div {...attributes} className="group relative rounded-md border border-transparent hover:border-stone-200 px-2 py-1">
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
          <button className="px-1 border rounded" onClick={() => setSegmentProps(pane.peer, index, { dyn: Math.max(1, (dyn ?? dynInherited?.value ?? 3) - 1) })}>
            −
          </button>
          {dyn !== undefined ? (
            <span className="text-stone-700">dyn {dyn}</span>
          ) : dynInherited ? (
            <span className="italic">dyn {dynInherited.value} (як у #{dynInherited.from})</span>
          ) : (
            <span className="italic">dyn —</span>
          )}
          <button className="px-1 border rounded" onClick={() => setSegmentProps(pane.peer, index, { dyn: Math.min(5, (dyn ?? dynInherited?.value ?? 3) + 1) })}>
            +
          </button>
          {dyn !== undefined && (
            <button className="px-1" title="прибрати" onClick={() => setSegmentProps(pane.peer, index, { dyn: null })}>
              ×
            </button>
          )}
        </span>
        {pane.otherHere === index && (
          <span className="rounded bg-sky-100 text-sky-800 px-1.5">✎ тут {NAMES[pane.who === "A" ? "B" : "A"]}</span>
        )}
        <span className="flex-1" />
        <button className="opacity-0 group-hover:opacity-100 text-rose-600" onClick={remove}>
          видалити відрізок
        </button>
      </div>
      {pane.display.chords && <ChordLane index={index} text={text} />}
      <div
        className={`font-mono text-[15px] leading-6 whitespace-pre ${node.heading ? "font-bold uppercase tracking-wide" : ""}`}
        style={pane.display.words ? undefined : { color: "transparent" }}
      >
        {children}
      </div>
      {pane.display.cajon && <CajonLane index={index} />}
    </div>
  );
}

function ChordLane({ index, text }: { index: number; text: string }) {
  const pane = usePane();
  const ops = chordOps(pane.variant);
  const ref = useRef<HTMLDivElement>(null);
  const mine = pane.chords.filter((c) => ops.home(c) === index);

  // Групуємо за офсетом: кілька акордів на одному місці — видно, що «злиплись».
  const groups = new Map<number, ChordView[]>();
  mine.forEach((c) => {
    const at = c.seg === index && c.offset != null ? c.offset : -1;
    groups.set(at, [...(groups.get(at) ?? []), c]);
  });
  // «sim.» — лише якщо вище є відрізок з акордами й це не заголовок.
  const isHeading = !!(pane.peer.editor.children[index] as { heading?: boolean } | undefined)?.heading;
  const empty =
    mine.length === 0 && !isHeading && pane.chords.some((c) => (ops.home(c) ?? Infinity) < index);

  const addAt = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.chord) return;
    const box = ref.current!.getBoundingClientRect();
    const probe = ref.current!.querySelector<HTMLElement>("[data-probe]")!;
    const ch = probe.getBoundingClientRect().width / 10;
    const offset = Math.max(0, Math.min(text.length, Math.round((e.clientX - box.left - 8) / ch)));
    const name = await ask(`Акорд над «${text[offset] ?? "кінцем рядка"}» (символ ${offset})`, "");
    if (!name) return;
    ops.add(pane.peer, index, offset, newId(), name.trim());
  };

  const edit = async (e: React.MouseEvent, c: ChordView) => {
    e.stopPropagation();
    if (e.shiftKey) return pane.toggleChord(c.id);
    const name = await ask("Назва акорду (порожньо — видалити)", c.name);
    if (name === null) return;
    if (!name.trim()) ops.remove(pane.peer, c);
    else ops.rename(pane.peer, c, name.trim());
  };

  return (
    <div
      ref={ref}
      contentEditable={false}
      onMouseDown={(e) => e.preventDefault()}
      onClick={addAt}
      className="relative h-6 font-mono text-[15px] leading-6 cursor-crosshair select-none hover:bg-amber-50/60 rounded"
    >
      <span data-probe className="invisible absolute">
        0000000000
      </span>
      {empty && <span className="absolute left-0 text-stone-300 italic text-xs">sim. (як попередньо)</span>}
      {[...groups.entries()].map(([at, cs]) => (
        <span
          key={at}
          className="absolute top-0 flex gap-0.5"
          style={{ left: `${Math.max(0, at)}ch` }}
        >
          {cs.map((c) => {
            const elsewhere = c.seg !== index;
            const stuck = cs.length > 1;
            const noted = pane.notes.some((n) => n.marks.some((m) => m.mark.lane === "chords" && m.mark.chord === c.id));
            return (
              <span
                key={c.id}
                data-chord
                onClick={(e) => edit(e, c)}
                title={elsewhere ? `ключ на #${index}, а позиція вказує на ${c.seg == null ? "нікуди" : "#" + c.seg}` : `над «${c.char}»`}
                className={`cursor-pointer font-semibold rounded px-0.5 ${
                  elsewhere ? "text-rose-600 bg-rose-50 line-through" : stuck ? "text-orange-600 bg-orange-50" : "text-amber-700"
                } ${pane.selectedChords.has(c.id) ? "ring-2 ring-sky-400" : ""}`}
              >
                {transposeName(c.name, pane.display.semis)}
                {noted && <sup className="text-amber-500">●</sup>}
                {elsewhere && <sub className="no-underline">→{c.seg == null ? "∅" : "#" + c.seg}</sub>}
              </span>
            );
          })}
        </span>
      ))}
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

function NoteCard({ view }: { view: NoteView }) {
  const pane = usePane();
  return (
    <div contentEditable={false} className="mb-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs select-none">
      <b>{view.note.author}:</b> {view.note.text}{" "}
      <span className="text-stone-500">
        ({view.marks.map((m) => markLabel(m.mark, pane.chords) + (m.lost ? " — втрачено" : "")).join("; ")})
      </span>
      <button className="ml-2 text-stone-400" onClick={() => notesMap(pane.peer).delete(view.note.id)}>
        ×
      </button>
    </div>
  );
}

function markLabel(m: NoteView["marks"][number]["mark"], chords: ChordView[]) {
  if (m.lane === "words") return `слова «${m.quote}»`;
  const c = chords.find((x) => x.id === m.chord);
  return `акорд ${c?.name ?? "?"}`;
}

// ── стан документа (читається людиною) ─────────────────────────────────────

function StatePanel({ peer, chords, notes, variant }: { peer: Peer; chords: ChordView[]; notes: NoteView[]; variant: VariantId }) {
  const ops = chordOps(variant);
  const lostChords = chords.filter((c) => c.seg == null);
  return (
    <details className="border-t border-stone-100 bg-stone-50/60 px-4 py-2 text-xs" open>
      <summary className="cursor-pointer text-stone-500 font-medium">Що лежить у документі</summary>
      <table className="w-full mt-2 font-mono">
        <tbody>
          {peer.editor.children.map((n, i) => {
            const props = Object.entries(n).filter(([k]) => !["type", "children"].includes(k) && !k.startsWith("chord:"));
            const keys = Object.keys(n).filter((k) => k.startsWith("chord:")).length;
            return (
              <tr key={i} className="align-top border-b border-stone-100">
                <td className="pr-2 text-stone-400">#{i}</td>
                <td className="pr-2 whitespace-pre">«{Node.string(n)}»</td>
                <td className="pr-2 text-stone-500">
                  {props.map(([k, v]) => `${k}=${String(v)}`).join(" ")}
                  {keys ? ` · ключів chord: ${keys}` : ""}
                </td>
                <td className="text-amber-800">{fmt(chords.filter((c) => ops.home(c) === i)).join(" ")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {lostChords.length > 0 && (
        <div className="mt-2 text-rose-700">Акорди без місця (позиція нікуди не веде): {lostChords.map((c) => c.name).join(", ")}</div>
      )}
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

// ── підсумок ───────────────────────────────────────────────────────────────

function Findings() {
  return (
    <details className="rounded-xl border border-stone-200 bg-white p-4 text-sm" open>
      <summary className="cursor-pointer font-semibold">Що вже показав прототип (vitest + ця сторінка)</summary>
      <ul className="list-disc pl-5 mt-2 space-y-1 text-stone-700">
        <li>
          <b>Enter = копія, не перенос.</b> @slate-yjs кладе хвіст слів у новий обʼєкт і стирає зі старого. Позиція
          акорду в хвості після цього вказує на стерті символи — і падає в <b>кінець першої половини</b>.
          Підозра підтвердилась (варіант A).
        </li>
        <li>
          <b>Slate копіює всі атрибути відрізка в обидві половини</b> — кожен ключ акорду, динаміка, заголовок, кахон.
          Те саме, через що колись двоїлись атрибути секцій.
        </li>
        <li>
          <b>Бібліотека вміє переносити позиції сама</b> («stored positions», варіант B): при Enter акорди хвоста
          переїжджають у новий відрізок на свої символи. Але при <b>злитті є баг</b> у @slate-yjs 1.0.2 — акорди
          другого відрізка губляться. Обхід ≈ 20 рядків (варіант B + виправлене).
        </li>
        <li>
          <b>Не лікується жодним варіантом:</b> якщо Оля ділить рядок, а Герман офлайн пише в його хвіст, набране
          Германом опиняється в кінці <b>першої</b> половини. Так поводиться й нинішній редактор.
        </li>
      </ul>
    </details>
  );
}

// ── сценарії ───────────────────────────────────────────────────────────────

type ScenarioCtx = {
  pair: Pair;
  variant: VariantId;
  setDisplay: (who: Who, d: Partial<Display>) => void;
};
type Scenario = { title: string; what: string; watch: string; steps: { label: string; run: (c: ScenarioCtx) => void }[] };

const offline = { label: "Вимкнути мережу", run: (c: ScenarioCtx) => c.pair.unlink() };
const online = { label: "Увімкнути мережу — правки зустрічаються", run: (c: ScenarioCtx) => c.pair.link() };
const olyaEnter = { label: "Оля: Enter перед «Господь» (#1)", run: (c: ScenarioCtx) => pressEnter(c.pair.A, 1, 11) };

const SCENARIOS: Scenario[] = [
  {
    title: "Enter посеред рядка",
    what: "Оля ставить курсор перед «Господь» у рядку з чотирма акордами, динамікою й кахоном і тисне Enter.",
    watch: "Куди стали C і G? Чи задвоїлись динаміка й кахон у новому відрізку? Порівняй варіанти A і B.",
    steps: [olyaEnter],
  },
  {
    title: "Enter, а потім Backspace",
    what: "Ділимо рядок і одразу склеюємо назад. Має вийти рівно те, що було (як SONG-27).",
    watch: "Чи всі чотири акорди повернулись на свої символи? У B без виправлення — два акорди зникають.",
    steps: [olyaEnter, { label: "Оля: Backspace на початку «Господь» (#2)", run: (c) => backspaceAtStart(c.pair.A, 2) }],
  },
  {
    title: "Ділення під час набору",
    what: "Без мережі Оля ділить рядок, а Герман у той час дописує в кінець «Господь». Потім мережа повертається.",
    watch: "Слово Германа опиняється в кінці першої половини, а не в «Господь». Це не залежить від варіанту.",
    steps: [offline, olyaEnter, { label: "Герман: дописує «, Царю» в кінець #1", run: (c) => typeAt(c.pair.B, 1, 18, ", Царю") }, online],
  },
  {
    title: "Акорд у хвіст під час ділення",
    what: "Без мережі Оля ділить рядок, а Герман ставить Dm над «с» у «Господь».",
    watch: "Dm падає на точку розрізу в першій половині — в усіх варіантах.",
    steps: [
      offline,
      olyaEnter,
      {
        label: "Герман: ставить Dm над «с» у «Господь»",
        run: (c) => chordOps(c.variant).add(c.pair.B, 1, 13, newId(), "Dm"),
      },
      online,
    ],
  },
  {
    title: "Видалили відрізок, поки інший пише",
    what: "Без мережі Герман дописує в рядок #1, а Оля цей рядок видаляє.",
    watch: "Видалення перемагає: набране Германом зникає разом із рядком. У B його акорди лишаються «без місця».",
    steps: [
      offline,
      { label: "Герман: дописує «, Царю» в кінець #1", run: (c) => typeAt(c.pair.B, 1, 18, ", Царю") },
      { label: "Оля: видаляє відрізок #1", run: (c) => removeSegment(c.pair.A, 1) },
      online,
    ],
  },
  {
    title: "Стерли слово під акордами",
    what: "Герман стирає «Господь», над яким стоять C і G, потім пише «Царю».",
    watch: "Акорди не зникають — зсуваються на найближче місце (тут — кінець рядка) і злипаються. Куди вони стануть після «Царю»?",
    steps: [
      { label: "Герман: стирає «Господь»", run: (c) => deleteRange(c.pair.B, 1, 11, 18) },
      { label: "Герман: пише «Царю»", run: (c) => typeAt(c.pair.B, 1, 11, "Царю") },
    ],
  },
  {
    title: "Кахон: двоє в ту саму клітинку",
    what: "У #2 кахону немає (sim.). Без мережі Оля і Герман водночас починають його писати.",
    watch: "Доріжка не двоїться: кожна клітинка — один ключ, на спільній клітинці перемагає хтось один.",
    steps: [
      offline,
      { label: "Оля: B на долю 1 і 3 у #2", run: (c) => setSegmentProps(c.pair.A, 2, { [cajonKey(1)]: "B", [cajonKey(3)]: "B" }) },
      { label: "Герман: t на долю 3 і 7 у #2", run: (c) => setSegmentProps(c.pair.B, 2, { [cajonKey(3)]: "t", [cajonKey(7)]: "t" }) },
      online,
    ],
  },
  {
    title: "Примітка на акорді й словах",
    what: "Оля лишає примітку на акорді C і словах «Господь». Далі Герман транспонує, ховає доріжки, а Оля стирає позначене.",
    watch: "Картка переживає транспонування; ховається лише коли сховані ВСІ її доріжки; втрачається лише коли зникло все позначене.",
    steps: [
      {
        label: "Оля: примітка «тут тихо» на C і «Господь»",
        run: (c) => {
          const p = c.pair.A;
          const r = { anchor: { path: [1, 0], offset: 11 }, focus: { path: [1, 0], offset: 18 } };
          const id = newId();
          notesMap(p).set(id, {
            id,
            text: "тут тихо",
            author: "Оля",
            marks: [wordsMark(p, r), { lane: "chords", chord: mockChordId(1, 11) }],
          });
        },
      },
      { label: "Герман: транспонує собі на +2", run: (c) => c.setDisplay("B", { semis: 2 }) },
      { label: "Герман: ховає доріжку акордів", run: (c) => c.setDisplay("B", { chords: false }) },
      { label: "Герман: ховає ще й слова", run: (c) => c.setDisplay("B", { words: false }) },
      { label: "Герман: показує все назад", run: (c) => c.setDisplay("B", { words: true, chords: true }) },
      { label: "Оля: стирає «Господь»", run: (c) => deleteRange(c.pair.A, 1, 11, 18) },
      {
        label: "Оля: видаляє акорд C",
        run: (c) => {
          const ops = chordOps(c.variant);
          ops.list(c.pair.A).filter((x) => x.id === mockChordId(1, 11)).forEach((x) => ops.remove(c.pair.A, x));
        },
      },
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
