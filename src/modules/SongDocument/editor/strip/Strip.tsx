/**
 * Пісня смугою, як треки в DAW (`SONG-98`, `SONG-97`): сітка, де колонка —
 * рядок пісні, ряд — доріжка. Один вигляд на два формати:
 *
 * - телефон лежачи — **одна смуга**: рядки йдуть один за одним уздовж осі
 *   часу, кожна доріжка — один довгий трек через усю пісню;
 * - ПК (`split`) — та сама смуга, **розрізана по рядках**: кожен рядок пісні —
 *   своя смуга на всю ширину, згори донизу; структурна примітка — заголовок
 *   над смугами своєї частини, порожній рядок — проміжок.
 *
 * Будь-яка зміна вигляду смуги — для обох форматів одразу.
 *
 *     | 1    2    | 3    4      (таймлайн під самою панеллю: такти пісні наскрізно)
 *     | ▀▀▀▀▀▀▀▀▀ | ▀▀▀▀▀▀▀     (динаміка впритул: спільна, під нею моя)
 *     | Приспів ───────────────▶ (структурна примітка пливе, поки триває)
 *   e | -3---5--- | ---7----    (таби — назви струн, кахон — ударів)
 *   ♪ | Am   F    | C   G       (решта — іконкою)
 *   … | Ти святий | Господь
 *
 * Ширина колонки — найдовша її частина (кроки чи слова), а в часі рядок
 * триває стільки, скільки прописано (`lineLength`). Порожній рядок —
 * вузька щілина; структурна примітка колонки не має — вона заголовок усього,
 * що за нею, до наступної.
 *
 * Лише перегляд: правка — у редакторі Slate (телефон стоячи, планшет), поки що.
 */
import * as Y from "yjs";
import { cn } from "@/lib/utils";
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
  LaneKind,
  laneText,
  layout,
  lineKind,
  lineLength,
  LineAt,
  NoteView,
  readMeta,
  PIANO_ROWS,
  rowsOf,
  scaleOf,
  shownDynamics,
  SILENCE,
  Song,
} from "../../model";
import { INK, BAR_PX, PIANO_ROW_PX, ROW_PX, STEP_PX, STEPS_FONT_PX, stepsVersion } from "../elements/stepGeometry";
import { StepRows } from "../elements/StepRows";
import { LANE_ICON, SECTION_ICON, TIMELINE_ICON } from "../laneIcons";
import { setPlayMark, usePlayMark } from "../playback/mark";

/**
 * Поле зліва — не прокручується, і воно вузьке, щоб пісні лишалось місце:
 * таби й кахон підписані самими назвами ліній (струни, удари — і так ясно,
 * що це), решта доріжок — іконкою, як у шапці пісні (`LANE_ICON`; назва — підказкою).
 */
export const STRIP_GUTTER = 22;
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
  /** Розрізати по рядках пісні (ПК), а не однією смугою (телефон лежачи). */
  split?: boolean;
};

