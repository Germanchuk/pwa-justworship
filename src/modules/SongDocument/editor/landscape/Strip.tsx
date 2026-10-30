/**
 * Пісня однією смугою (горизонтальний формат телефона): рядки йдуть один за
 * одним уздовж осі часу, кожна доріжка — один довгий трек через усю пісню,
 * як у DAW. Сітка: колонка — рядок пісні, ряд — доріжка.
 *
 *   [поле] | 1    2    | 3    4      (таймлайн під самою панеллю: такти пісні наскрізно)
 *          | ▀▀▀▀▀▀▀▀▀ | ▀▀▀▀▀▀▀     (динаміка впритул: спільна, під нею моя)
 *          | Приспів ───────────────▶ (структурна примітка пливе, поки триває)
 *   Таби e | -3---5--- | ---7----
 *   Акорди | Am   F    | C   G
 *   Слова  | Ти святий | Господь
 *
 * Ширина колонки — найдовша її частина (кроки чи слова), а в часі рядок
 * триває стільки, скільки прописано (`lineLength`). Порожній рядок —
 * вузька щілина; структурна примітка колонки не має — вона заголовок усього,
 * що за нею, до наступної.
 *
 * Лише перегляд: правка — у звичайному вигляді (поки що).
 */
import * as Y from "yjs";
import type { CSSProperties, ReactNode } from "react";
import { transposeChordTextForCapo } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/transposeChords";
import type { SongKeyValue } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/model";
import { cardBg, cardBorder, highlightBg, isStrike, STRIKE_INK } from "#modules/SingleSong/components/SlateLyricsPlayground/comments/colors";
import {
  allLanes,
  barSizes,
  CELL_KINDS,
  CellKind,
  DynamicsLayer,
  eighthsPerBar,
  getDynamicsStepColor,
  isTimeRange,
  laneText,
  layout,
  lineKind,
  lineLength,
  LineAt,
  NoteView,
  readMeta,
  rowsOf,
  scaleOf,
  shownDynamics,
  SILENCE,
  Song,
} from "../../model";
import { INK, BAR_PX, ROW_PX, STEP_PX } from "../elements/stepGeometry";
import { StepRows } from "../elements/StepRows";
import { setPlayMark, usePlayMark } from "../playback/mark";

/** Поле зліва: назва доріжки й назви її ліній — не прокручується. */
export const STRIP_GUTTER = 64;
const SECTION_PX = 20;
const RULER_PX = 16;
const DYN_PX = 4;
const PAPER = "#f8f5eb";
const LINE_EDGE = "inset 1px 0 0 rgba(120, 95, 50, 0.22)";
const GUTTER_EDGE = "inset -1px 0 0 rgba(120, 95, 50, 0.22)";
const RULE = "inset 0 -1px 0 0 rgba(120, 95, 50, 0.14)";
const TEXT_INK: Record<string, string> = { words: "#1e3a8a", chords: "#3b82f6", text: "#7c3aed" };

type Column = { ln: number; at: LineAt; empty: boolean; start: number };
type Section = { name: string; from: number; to: number };

/** Колонки смуги й структурні примітки над ними; `start` — початок рядка у вісімках від початку пісні. */
function columnsOf(song: Song, timeSignature: string) {
  const cols: Column[] = [];
  const sections: Section[] = [];
  let open: Section | null = null;
  let start = 0;
  layout(song).forEach((at, ln) => {
    const kind = lineKind(at);
    if (kind === "note") {
      if (open) open.to = cols.length;
      open = { name: at.words.replace(/^\/+\s*/, ""), from: cols.length, to: -1 };
      sections.push(open);
      return;
    }
    cols.push({ ln, at, empty: kind === "empty", start });
    if (kind === "segment") start += lineLength(at.line, timeSignature);
  });
  if (open) (open as Section).to = cols.length;
  return { cols, sections: sections.filter((s) => s.to > s.from) };
}

