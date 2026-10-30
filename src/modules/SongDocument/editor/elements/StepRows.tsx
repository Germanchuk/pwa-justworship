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
import type { ReactNode } from "react";
import { highlightBg, isStrike, OTHERS_NEUTRAL_COLOR, STRIKE_INK } from "#modules/SingleSong/components/SlateLyricsPlayground/comments/colors";
import { CellAt, CellKind, cellSpan, Line, NoteView, placeCells, rowsOf, stepsPerBeat } from "../../model";
import { BAR_PX, INK, ROW_PX, STEP_PX, stepGeometry } from "./stepGeometry";

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
};

export function StepRows({ kind, slot, line, timeSignature, zoom, marks, selected, here, clickable }: Props) {
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
  const row = (key: string, fn: (step: number) => ReactNode) => (
    <div key={key} className="whitespace-pre flex items-stretch" style={{ lineHeight: `${ROW_PX}px` }}>
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
