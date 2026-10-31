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
 * триває стільки, скільки прописано (`lineLength`). Межа рядків — як межа
 * тактів, а порожній рядок у смузі місця не займає (на ПК — проміжок між
 * смугами); структурна примітка колонки не має — вона заголовок усього, що
 * за нею, до наступної.
 *
 * Сама смуга — лише вигляд: виділені кроки (`steps`) їй передають, а
 * виділяють і правлять поза нею (`useStripSteps`, `StripCellEditor`).
 */
import * as Y from "yjs";
import { cn } from "@/lib/utils";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { transposeChordTextForCapo } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/transposeChords";
import type { SongKeyValue } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/model";
import { highlightBg, isStrike, STRIKE_INK } from "#modules/SingleSong/components/SlateLyricsPlayground/comments/colors";
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
  updateNote,
} from "../../model";
import { INK, BAR_PX, PIANO_ROW_PX, ROW_PX, rowPxOf, STEP_PX, stepGeometry, STEPS_FONT_PX, stepsVersion } from "../elements/stepGeometry";
import { StepRows } from "../elements/StepRows";
import { LANE_ICON, SECTION_ICON, TIMELINE_ICON } from "../laneIcons";
import { setPlayMark, usePlayMark } from "../playback/mark";
import { NoteCardBox } from "../notes/NoteCard";
import type { StepsSel } from "./useStripSteps";

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
const GUTTER_EDGE = "inset -1px 0 0 rgba(120, 95, 50, 0.22)";
const RULE = "inset 0 -1px 0 0 rgba(120, 95, 50, 0.14)";
/** Розділювач тактів таймлайну (і початок частини) — посередині місця риски такту доріжок (`BAR_PX`). */
const RULER_TICK = `linear-gradient(#d6d3d1, #d6d3d1) ${BAR_PX / 2 - 1}px 0 / 1px 100% no-repeat`;
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
  /** Виділені кроки клітинкової доріжки (`useStripSteps`). */
  steps?: StepsSel | null;
  /** Картки приміток правляться (в будь-якому режимі, як у редакторі); без цього — лише показ. */
  cardsEdit?: CardsEdit;
};

/** Правка карток: чиїми очима дивлюсь і картки, щойно додані без тексту (`useStripSteps`). */
type CardsEdit = { viewers: string[]; drafts: string[]; dropDraft: (id: string) => void };

export function Strip({ song, me, lanes, zoom, capo, notes, split = false, steps = null, cardsEdit }: Props) {
  const { timeSignature, key } = readMeta(song.doc);
  const { cols, sections } = columnsOf(song, timeSignature);
  const defs = allLanes(song.doc);
  const kindOf = (id: string) => (id === "words" || id === "chords" ? id : defs.find((l) => l.id === id)?.kind);
  const pianoRows = Object.fromEntries(lanes.filter((id) => kindOf(id) === "piano").map((id) => [id, usedKeys(song, id)]));
  const ctx: Ctx = { song, me, lanes, zoom, capo, notes, timeSignature, key, defs, kindOf, pianoRows, steps, cardsEdit };
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
  steps: StepsSel | null;
  song: Song;
  cardsEdit: CardsEdit | undefined;
};

