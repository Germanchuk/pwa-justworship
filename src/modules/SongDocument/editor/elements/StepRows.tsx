/**
 * Кроки клітинкової доріжки рядка на екрані — лінії тактів із кроками, без
 * поведінки: її додає той, хто показує (редактор — `CellLane`, горизонтальний
 * формат телефона — `landscape/Strip`). Тож доріжка в обох виглядає однаково.
 *
 * Крок на екрані — комірка сталої ширини `STEP_PX`, однакова в усіх видів,
 * для риски, ладу до 24, удару й шматка прямокутника, на будь-якому екрані
 * (не тягнеться й не стискається; не влазить — прокрутка вбік). Риска такту
 * теж сталої ширини, тож такти доріжок стоять одне під одним.
 * Двозначний лад стискається по горизонталі, щоб уміститись у крок. Текстом
 * (буфер) — як `renderCells`.
 *
 * Удари — у масштабі людини (`Scale`): подія в найближчій комірці; точно на
 * долі — звичайна, поруч — блідо-червона, що далі від долі — прозоріша; кілька в
 * одній комірці — буквально одна на одній. Позначене приміткою — підсвічене
 * її кольором (за часом, тож і в іншому масштабі).
 */
import * as Y from "yjs";
import { memo, type ReactNode } from "react";
import { highlightBg, isStrike, OTHERS_NEUTRAL_COLOR, STRIKE_INK } from "#modules/SingleSong/components/SlateLyricsPlayground/comments/colors";
import { CellAt, CellKind, cellSpan, isBlackKey, Line, NoteView, placeCells, rowsOf, stepsPerBeat } from "../../model";
import { BAR_PX, INK, PIANO_ROW_PX, rowPxOf, STEP_PX, stepGeometry, stepX } from "./stepGeometry";

const DASH = "linear-gradient(currentColor, currentColor) center / calc(100% - 2px) 1px no-repeat";
/** Фон кольором — шаром, щоб лягати під риску й під прямокутник. */
const fill = (color: string) => `linear-gradient(${color}, ${color})`;
/** Подія не на долі своєї комірки (дрібніша за сітку перегляду). */
const OFF_GRID_INK = "#f87171";
/** Кожна друга доля такту трохи темніша — як смуги в FL Studio. */
const BEAT_TINT = "rgba(120, 95, 50, 0.09)";
/** Виділені кроки — як виділений текст. */
const SELECTED = "rgba(59, 130, 246, 0.28)";

type Props = {
  /** Відбиток вмісту (`stepsVersion`): без зміни — без перемальовування. */
  version: string;
  kind: CellKind;
  slot: Y.Map<unknown>;
  line: Line;
  timeSignature: string;
  zoom?: number;
  /** Видимі позначки приміток цієї доріжки цього рядка (`at` — тіки). */
  marks: NoteView[];
  /** Виділені кроки (тіки рядка). */
  selected?: { from: number; to: number } | null;
  /** Курсор-крок. */
  here?: CellAt | null;
  /** Кроки клікабельні (правка). */
  clickable?: boolean;
  /** Які лінії показати (з 0); за замовчуванням — усі (піаніно в смузі — лише вживані клавіші). */
  rows?: readonly number[];
};

/** Чорні клавіші піаніно — трохи темніші, межа октави — лінією під C. */
const BLACK_KEY = "rgba(60, 50, 40, 0.07)";
const OCTAVE_EDGE = "inset 0 -1px 0 rgba(120, 95, 50, 0.22)";