type Props = {
  song: Song;
  me: string | null;
  /** Доріжки, які людина бачить, — згори донизу. */
  lanes: string[];
  zoom: number | undefined;
  /** Капо, що діє (акорди транспоновані). */
  capo: number;
  notes: NoteView[];
};

export function Strip({ song, me, lanes, zoom, capo, notes }: Props) {
  const { timeSignature, key } = readMeta(song.doc);
  const defs = allLanes(song.doc);
  const kindOf = (id: string) => (id === "words" || id === "chords" ? id : defs.find((l) => l.id === id)?.kind);
  const { cols, sections } = columnsOf(song, timeSignature);
  const mark = usePlayMark();
  const hits = scaleOf("tab", timeSignature, zoom);
  const per = eighthsPerBar(timeSignature);

  const at = (col: number, row: number, extra: CSSProperties = {}): CSSProperties => ({ gridColumn: col + 2, gridRow: row, ...extra });
  // Поле доріжок: межа з піснею — його права лінія, тож при прокрутці вбік вона лишається.
  const sticky = (extra: CSSProperties = {}): CSSProperties => ({ position: "sticky", left: 0, zIndex: 3, background: PAPER, boxShadow: GUTTER_EDGE, ...extra });
  const items: ReactNode[] = [];
  // Згори вниз: таймлайн під самою панеллю, впритул під ним динаміка, далі ряд
  // структурних приміток — лише коли вони є.
  const sectionPx = sections.length ? SECTION_PX : 0;
  // Смужки динаміки: спільна, під нею моя.
  const dynPx = me ? DYN_PX * 2 : DYN_PX;
  /** Висота всього, що тримається згори: таймлайн, примітка, динаміка. */
  const headPx = RULER_PX + sectionPx + dynPx;

  // Кут: над полем — порожньо, але непрозоро (під ним їдуть таймлайн і примітки).
  items.push(<div key="corner" style={{ gridColumn: 1, gridRow: "1 / 4", ...sticky({ top: 0, zIndex: 5 }) }} />);

  // Підкладка під примітки й таймлайн на всю ширину: де примітки немає (до першої,
  // порожній рядок), між таймлайном і панеллю згори не просвічує пісня.
  items.push(
    <div
      key="backdrop"
      style={{ gridColumn: "2 / -1", gridRow: "1 / 4", position: "sticky", top: 0, zIndex: 1, height: headPx, background: PAPER }}
    />,
  );

  // Структурні примітки: напис пливе вздовж своїх колонок, поки вони на екрані.
  sections.forEach((s, i) =>
    items.push(
      <div
        key={`s${i}`}
        style={{ gridColumn: `${s.from + 2} / ${s.to + 2}`, gridRow: 3, position: "sticky", top: RULER_PX + dynPx, zIndex: 2, height: SECTION_PX, background: PAPER, boxShadow: `${LINE_EDGE}, ${RULE}` }}
      >
        <span className="sticky inline-block whitespace-nowrap px-1.5 text-xs font-bold text-stone-700" style={{ left: STRIP_GUTTER, lineHeight: `${SECTION_PX}px` }}>
          {s.name}
        </span>
      </div>,
    ),
  );

  cols.forEach((c, col) => {
    const edge = { boxShadow: LINE_EDGE };
    if (c.empty) {
      // Порожній рядок — щілина між частинами.
      items.push(<div key={`gap${col}`} style={{ gridColumn: col + 2, gridRow: `2 / span ${lanes.length * 2 + 2}`, width: 14 }} />);
      return;
    }
    const sizes = barSizes(lineLength(c.at.line, timeSignature), timeSignature, hits);
    // Таймлайн: такти пісні наскрізно; тап — грати звідси.
    items.push(
      <button
        key={`r${col}`}
        type="button"
        data-strip-line={c.ln}
        data-cells={hits.cells}
        data-cell-ticks={hits.tick}
        data-bar-ticks={hits.ticks}
        title="Грати звідси"
        onClick={() => setPlayMark(c.ln)}
        className="flex items-stretch text-left text-[9px] text-stone-400"
        style={at(col, 1, { position: "sticky", top: 0, zIndex: 1, height: RULER_PX, background: PAPER, ...edge, boxShadow: `${LINE_EDGE}, ${RULE}` })}
      >
        {sizes.map((size, b) => {
          const eighth = c.start + b * per;
          return (
            // Номер такту — посередині по висоті: відступ над ним такий самий, як під ним (нижня лінія — 1px).
            <span key={b} className="relative flex shrink-0 items-center border-l border-stone-300 pb-px pl-0.5 leading-none" style={{ width: BAR_PX + size * STEP_PX }}>
              {Math.floor(eighth / per) + 1}
              {eighth % per ? `.${eighth % per}` : ""}
              {b === 0 && mark === c.ln && <span className="ml-0.5 text-red-500">▶</span>}
            </span>
          );
        })}
        <span className="shrink-0" style={{ width: BAR_PX }} />
      </button>,
    );
    // Динаміка рядка: спільна, під нею моя; тримається згори впритул під таймлайном.
    items.push(
      <div key={`d${col}`} style={at(col, 2, { position: "sticky", top: RULER_PX, zIndex: 2, background: PAPER })}>
        <DynBand at={c.at} layer={null} />
        {me && <DynBand at={c.at} layer={me} />}
      </div>,
    );
  });

  // Кожна доріжка — два ряди: картки приміток і сам вміст. Картки — окремим
  // рядом над доріжкою, тож вміст усіх рядків пісні завжди на одному рівні.
  lanes.forEach((id, r) => {
    const cardsRow = 4 + r * 2;
    const row = cardsRow + 1;
    const kind = kindOf(id);
    const cells = (CELL_KINDS as readonly string[]).includes(kind ?? "");
    const name = id === "words" ? "Слова" : id === "chords" ? "Акорди" : (defs.find((l) => l.id === id)?.name ?? "");
    items.push(<div key={`gc${id}`} style={{ gridColumn: 1, gridRow: cardsRow, ...sticky() }} />);
    items.push(
      <div key={`g${id}`} className="flex items-start justify-between gap-1 pl-1 pr-1" style={{ gridColumn: 1, gridRow: row, ...sticky({ boxShadow: `${GUTTER_EDGE}, ${RULE}` }) }}>
        <span className="min-w-0 truncate pt-1 text-[9px] font-semibold uppercase tracking-tight text-stone-400">{name}</span>
        {cells && (
          <span className="shrink-0 pt-0.5 text-right font-mono text-[11px] text-stone-400">
            {rowsOf(kind as CellKind).map((n, i) => (
              <div key={i} style={{ height: ROW_PX, lineHeight: `${ROW_PX}px` }}>
                {n}
              </div>
            ))}
          </span>
        )}
      </div>,
    );
    cols.forEach((c, col) => {
      if (c.empty) return;
      const marks = notes.filter((n) => n.line === c.ln && n.lane === id && n.status === "visible" && n.at && !n.foreign);
      const cards = marks.filter((n) => n.note.body);
      const slot = c.at.line.get(id);
      let body: ReactNode = null;
      if (cells && slot instanceof Y.Map && slot.has("cells")) {
        body = (
          <div className="py-0.5" style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, lineHeight: 1.35, color: INK[kind as CellKind] }}>
            <StepRows kind={kind as CellKind} slot={slot as Y.Map<unknown>} line={c.at.line} timeSignature={timeSignature} zoom={zoom} marks={marks} />
          </div>
        );
      } else if (!cells) {
        const raw = id === "words" ? c.at.words : (laneText(c.at.line, id)?.toString() ?? "");
        const transposed = id === "chords" && capo > 0;
        body = (
          <div
            className="whitespace-pre px-1.5"
            style={{
              fontSize: 16,
              lineHeight: 1.6,
              minHeight: "1.6em",
              color: transposed ? "#6366f1" : TEXT_INK[kind === "text" ? "text" : id],
              fontWeight: id === "chords" ? 700 : 500,
              fontStyle: kind === "text" ? "italic" : undefined,
            }}
          >
            {transposed ? transposeChordTextForCapo(raw, key as SongKeyValue, capo) : <Marked text={raw} marks={marks.filter((n) => !isTimeRange(n.note))} />}
          </div>
        );
      }
      items.push(
        <div key={`c${id}:${col}`} className="flex flex-col justify-end" style={at(col, cardsRow, { boxShadow: LINE_EDGE, paddingRight: 8 })}>
          {cards.map((n) => (
            <div
              key={n.note.id}
              className="mx-1 my-0.5 max-w-64 whitespace-normal rounded border-l-4 px-1.5 py-0.5 text-xs"
              style={{ fontFamily: "Pangolin, cursive", background: cardBg(n.note.color), borderColor: cardBorder(n.note.color), color: "#3f2a06" }}
            >
              {n.note.body} <span className="text-[10px] text-stone-500">{n.note.author}</span>
            </div>
          ))}
        </div>,
      );
      items.push(
        <div key={`${id}:${col}`} style={at(col, row, { boxShadow: `${LINE_EDGE}, ${RULE}`, paddingRight: 8 })}>
          {body}
        </div>,
      );
    });
  });

  return (
    <div
      data-strip=""
      className="relative grid w-max min-w-full content-start pb-6"
      // Ряди примітки й таймлайну — сталої висоти: на них стоять липкі відступи (`top`).
      style={{ gridTemplateColumns: `${STRIP_GUTTER}px repeat(${cols.length}, max-content)`, gridTemplateRows: `${RULER_PX}px ${dynPx}px ${sectionPx}px`, gridAutoRows: "auto" }}
    >
      {items}
      <div data-strip-needle="" className="pointer-events-none absolute top-0 bottom-0 z-[4] w-0.5 -ml-px bg-red-500/80" style={{ display: "none" }} />
    </div>
  );
}