/** Сітка смуги з колонок `cols` — однієї на всю пісню чи однієї на рядок. */
function StripGrid({ ctx, cols, sections, className }: { ctx: Ctx; cols: Column[]; sections: Section[]; className: string }) {
  const { song, me, lanes, zoom, capo, notes, timeSignature, key, defs, kindOf, steps, cardsEdit } = ctx;
  const mark = usePlayMark();
  const hits = scaleOf("tab", timeSignature, zoom);
  const per = eighthsPerBar(timeSignature);

  const at = (col: number, row: number, extra: CSSProperties = {}): CSSProperties => ({ gridColumn: col + 2, gridRow: row, ...extra });
  // Поле доріжок: межа з піснею — його права лінія, тож при прокрутці вбік вона лишається.
  const sticky = (extra: CSSProperties = {}): CSSProperties => ({ position: "sticky", left: 0, zIndex: 3, background: PAPER, boxShadow: GUTTER_EDGE, ...extra });
  const items: ReactNode[] = [];
  /**
   * Межа рядків — як межа тактів (2026-10-31): рядок не закриває себе рискою —
   * нею стає риска на початку наступного. Порожній рядок (межа частин) місця не
   * займає; частини видно з ряду структурних приміток. Закриває лише останній.
   */
  const closes = (col: number) => !cols.slice(col + 1).some((c) => !c.empty);
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
        // Початок частини — риска в одну вертикаль із рисками тактів, як на таймлайні.
        style={{ gridColumn: `${s.from + 2} / ${s.to + 2}`, gridRow: 3, position: "sticky", top: RULER_PX + dynPx, zIndex: 2, height: SECTION_PX, background: `${RULER_TICK}, ${PAPER}` }}
      >
        <span className="sticky inline-block whitespace-nowrap pr-1.5 text-xs font-bold text-stone-700" style={{ left: STRIP_GUTTER, paddingLeft: BAR_PX / 2 + 4, lineHeight: `${SECTION_PX}px` }}>
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
    if (c.empty) return;
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
        className="flex items-stretch text-left text-xs text-stone-600"
        style={at(col, 1, { position: "sticky", top: 0, zIndex: 1, height: RULER_PX, background: PAPER })}
      >
        {sizes.map((size, b) => {
          const eighth = c.start + b * per;
          return (
            // Номер такту — посередині по висоті (над ним відступ, як під ним; нижня лінія — 1px).
            // Риска — перед кожним тактом, в одну вертикаль із рискою такту доріжок.
            <span
              key={b}
              className="relative flex shrink-0 items-center pb-px leading-none"
              style={{ width: BAR_PX + size * STEP_PX, paddingLeft: BAR_PX / 2 + 4, background: RULER_TICK }}
            >
              {Math.floor(eighth / per) + 1}
              {eighth % per ? `.${eighth % per}` : ""}
              {b === 0 && mark === c.ln && <span className="ml-0.5 text-red-500">▶</span>}
            </span>
          );
        })}
        {closes(col) && <span className="shrink-0" style={{ width: BAR_PX }} />}
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
      const slot = c.at.line.get(id);
      let body: ReactNode = null;
      if (cells && slot instanceof Y.Map && slot.has("cells")) {
        body = (
          <div className="py-0.5" style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: STEPS_FONT_PX, lineHeight: 1.35, color: INK[kind as CellKind] }}>
            <StepsBox ln={c.ln} lane={id} kind={kind as CellKind} line={c.at.line} timeSignature={timeSignature} zoom={zoom} rows={pianoRows?.length}>
              <StepRows version={stepsVersion(slot as Y.Map<unknown>, c.at.line, timeSignature)} kind={kind as CellKind} slot={slot as Y.Map<unknown>} line={c.at.line} timeSignature={timeSignature} zoom={zoom} marks={marks} selected={steps && steps.ln === c.ln && steps.lane === id ? steps : null} rows={pianoRows} end={closes(col)} />
            </StepsBox>
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
        <div key={`${id}:${col}`} style={at(col, row, { boxShadow: RULE, paddingRight: closes(col) ? 8 : 0 })}>
          {body}
        </div>,
      );
    });
    const shown = new Set(cols.filter((c) => !c.empty).map((c) => c.ln));
    const cards = notes.filter(
      (n) => shown.has(n.line) && n.lane === id && n.status === "visible" && n.at && !n.foreign && (n.note.body || cardsEdit?.drafts.includes(n.note.id)),
    );
    items.push(<LaneCards key={`c${id}`} song={song} cards={cards} edit={cardsEdit} style={{ gridColumn: `2 / span ${cols.length}`, gridRow: cardsRow }} />);
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
      {/* Виділення правки — стовпчик і комірка в ньому (`StripCellEditor` ставить їх сам, поза React); під липкими рядами — їхня висота в `data-head-px`. */}
      <div data-strip-column="" className="pointer-events-none absolute" style={{ display: "none", background: "rgba(59,130,246,0.14)" }} />
      <div data-strip-cursor="" data-head-px={headPx} className="pointer-events-none absolute" style={{ display: "none", boxShadow: "inset 0 0 0 99px rgba(59,130,246,0.3)", outline: "2px solid #3b82f6" }} />
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
          <span key={from} style={style} data-notes={on.map((n) => n.note.id).join(" ") || undefined}>
            {text.slice(from, to)}
          </span>
        );
      })}
    </>
  );
}

/**
 * Рамка кроків доріжки рядка з її геометрією в `data-*` — за нею правка
 * (`StripCellEditor`) знаходить комірку під пальцем без React: ті самі
 * розміри, що й малюють кроки (`stepGeometry`).
 */
