/**
 * Автоскрол, що йде (`SCROLL-4`…`SCROLL-14`, `SCROLL-25`, `SCROLL-26`):
 * спільний запис і правила, які з нього випливають.
 *
 * Позицію ніхто не пересилає щомиті — кожен пристрій сам рахує її зі свого
 * годинника: рядок триває два такти в темпі на момент старту (ADR-0004).
 * Запис пише старт, стоп і ініціатор, коли рухає гурт: дотик (позиція
 * стоїть) і відпускання (рахунок далі з його рядка). Годинники пристроїв
 * розходяться на десятки мілісекунд — для позиції в рядках це ніщо.
 */

export type AutoscrollRun = {
  /**
   * Рядок, від якого йде рахунок: фокусний рядок ініціатора в момент старту
   * (`SCROLL-3`) чи в момент, коли він востаннє відпустив екран (`SCROLL-26`).
   */
  row: number;
  /**
   * Момент натиску «старт», мс епохи. Відлік іде від нього; переноси його не
   * міняють — це той самий автоскрол (`follow.ts`, `SCROLL-20`).
   */
  startedAt: number;
  /** BPM пісні на момент старту — правка темпу діє з наступного старту. */
  bpm: number;
  /** Долі в такті — чисельник розміру (доля — як у `PLAY-35`). */
  beatsPerBar: number;
  /**
   * Пристрій, з якого стартували (`SCROLL-27`), і імʼя його людини — для
   * підпису біля кнопки в інших.
   */
  initiator: { device: string; name: string | null };
  /**
   * Коли ініціатор востаннє відпустив екран — рахунок іде від цього моменту,
   * без відліку. `null` — ще не переносили: рахунок від старту, з відліком.
   */
  movedAt: number | null;
  /** Палець ініціатора на екрані: позиція стоїть на `row` (`SCROLL-26`). */
  held: boolean;
};

export const startRun = ({
  row,
  now,
  header,
  initiator,
}: {
  row: number;
  now: number;
  header: { bpm: number; timeSignature: [number, number] };
  initiator: AutoscrollRun["initiator"];
}): AutoscrollRun => ({
  row,
  startedAt: now,
  bpm: header.bpm,
  beatsPerBar: header.timeSignature[0],
  initiator,
  movedAt: null,
  held: false,
});

export type RunPhase =
  /** Такт відліку перед рухом (`SCROLL-7`). `beat` — з нуля. */
  | { kind: "count-in"; row: number; beat: number }
  | { kind: "moving"; row: number }
  /** Позиція пройшла останній рядок — автоскрол скінчився (`SCROLL-10`). */
  | { kind: "ended" };

export const beatMs = (run: AutoscrollRun): number => 60_000 / run.bpm;

/** Де автоскрол у момент `now` для пісні з `rowCount` рядків. */
export const phaseAt = (
  run: AutoscrollRun,
  now: number,
  rowCount: number,
): RunPhase => {
  if (run.row >= rowCount) return { kind: "ended" };
  if (run.held) return { kind: "moving", row: run.row };

  const beat = beatMs(run);
  const bar = run.beatsPerBar * beat;
  // Після переносу відліку немає (`SCROLL-26`).
  const countIn = run.movedAt == null ? bar : 0;
  // Годинник ініціатора буває трохи попереду мого — тоді в мене ще нуль.
  const elapsed = Math.max(0, now - (run.movedAt ?? run.startedAt));

  if (elapsed < countIn) {
    return { kind: "count-in", row: run.row, beat: Math.floor(elapsed / beat) };
  }

  // Рядок — два такти (`SCROLL-13`).
  const row = run.row + Math.floor((elapsed - countIn) / (2 * bar));
  return row < rowCount ? { kind: "moving", row } : { kind: "ended" };
};

/**
 * Ініціатор торкнувся екрана, щоб рухати гурт (`SCROLL-26`): позиція стоїть
 * у всіх на рядку, де була в цю мить. Кінець пісні тут не важить — його
 * скаже `phaseAt`.
 */