function StepRowsView({ kind, slot, line, timeSignature, zoom, marks, selected, here, clickable, rows }: Props) {
  const ROW_PX = rowPxOf(kind);
  const { scale, stepPx, sizes } = stepGeometry(kind, line, timeSignature, zoom);
  const steps = scale.cells;
  // Доля — у кроках запису: смуги лягають за часом, а не за номером комірки.
  const beatTicks = (stepsPerBeat(timeSignature) * scale.grid) / 16;
  const placed = placeCells(kind, (slot.get("cells") as Y.Map<string>).entries(), sizes, scale);
  const shown = (at: CellAt) => placed.get(`${at.step}/${at.string}`);
  const read = (at: CellAt) => shown(at)?.value;

  /** Позначки приміток, що лягають на крок `step` (за часом — і в іншому масштабі). */
  const marksAt = (step: number): NoteView[] => {
    const [a, b] = cellSpan(scale, step);
    return marks.filter((n) => n.at!.from < b && n.at!.to > a);
  };
  const stepSpan = (at: CellAt, content: ReactNode, style: React.CSSProperties = {}) => {
    const tinted = Math.floor(((at.step % steps) * scale.tick) / beatTicks) % 2 === 1;
    const background = [style.background, tinted && fill(BEAT_TINT)].filter(Boolean).join(", ") || undefined;
    const [a, b] = cellSpan(scale, at.step);
    const inSelection = !!selected && selected.from < b && selected.to > a;
    const on = marksAt(at.step);
    const own = on.filter((n) => !n.foreign);
    const colors = own.map((n) => n.note.color);
    // Позначка — шаром під значенням (кілька — шарами), чужа — сірим; закреслення — рисою поверх.
    const fills = [...colors.filter((c) => !isStrike(c)), ...(on.some((n) => n.foreign) ? [OTHERS_NEUTRAL_COLOR] : [])].map((c) => fill(highlightBg(c)));
    const ids = own.map((n) => n.note.id).join(" ") || undefined;
    return (
      <span
        key={`${at.step}/${at.string}`}
        data-step={at.step}
        data-row={at.string}
        data-notes={ids}
        className={clickable ? "cursor-pointer" : undefined}
        // Курсор — тінню всередині, а не фоном: фон кроку — риска й смуга долі.
        style={{
          ...style,
          position: "relative",
          background,
          ...(here && here.step === at.step && here.string === at.string ? { boxShadow: "inset 0 0 0 99px rgba(59,130,246,0.3)", outline: "1px solid #3b82f6" } : {}),
        }}
      >
        {(fills.length > 0 || inSelection) && (
          <span
            data-note-fill={ids}
            className="pointer-events-none absolute inset-0"
            style={{ background: [...(inSelection ? [fill(SELECTED)] : []), ...fills].join(", ") }}
          />
        )}
        {content}
        {colors.some(isStrike) && (
          <span className="pointer-events-none absolute inset-x-0 z-[2]" style={{ top: "50%", height: 2, marginTop: -1, background: STRIKE_INK }} />
        )}
      </span>
    );
  };
  const fixed = (width: number): React.CSSProperties => ({ flex: "none", width, textAlign: "center" });
  /** Лінія доріжки: такти з кроками (назва лінії — до лінії поля). */
  const row = (key: string, fn: (step: number) => ReactNode, lineStyle: React.CSSProperties = {}) => (
    <div key={key} className="whitespace-pre flex items-stretch" style={{ lineHeight: `${ROW_PX}px`, ...lineStyle }}>
      {sizes.flatMap((size, b) => [
        <span key={`bar${b}`} className="text-stone-400" style={fixed(BAR_PX)}>
          |
        </span>,
        ...Array.from({ length: size }, (_, s) => fn(b * steps + s)),
      ])}
      <span key="end" className="text-stone-400" style={fixed(BAR_PX)}>
        |
      </span>
    </div>
  );
  /**
   * Крок лінії: риска, коли порожньо, інакше — значення по центру; не на долі
   * — сіріше й прозоріше, що далі. Кілька подій у комірці (дрібна партія в
   * грубій сітці) — буквально одна на одній: так видно, що їх там кілька.
   */
  const lineStep = (at: CellAt) => {
    const cell = shown(at);
    return stepSpan(
      at,
      cell?.all.map(({ value, off }, i) => (
        <span
          key={i}
          className="absolute inset-0 flex items-center justify-center"
          // Не на своїй долі — блідо-червона; що далі від долі, то трохи прозоріша.
          style={off ? { color: OFF_GRID_INK, opacity: 1 - off * 0.6 } : undefined}
        >
          {/* Двозначний лад стискається, щоб уміститись у крок. */}
          {value.length > 1 ? <span style={{ display: "inline-block", transform: "scaleX(0.7)" }}>{value}</span> : value}
        </span>
      )),
      {
        ...fixed(STEP_PX),
        display: "flex",
        alignItems: "center",
        justifyContent: "center", // ширший за крок лад виходить на обидва боки порівну
        height: ROW_PX,
        fontSize: 10,
        fontWeight: 600,
        color: cell ? INK[kind] : "#a8a29e",
        background: cell ? undefined : DASH,
      },
    );
  };

  // Таби — струна на лінію, кахон — вид удару на лінію.
  if (kind === "piano") return <PianoGrid {...{ sizes, steps, scale, beatTicks, placed, marks, selected, here, rows }} />;
  if (kind !== "blocks") return <>{rowsOf(kind).map((name, string) => row(name, (step) => lineStep({ step, string })))}</>;
  // Прямокутники: назва відкриває блок, «-» його тягне; порожній крок — «·».
  return row("blocks", (step) => {
    const v = read({ step, string: 0 });
    const start = !!v && v !== "-";
    const prevV = step > 0 && step % steps !== 0 ? read({ step: step - 1, string: 0 }) : undefined;
    const inBlock = start || (v === "-" && !!prevV);
    const lastInBar = (step % steps) + 1 >= sizes[Math.floor(step / steps)];
    const nextV = !lastInBar ? read({ step: step + 1, string: 0 }) : undefined;
    const ends = inBlock && nextV !== "-";
    return stepSpan(
      { step, string: 0 },
      start ? <span className="relative z-[1] font-bold">{v}</span> : inBlock ? " " : "·",
      {
        ...fixed(stepPx),
        display: "inline-block",
        textAlign: "left",
        color: inBlock ? INK.blocks : "#a8a29e",
        background: inBlock ? fill("rgba(59,130,246,0.12)") : undefined,
        borderTop: inBlock ? "1px solid rgba(30,64,175,0.4)" : undefined,
        borderBottom: inBlock ? "1px solid rgba(30,64,175,0.4)" : undefined,
        borderLeft: start ? "1px solid rgba(30,64,175,0.6)" : undefined,
        borderRight: ends ? "1px solid rgba(30,64,175,0.6)" : undefined,
        borderRadius: start && ends ? 3 : start ? "3px 0 0 3px" : ends ? "0 3px 3px 0" : undefined,
        overflow: "visible",
      },
    );
  });
}