function StepsBox({ ln, lane, kind, line, timeSignature, zoom, rows, children }: { ln: number; lane: string; kind: CellKind; line: LineAt["line"]; timeSignature: string; zoom: number | undefined; rows?: number; children: ReactNode }) {
  const { scale, stepPx, sizes } = stepGeometry(kind, line, timeSignature, zoom);
  return (
    <div
      data-strip-steps=""
      data-ln={ln}
      data-lane={lane}
      data-kind={kind}
      data-cells={scale.cells}
      data-step-px={stepPx}
      data-sizes={sizes.join()}
      data-rows={rows ?? rowsOf(kind).length}
      data-row-px={rowPxOf(kind)}
    >
      {children}
    </div>
  );
}

/** Проміжок між картками в ряду й між рядами карток. */
const CARD_GAP = 4;

/**
 * Картки приміток доріжки — рядом над нею (`NOTE-50`). Кожна починається там
 * само, де її позначка, і завширшки як її текст. Картки йдуть за часом і
 * стають у перший ряд, де ні на що не налазять: без накладок — в один ряд,
 * з накладкою — раніша вище, пізніша рядом нижче.
 *
 * Де позначка — питаємо в самої смуги (`data-notes`, `data-note-fill`): так
 * однаково для кроків, піаніно й тексту. Тому розкладка — після малювання.
 */
function LaneCards({ song, cards, edit, style }: { song: Song; cards: NoteView[]; edit: CardsEdit | undefined; style: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [spots, setSpots] = useState<Record<string, { left: number; top: number }>>({});
  const [height, setHeight] = useState(0);
  // Картка змінила розмір (довантажився шрифт, пишуть текст) — розкласти заново.
  const [, refit] = useState(0);
  const [observer] = useState(() => (typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => refit((n) => n + 1))));
  useEffect(() => () => observer?.disconnect(), [observer]);
  useEffect(() => ref.current?.querySelectorAll("[data-card]").forEach((c) => observer?.observe(c)));

  // Щоразу після малювання: позначки рухаються разом із рештою смуги (масштаб, правка); пише лише те, що змінилось.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = ref.current;
    const strip = el?.closest("[data-strip]");
    if (!el || !strip) return;
    const base = el.getBoundingClientRect().left;
    const placed = cards
      .map((n) => {
        const id = CSS.escape(n.note.id);
        const lefts = Array.from(strip.querySelectorAll(`[data-notes~="${id}"], [data-note-fill~="${id}"]`), (a) => a.getBoundingClientRect().left);
        const card = el.querySelector<HTMLElement>(`[data-card="${id}"]`);
        return { id: n.note.id, left: Math.round((lefts.length ? Math.min(...lefts) : base) - base), width: card?.offsetWidth ?? 0, height: card?.offsetHeight ?? 0 };
      })
      .sort((a, b) => a.left - b.left);
    // Ряди: де кожен закінчується і яка в нього висота.
    const rows: { end: number; height: number }[] = [];
    const at: Record<string, { left: number; row: number }> = {};
    for (const c of placed) {
      let row = rows.findIndex((r) => r.end + CARD_GAP <= c.left);
      if (row < 0) row = rows.push({ end: 0, height: 0 }) - 1;
      rows[row] = { end: c.left + c.width, height: Math.max(rows[row].height, c.height) };
      at[c.id] = { left: c.left, row };
    }
    const tops = rows.map((_, i) => rows.slice(0, i).reduce((sum, r) => sum + r.height + CARD_GAP, CARD_GAP));
    const next = Object.fromEntries(Object.entries(at).map(([id, { left, row }]) => [id, { left, top: tops[row] }]));
    const total = rows.length ? tops[rows.length - 1] + rows[rows.length - 1].height + CARD_GAP : 0;
    if (JSON.stringify(next) !== JSON.stringify(spots)) setSpots(next);
    if (total !== height) setHeight(total);
  });

  return (
    <div ref={ref} className="relative" style={{ ...style, height }}>
      {cards.map((n) => (
        <div key={n.note.id} data-card={n.note.id} className="absolute w-max max-w-72" style={spots[n.note.id] ?? { left: 0, top: 0, visibility: "hidden" }}>
          <NoteCardBox
            fit
            view={n}
            canAnnotate={!!edit}
            viewers={edit?.viewers ?? []}
            onBody={(body) => song.doc.transact(() => updateNote(n.holder, n.lane, n.note.id, { body }))}
            onBlur={() => edit?.dropDraft(n.note.id)}
          />
        </div>
      ))}
    </div>
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