export const holdRun = (run: AutoscrollRun, now: number): AutoscrollRun => {
  const phase = phaseAt(run, now, Infinity);
  return { ...run, row: phase.kind === "ended" ? run.row : phase.row, held: true };
};

/**
 * Ініціатор відпустив екран (`SCROLL-26`): позицією стає його фокусний
 * рядок, і рахунок іде звідти — без відліку, у темпі й розмірі з моменту
 * старту. Назад на початок секції — це повтор.
 */
export const moveRun = (
  run: AutoscrollRun,
  { row, now }: { row: number; now: number },
): AutoscrollRun => ({ ...run, row, movedAt: now, held: false });

/** Чи цей пристрій — ініціатор (`SCROLL-27`). */
export const isInitiator = (run: AutoscrollRun | null, device: string): boolean =>
  run?.initiator.device === device;

/** Хто може зупинити (`SCROLL-8`). */
export const canStop = (run: AutoscrollRun, device: string): boolean =>
  isInitiator(run, device);

/**
 * Де показати позицію в МОЄМУ показі. Рядок, схований фільтром чи
 * згортанням, показуємо на останньому видимому перед ним — у згорнутій
 * секції це її заголовок, і екран стоїть на ньому весь її час
 * (`SCROLL-17`).
 *
 * `visible` — номери видимих рядків за зростанням.
 */
export const displayRow = (visible: number[], row: number): number | null => {
  let shown: number | null = visible[0] ?? null;
  for (const candidate of visible) {
    if (candidate > row) break;
    shown = candidate;
  }
  return shown;
};

/**
 * Крок гортання на одну колонку (`SCROLL-18`): фактична ширина колонки плюс
 * проміжок. Браузер вміщує стільки колонок бажаної ширини, скільки влізе, і
 * розтягує їх на решту місця — та сама арифметика, що в CSS `column-width`.
 */
export const columnPitch = (width: number, desired: number, gap: number): number => {
  const count = Math.max(1, Math.floor((width + gap) / (desired + gap)));
  return (width - (count - 1) * gap) / count + gap;
};

/**
 * Той самий автоскрол — той самий старт, хоч позицію відтоді й переносили.
 * Інший — це вже стоп і новий старт.
 */
export const sameStart = (a: AutoscrollRun, b: AutoscrollRun): boolean =>
  a.startedAt === b.startedAt && a.initiator.device === b.initiator.device;

/** Той самий запис — щоб не віддавати новий обʼєкт на кожну зміну мапи. */
export const sameRun = (a: AutoscrollRun, b: AutoscrollRun): boolean =>
  a.row === b.row &&
  a.startedAt === b.startedAt &&
  a.bpm === b.bpm &&
  a.beatsPerBar === b.beatsPerBar &&
  a.initiator.device === b.initiator.device &&
  a.initiator.name === b.initiator.name &&
  a.movedAt === b.movedAt &&
  a.held === b.held;

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Запис зі спільної мапи кімнати гурту. Пише його інший пристрій, тож
 * перевіряємо форму: битий запис — немає автоскролу.
 */
export const parseRun = (value: unknown): AutoscrollRun | null => {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const initiator = v.initiator as Record<string, unknown> | null | undefined;
  if (
    !isNumber(v.row) ||
    !isNumber(v.startedAt) ||
    !isNumber(v.bpm) ||
    v.bpm <= 0 ||
    !isNumber(v.beatsPerBar) ||
    v.beatsPerBar <= 0 ||
    !initiator ||
    typeof initiator.device !== "string"
  ) {
    return null;
  }
  return {
    row: v.row,
    startedAt: v.startedAt,
    bpm: v.bpm,
    beatsPerBar: v.beatsPerBar,
    initiator: {
      device: initiator.device,
      name: typeof initiator.name === "string" ? initiator.name : null,
    },
    movedAt: isNumber(v.movedAt) ? v.movedAt : null,
    held: v.held === true,
  };
};