/** Перемалювати кроки, лише коли змінилось те, що на них видно. */
const sameSteps = (a: Props, b: Props) =>
  a.version === b.version &&
  a.kind === b.kind &&
  a.timeSignature === b.timeSignature &&
  a.zoom === b.zoom &&
  a.clickable === b.clickable &&
  (a.rows?.join() ?? "") === (b.rows?.join() ?? "") &&
  a.selected?.from === b.selected?.from &&
  a.selected?.to === b.selected?.to &&
  a.here?.step === b.here?.step &&
  a.here?.string === b.here?.string &&
  marksKey(a.marks) === marksKey(b.marks);
const marksKey = (marks: NoteView[]) => marks.map((n) => `${n.note.id}:${n.note.color}:${n.at?.from}:${n.at?.to}:${n.foreign ? 1 : 0}`).join(",");

export const StepRows = memo(StepRowsView, sameSteps);

type GridProps = {
  sizes: readonly number[];
  steps: number;
  scale: ReturnType<typeof stepGeometry>["scale"];
  beatTicks: number;
  placed: ReturnType<typeof placeCells>;
  marks: NoteView[];
  selected?: { from: number; to: number } | null;
  here?: CellAt | null;
  rows?: readonly number[];
};

/**
 * Піаніно — як piano roll і без елемента на кожну клітинку (88 клавіш × кроки
 * в кожному рядку пісні — десятки тисяч елементів, і перемальовування гальмує
 * весь редактор). Сітка — фоном: смуги клавіш, рисок тактів і долей; елементи —
 * лише ноти, позначки, виділене й курсор. Порожня клітинка — без риски, чорні
 * клавіші притінені, межа октави — лінією під C.
 */