export function Strip({ song, me, lanes, zoom, capo, notes, split = false }: Props) {
  const { timeSignature, key } = readMeta(song.doc);
  const { cols, sections } = columnsOf(song, timeSignature);
  const defs = allLanes(song.doc);
  const kindOf = (id: string) => (id === "words" || id === "chords" ? id : defs.find((l) => l.id === id)?.kind);
  const pianoRows = Object.fromEntries(lanes.filter((id) => kindOf(id) === "piano").map((id) => [id, usedKeys(song, id)]));
  const ctx: Ctx = { me, lanes, zoom, capo, notes, timeSignature, key, defs, kindOf, pianoRows };
  if (!split) return <StripGrid ctx={ctx} cols={cols} sections={sections} className="pb-6" />;

  // По рядках: структурна примітка — заголовок над першою смугою своєї частини.
  return (
    <div data-strip-split="" className="flex flex-col pb-24">
      {cols.map((c, col) => {
        const heads = sections.filter((s) => s.from === col);
        return (
          <div key={c.ln}>
            {heads.map((s, i) => (
              // Як ряд приміток у смузі: іконка в полі доріжок, лінія під рядом.
              <div key={i} className="mt-3 flex text-xs font-bold text-stone-700" style={{ height: SECTION_PX, boxShadow: RULE }}>
                <RowMark Icon={SECTION_ICON} name="Структурні примітки" height={SECTION_PX} edge />
                <span className="px-1.5" style={{ lineHeight: `${SECTION_PX}px` }}>
                  {s.name}
                </span>
              </div>
            ))}
            {c.empty ? (
              <div style={{ height: 14 }} />
            ) : (
              <div className="overflow-x-auto overscroll-x-contain">
                <StripGrid ctx={ctx} cols={[c]} sections={[]} className="pb-2" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type Ctx = {
  me: string | null;
  lanes: string[];
  zoom: number | undefined;
  capo: number;
  notes: NoteView[];
  timeSignature: string;
  key: string;
  defs: ReturnType<typeof allLanes>;
  kindOf: (id: string) => string | undefined;
  /** Клавіші, що видно в доріжках піаніно, — спільні для всіх рядків пісні. */
  pianoRows: Record<string, number[]>;
};

/** Сітка смуги з колонок `cols` — однієї на всю пісню чи однієї на рядок. */
function StripGrid({ ctx, cols, sections, className }: { ctx: Ctx; cols: Column[]; sections: Section[]; className: string }) {
  const { me, lanes, zoom, capo, notes, timeSignature, key, defs, kindOf } = ctx;
  const mark = usePlayMark();
  const hits = scaleOf("tab", timeSignature, zoom);
  const per = eighthsPerBar(timeSignature);

  const at = (col: number, row: number, extra: CSSProperties = {}): CSSProperties => ({ gridColumn: col + 2, gridRow: row, ...extra });
  // Поле доріжок: межа з піснею — його права лінія, тож при прокрутці вбік вона лишається.
  const sticky = (extra: CSSProperties = {}): CSSProperties => ({ position: "sticky", left: 0, zIndex: 3, background: PAPER, boxShadow: GUTTER_EDGE, ...extra });
  const items: ReactNode[] = [];
  /** Лінія між рядками пісні — ліворуч від колонки; у першої її немає: там межа поля доріжок. */
  const edgeOf = (col: number) => (col === 0 ? [] : [LINE_EDGE]);
  const shadow = (col: number, ...more: string[]) => [...edgeOf(col), ...more].join(", ") || undefined;
  // Згори вниз: таймлайн під самою панеллю, впритул під ним динаміка, далі ряд
  // структурних приміток — лише коли вони є.
  const sectionPx = sections.length ? SECTION_PX : 0;
  // Смужки динаміки: спільна, під нею моя.
  // +1 px — лінія під рядом, як під доріжкою.
  const dynPx = (me ? DYN_PX * 2 : DYN_PX) + 1;
  /** Висота всього, що тримається згори: таймлайн, примітка, динаміка. */
  const headPx = RULER_PX + sectionPx + dynPx;

  // Таймлайн і ряд структурних приміток у полі — як доріжки: іконка й лінія під
  // нею; над динамікою поле порожнє, але непрозоре (під ним їде пісня).
  items.push(
    <div key="gruler" style={{ gridColumn: 1, gridRow: 1, height: RULER_PX, ...sticky({ top: 0, zIndex: 5, boxShadow: `${GUTTER_EDGE}, ${RULE}` }) }}>
      <RowMark Icon={TIMELINE_ICON} name="Таймлайн" height={RULER_PX} />
    </div>,
  );
  items.push(<div key="gdyn" style={{ gridColumn: 1, gridRow: 2, height: dynPx, ...sticky({ top: RULER_PX, zIndex: 5, boxShadow: `${GUTTER_EDGE}, ${RULE}` }) }} />);
  if (sectionPx)
    items.push(
      <div key="gsections" style={{ gridColumn: 1, gridRow: 3, height: SECTION_PX, ...sticky({ top: RULER_PX + dynPx, zIndex: 5, boxShadow: `${GUTTER_EDGE}, ${RULE}` }) }}>
        <RowMark Icon={SECTION_ICON} name="Структурні примітки" height={SECTION_PX} />
      </div>,
    );

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
        style={{ gridColumn: `${s.from + 2} / ${s.to + 2}`, gridRow: 3, position: "sticky", top: RULER_PX + dynPx, zIndex: 2, height: SECTION_PX, background: PAPER, boxShadow: shadow(s.from) }}
      >
        <span className="sticky inline-block whitespace-nowrap px-1.5 text-xs font-bold text-stone-700" style={{ left: STRIP_GUTTER, lineHeight: `${SECTION_PX}px` }}>
          {s.name}
        </span>
      </div>,
    ),
  );
  // Лінії під таймлайном, динамікою й рядом приміток — самих рядів, а не окремих рядків чи
  // приміток: суцільні й там, де нічого немає (порожній рядок, до першої примітки).
  items.push(
    <div
      key="ruler-rule"
      className="pointer-events-none"
      style={{ gridColumn: "2 / -1", gridRow: 1, position: "sticky", top: 0, zIndex: 2, height: RULER_PX, boxShadow: RULE }}
    />,
  );
  items.push(
    <div
      key="dyn-rule"
      className="pointer-events-none"
      // Над смужками рядків (вони теж липнуть, з тлом).
      style={{ gridColumn: "2 / -1", gridRow: 2, position: "sticky", top: RULER_PX, zIndex: 3, height: dynPx, boxShadow: RULE }}
    />,
  );
  if (sectionPx)
    items.push(
      <div
        key="sections-rule"
        className="pointer-events-none"
        style={{ gridColumn: "2 / -1", gridRow: 3, position: "sticky", top: RULER_PX + dynPx, zIndex: 2, height: SECTION_PX, boxShadow: RULE }}
      />,
    );

  cols.forEach((c, col) => {
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
        style={at(col, 1, { position: "sticky", top: 0, zIndex: 1, height: RULER_PX, background: PAPER, boxShadow: shadow(col) })}
      >
        {sizes.map((size, b) => {
          const eighth = c.start + b * per;
          return (
            // Номер такту — посередині по висоті (над ним відступ, як під ним; нижня лінія — 1px).
            // Риска — перед кожним тактом, крім першого: там уже межа рядка чи поля доріжок.
            <span key={b} className={cn("relative flex shrink-0 items-center pb-px pl-0.5 leading-none", b > 0 && "border-l border-stone-300")} style={{ width: BAR_PX + size * STEP_PX }}>
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
    const Icon = kind && (!cells || kind === "blocks") ? LANE_ICON[kind as LaneKind] : null;
    // Піаніно лише для перегляду: клавіші від найнижчої до найвищої вживаної в пісні (із запасом), без нот — октава від C4.
    const pianoRows = kind === "piano" ? ctx.pianoRows[id] : undefined;
    const labels = pianoRows ? pianoRows.map((row) => PIANO_ROWS[row]) : rowsOf(kind as CellKind);
    const labelPx = kind === "piano" ? PIANO_ROW_PX : ROW_PX;
    items.push(
      <div key={`g${id}`} title={name} className="flex justify-end pr-1" style={{ gridColumn: 1, gridRow: row, ...sticky({ boxShadow: `${GUTTER_EDGE}, ${RULE}` }) }}>
        {Icon ? (
          <Icon aria-label={name} className="mt-1 size-3.5 shrink-0 text-stone-400" />
        ) : (
          <span aria-label={name} className={cn("pt-0.5 text-right font-mono text-stone-400", kind === "piano" ? "text-[8px]" : "text-[11px]")}>
            {labels.map((n, i) => (
              <div key={i} style={{ height: labelPx, lineHeight: `${labelPx}px` }}>
                {/* Піаніно — підписані лише межі октав (C). */}
                {kind !== "piano" || (n.startsWith("C") && !n.startsWith("C#")) ? n : ""}
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
          <div className="py-0.5" style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: STEPS_FONT_PX, lineHeight: 1.35, color: INK[kind as CellKind] }}>
            <StepRows version={stepsVersion(slot as Y.Map<unknown>, c.at.line, timeSignature)} kind={kind as CellKind} slot={slot as Y.Map<unknown>} line={c.at.line} timeSignature={timeSignature} zoom={zoom} marks={marks} rows={pianoRows} />
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
        <div key={`c${id}:${col}`} className="flex flex-col justify-end" style={at(col, cardsRow, { boxShadow: shadow(col), paddingRight: 8 })}>
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
        <div key={`${id}:${col}`} style={at(col, row, { boxShadow: shadow(col, RULE), paddingRight: 8 })}>
          {body}
        </div>,
      );
    });
  });

  return (
    <div
      data-strip=""
      className={cn("relative grid w-max min-w-full content-start", className)}
      // Ряди примітки й таймлайну — сталої висоти: на них стоять липкі відступи (`top`).
      style={{ gridTemplateColumns: `${STRIP_GUTTER}px repeat(${cols.length}, max-content)`, gridTemplateRows: `${RULER_PX}px ${dynPx}px ${sectionPx}px`, gridAutoRows: "auto" }}
    >
      {items}
      <div data-strip-needle="" className="pointer-events-none absolute top-0 bottom-0 z-[4] w-0.5 -ml-px bg-red-500/80" style={{ display: "none" }} />
    </div>
  );
}

/** Клавіші піаніно доріжки `lane`, на яких у пісні є ноти, — суцільним проміжком із запасом у дві; без нот — октава від C4. */
function usedKeys(song: Song, lane: string): number[] {
  const rows = layout(song).flatMap((l) => {
    const cells = (l.line.get(lane) as Y.Map<unknown> | undefined)?.get?.("cells");
    return cells instanceof Y.Map ? Array.from(cells.keys(), (key) => Number(String(key).split("/")[1]) - 1).filter((r) => r >= 0) : [];
  });
  const [top, bottom] = rows.length ? [Math.max(0, Math.min(...rows) - 2), Math.min(PIANO_ROWS.length - 1, Math.max(...rows) + 2)] : [PIANO_ROWS.indexOf("C5"), PIANO_ROWS.indexOf("C4")];
  return Array.from({ length: bottom - top + 1 }, (_, i) => top + i);
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

/** Іконка ряду смуги, що не доріжка (таймлайн, структурні примітки), у полі доріжок. */
function RowMark({ Icon, name, height, edge = false }: { Icon: typeof SECTION_ICON; name: string; height: number; edge?: boolean }) {
  return (
    <span title={name} className="flex shrink-0 items-center justify-end pr-1" style={{ width: STRIP_GUTTER, height, boxShadow: edge ? GUTTER_EDGE : undefined }}>
      <Icon aria-label={name} className={cn("text-stone-400", height < SECTION_PX ? "size-3" : "size-3.5")} />
    </span>
  );
}

/** Смужка динаміки рядка (тиша — темна риска). */
function DynBand({ at, layer }: { at: LineAt; layer: DynamicsLayer }) {
  const key = shownDynamics(at, layer);
  if (!key) return <div style={{ height: DYN_PX }} />;
  const color = getDynamicsStepColor(key);
  return <div style={{ height: DYN_PX, background: key === SILENCE ? `repeating-linear-gradient(90deg, ${color} 0 6px, transparent 6px 9px)` : color }} />;
}