/** Текст доріжки з позначками приміток — шарами їхніх кольорів, закреслення — рисою. */
function Marked({ text, marks }: { text: string; marks: NoteView[] }) {
  const cuts = [...new Set([0, text.length, ...marks.flatMap((n) => [n.at!.from, n.at!.to])])].filter((x) => x >= 0 && x <= text.length).sort((a, b) => a - b);
  return (
    <>
      {cuts.slice(0, -1).map((from, i) => {
        const to = cuts[i + 1];
        const on = marks.filter((n) => n.at!.from < to && n.at!.to > from);
        const colors = on.map((n) => n.note.color);
        const fills = colors.filter((c) => !isStrike(c)).map(highlightBg);
        const style: CSSProperties = {};
        if (fills.length) style.background = fills.map((c) => `linear-gradient(${c}, ${c})`).join(", ");
        if (colors.some(isStrike)) Object.assign(style, { textDecoration: "line-through", textDecorationColor: STRIKE_INK, textDecorationThickness: 2 });
        return (
          <span key={from} style={style}>
            {text.slice(from, to)}
          </span>
        );
      })}
    </>
  );
}

/** Смужка динаміки рядка (тиша — темна риска). */
function DynBand({ at, layer }: { at: LineAt; layer: DynamicsLayer }) {
  const key = shownDynamics(at, layer);
  if (!key) return <div style={{ height: DYN_PX }} />;
  const color = getDynamicsStepColor(key);
  return <div style={{ height: DYN_PX, background: key === SILENCE ? `repeating-linear-gradient(90deg, ${color} 0 6px, transparent 6px 9px)` : color }} />;
}