function PianoGrid({ sizes, steps, scale, beatTicks, placed, marks, selected, here, rows }: GridProps) {
  const names = rowsOf("piano");
  const list = rows ?? names.map((_, i) => i);
  const yOf = new Map(list.map((row, i) => [row, i * PIANO_ROW_PX]));
  const width = (sizes.length + 1) * BAR_PX + sizes.reduce((a, b) => a + b, 0) * STEP_PX;
  const x = (step: number) => stepX(step, steps, STEP_PX);
  const total = (sizes.length - 1) * steps + sizes[sizes.length - 1];
  /** Комірки, що перетинають проміжок `from…to` (тіки рядка), — смугою від першої до останньої. */
  const band = (from: number, to: number) => {
    const hit = Array.from({ length: total }, (_, i) => i).filter((i) => {
      const [a, b] = cellSpan(scale, i);
      return a < to && b > from;
    });
    return hit.length ? { left: x(hit[0]), width: x(hit[hit.length - 1]) + STEP_PX - x(hit[0]) } : null;
  };
  const layers: ReactNode[] = [];
  // Рядки клавіш: чорні — тінню, межа октави — лінією під C.
  list.forEach((row, i) => {
    const black = isBlackKey(row);
    const c = names[row].startsWith("C") && !names[row].startsWith("C#");
    if (black || c) layers.push(<div key={`k${row}`} className="absolute inset-x-0" style={{ top: i * PIANO_ROW_PX, height: PIANO_ROW_PX, background: black ? BLACK_KEY : undefined, boxShadow: c ? OCTAVE_EDGE : undefined }} />);
  });
  // Такти: риска перед кожним і в кінці; кожна друга доля — темніша смугою.
  sizes.forEach((size, b) => {
    layers.push(<div key={`b${b}`} className="absolute inset-y-0" style={{ left: x(b * steps) - BAR_PX / 2 - 0.5, width: 1, background: BAR_INK }} />);
    let run: number | null = null;
    for (let s = 0; s <= size; s++) {
      const tinted = s < size && Math.floor((s * scale.tick) / beatTicks) % 2 === 1;
      if (tinted && run === null) run = s;
      if (!tinted && run !== null) {
        layers.push(<div key={`t${b}.${run}`} className="absolute inset-y-0" style={{ left: x(b * steps + run), width: (s - run) * STEP_PX, background: BEAT_TINT }} />);
        run = null;
      }
    }
  });
  layers.push(<div key="end" className="absolute inset-y-0" style={{ left: width - BAR_PX / 2 - 0.5, width: 1, background: BAR_INK }} />);
  // Позначки приміток — смугою на всю висоту (тап по ній — меню позначки), виділене — так само.
  marks.forEach((n) => {
    const at = band(n.at!.from, n.at!.to);
    if (!at) return;
    const color = n.foreign ? OTHERS_NEUTRAL_COLOR : n.note.color;
    layers.push(
      <div
        key={`m${n.note.id}`}
        data-notes={n.foreign ? undefined : n.note.id}
        data-note-fill={n.foreign ? undefined : n.note.id}
        className="absolute inset-y-0"
        style={{ ...at, background: isStrike(color) ? undefined : highlightBg(color), borderTop: isStrike(color) ? `2px solid ${STRIKE_INK}` : undefined }}
      />,
    );
  });
  const sel = selected && band(selected.from, selected.to);
  if (sel) layers.push(<div key="sel" className="pointer-events-none absolute inset-y-0" style={{ ...sel, background: SELECTED }} />);
  // Ноти: заповнений прямокутник; не на долі комірки — блідо-червоний, прозоріший, що далі.
  placed.forEach((cell, key) => {
    const [step, row] = key.split("/").map(Number);
    const top = yOf.get(row);
    if (top === undefined) return;
    cell.all.forEach(({ off }, i) =>
      layers.push(
        <div
          key={`n${key}.${i}`}
          className="pointer-events-none absolute rounded-[2px]"
          style={{ left: x(step) + 1, top: top + 1, width: STEP_PX - 2, height: PIANO_ROW_PX - 2, background: off ? OFF_GRID_INK : INK.piano, opacity: off ? 1 - off * 0.6 : 1 }}
        />,
      ),
    );
  });
  if (here && yOf.has(here.string)) {
    layers.push(
      <div
        key="cursor"
        className="pointer-events-none absolute"
        style={{ left: x(here.step), top: yOf.get(here.string), width: STEP_PX, height: PIANO_ROW_PX, boxShadow: "inset 0 0 0 99px rgba(59,130,246,0.3)", outline: "1px solid #3b82f6" }}
      />,
    );
  }
  return (
    <div data-piano-grid="" className="relative" style={{ width, height: list.length * PIANO_ROW_PX }}>
      {layers}
    </div>
  );
}

/** Риска такту на сітці піаніно — як «|» у решти доріжок. */
const BAR_INK = "rgba(120, 113, 108, 0.45)";
