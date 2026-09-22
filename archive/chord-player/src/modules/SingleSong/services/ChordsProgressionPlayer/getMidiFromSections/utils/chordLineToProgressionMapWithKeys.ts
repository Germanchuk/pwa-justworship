import type {ChordEvent} from "./createMidiFromProgression";
import {INCOMPLETE_BAR_MARK} from "#utils/chordSyntax";

export interface LineToken {
  token: string;
  /** Index of this token in the flat per-line stream (including `.` continuations and `|` bars). */
  tokenIndex: number;
  /** Character offset of token start within the original line text. */
  charStart: number;
  /** Character offset just after the last char of the token. */
  charEnd: number;
}

/**
 * Tokenize a chord-line text into a flat stream of `|`, `.`, and chord-name tokens,
 * preserving each token's character offsets within the original string. The dot-glue
 * splitting matches `chordLineToProgressionMap`'s lexer so token indexes stay aligned.
 */
export function tokenizeChordLine(text: string): LineToken[] {
  const out: LineToken[] = [];
  let tokenIndex = 0;
  const wordRe = /\S+/g;
  let m: RegExpExecArray | null;

  while ((m = wordRe.exec(text)) !== null) {
    const word = m[0];
    const wordStart = m.index;

    if (word === "|") {
      out.push({token: "|", tokenIndex: tokenIndex++, charStart: wordStart, charEnd: wordStart + 1});
      continue;
    }

    // Split into runs of '.' and non-'.' while preserving offsets.
    const subRe = /\.+|[^.]+/g;
    let s: RegExpExecArray | null;
    while ((s = subRe.exec(word)) !== null) {
      const piece = s[0];
      const pieceStart = wordStart + s.index;

      if (piece.startsWith(".")) {
        // Each '.' is its own continuation token.
        for (let i = 0; i < piece.length; i++) {
          const at = pieceStart + i;
          out.push({token: ".", tokenIndex: tokenIndex++, charStart: at, charEnd: at + 1});
        }
        continue;
      }

      // Non-dot piece may still contain '|' if user wrote `G|D` without spaces.
      const barRe = /\||[^|]+/g;
      let b: RegExpExecArray | null;
      while ((b = barRe.exec(piece)) !== null) {
        const sub = b[0];
        const subStart = pieceStart + b.index;
        if (sub === "|") {
          out.push({token: "|", tokenIndex: tokenIndex++, charStart: subStart, charEnd: subStart + 1});
        } else {
          out.push({
            token: sub,
            tokenIndex: tokenIndex++,
            charStart: subStart,
            charEnd: subStart + sub.length,
          });
        }
      }
    }
  }

  return out;
}

/**
 * ── Такт як коробка ─────────────────────────────────────────────────────────
 *
 * Такт триває рівно один розмір — стільки долей, скільки каже чисельник, — а
 * все написане всередині ділить цю тривалість **порівну**. Кожен токен (акорд,
 * тиша, крапка) займає один слот; розмір слота = розмір такту / кількість
 * слотів. Тому в 4/4:
 *
 *   `| C |`                    один слот  → C на весь такт
 *   `| C G |`                  два слоти  → по половині
 *   `| C . . . |`              чотири     → по чверті
 *   `| C . . . . . . Em |`     вісім      → по вісімці, Em на останню
 *
 * Роздільність не зашита в розмір: її задає сам рядок. Саме тому синкопу на
 * останню вісімку можна записати, не міняючи розміру пісні.
 *
 * `!` — теж слот, нарівні з акордом і тишею. Він не міняє сітку, а лише каже,
 * де музика спиняється: усе після нього такт **домальовує** — задає
 * роздільність, але не звучить.
 *
 *   `| C . ! . |`              чотири слоти по чверті → звучать дві
 *   `| C . . . . . . ! . |`    вісім слотів по вісімці → звучать сім
 *
 * Тому вкорочений такт має таку саму роздільність, як звичайний, і позначка
 * не здатна збрехати: займаючи слот, вона коротшає такт завжди.
 */
export interface BarInfo {
  /** Слоти, що звучать — усе до першого `!`. Крапка теж слот. */
  tokens: LineToken[];
  /**
   * Скільки слотів написано в такті **разом** із `!` і тим, що після нього.
   * Саме це число задає роздільність і перевіряється на чистоту поділу.
   */
  slotCount: number;
  /** Тривалість такту в долях: `slotSize` × кількість слотів, що звучать. */
  length: number;
  /** Тривалість одного слота в долях. Дробова, коли слотів більше за долі. */
  slotSize: number;
  /** У такті стоїть `!`: такт обривається раніше — так і задумано. */
  marked: boolean;
  /**
   * Хвіст такту від першого `!` включно. Ці слоти домальовують сітку, але не
   * звучать — редактор показує їх приглушено, щоб написане й почуте не
   * розходились мовчки.
   */
  silentTail: LineToken[];
  /**
   * Крапки до першого звуку такту. Їм нема чого продовжувати: такий запис
   * читається як «акорд тягнеться», а грає тишею — тиша пишеться `_`.
   */
  leadingDots: LineToken[];
  /**
   * Межі такту в тексті рядка — від відкривальної риски до закривальної
   * включно. Проблему показуємо на всьому такті: помилка стосується його
   * цілком, а не тієї риски, біля якої її помітили.
   */
  charStart: number;
  charEnd: number;
}

const isPowerOfTwo = (n: number) => n >= 1 && (n & (n - 1)) === 0;

/**
 * Чи ділиться такт на таку кількість слотів «чисто» — тобто чи виходить із
 * цього справжня нотна тривалість.
 *
 * Чисто — це або кожен слот у ціле число долей (`| C G |` у 4/4 — по дві), або
 * доля, поділена навпіл, на чотири, на вісім (`| ... 8 слотів ... |` у 4/4 —
 * вісімки). Усе інше — 3 слоти в 4/4, 5 слотів — дає тріолі та квінтолі, які
 * майже завжди означають забуту крапку, а не задум.
 */
export function isCleanDivision(slots: number, pulsesPerBar: number): boolean {
  if (slots <= 0 || pulsesPerBar <= 0) return false;
  if (pulsesPerBar % slots === 0) return true;
  if (slots % pulsesPerBar === 0) return isPowerOfTwo(slots / pulsesPerBar);
  return false;
}

/**
 * Розбирає рядок на такти й рахує довжину кожного — спільне джерело правди
 * для прогресії (`chordLineToProgressionMapWithKeys`) і для перевірки довжини
 * такту в редакторі. Двох різних лічильників бути не повинно.
 */
export function analyzeBars(text: string, pulsesPerBar: number): BarInfo[] {
  const all = tokenizeChordLine(text);
  const bars: BarInfo[] = [];

  // Усі слоти такту підряд, `!` включно: сітку задає весь написаний такт.
  let slots: LineToken[] = [];
  let opener: LineToken | null = null;

  const flush = (closer: LineToken | null) => {
    // Порожній сегмент — такт лише тоді, коли він справді стоїть між двома
    // рисками (`| |`): хвости до першої риски та після останньої тактами не є.
    if (slots.length === 0 && (opener === null || closer === null)) return;

    // Звучить усе до першого `!`; решта домальовує сітку, але мовчить.
    const cut = slots.findIndex((tk) => tk.token === INCOMPLETE_BAR_MARK);
    const sounding = cut === -1 ? slots : slots.slice(0, cut);
    const silentTail = cut === -1 ? [] : slots.slice(cut);
    const slotSize = slots.length === 0 ? 0 : pulsesPerBar / slots.length;

    const leadingDots: LineToken[] = [];
    for (const tk of sounding) {
      if (tk.token !== ".") break;
      leadingDots.push(tk);
    }

    bars.push({
      tokens: sounding,
      slotCount: slots.length,
      length: sounding.length * slotSize,
      slotSize,
      marked: cut !== -1,
      silentTail,
      leadingDots,
      charStart: opener?.charStart ?? slots[0].charStart,
      charEnd: closer?.charEnd ?? slots[slots.length - 1].charEnd,
    });
    slots = [];
  };

  for (const tk of all) {
    if (tk.token === "|") {
      flush(tk);
      opener = tk;
    } else {
      slots.push(tk);
    }
  }
  flush(null);

  return bars;
}

/**
 * Такти, у яких запис розходиться з тим, що прозвучить, — те, що редактор
 * підкреслює. Чотири випадки:
 *
 *   1. Нечистий поділ (`isCleanDivision`): три слоти в 4/4 — тріолі, а хотіли
 *      майже напевно чотири чверті з забутою крапкою. Рахуємо **всі** написані
 *      слоти, `!` включно: сітку задає весь такт.
 *   2. Крапка на початку такту: їй нема чого продовжувати, тож грає тишею,
 *      хоча читається як «акорд тягнеться». Тиша пишеться `_`.
 *   3. Такт, що не звучить: `| |` недописаний, `| ! . . |` обірваний на нулі.
 *      Виглядає тактом, а часу не займає.
 *
 * Перевірки на «позначка бреше» тут немає й бути не може: `!` займає слот, тож
 * такт із ним коротший завжди.
 *
 * Спільна властивість, яку тримають ці перевірки: не існує запису, що виглядає
 * одним, а грає іншим мовчки. Викликати лише для рядків, що пройшли
 * `isPlayableChordLine`: рядок без рисок не заявляє тактів, судити нема за чим.
 */
export function findBarDivisionIssues(text: string, pulsesPerBar: number): BarInfo[] {
  return analyzeBars(text, pulsesPerBar).filter((bar) => {
    if (bar.tokens.length === 0) return true;
    if (bar.leadingDots.length > 0) return true;
    return !isCleanDivision(bar.slotCount, pulsesPerBar);
  });
}

/**
 * Слоти, що не звучать: усе від `!` до кінця такту. Редактор глушить їх, щоб
 * було видно, де музика спиняється, — інакше акорд, дописаний після `!`,
 * виглядав би так само, як той, що звучить.
 */
export function findSilentTails(text: string, pulsesPerBar: number): LineToken[] {
  return analyzeBars(text, pulsesPerBar).flatMap((bar) => bar.silentTail);
}

/**
 * A chord or group of chords must live inside a properly opened AND closed bar
 * — i.e. the trimmed line must start with `|` and end with `|`. Otherwise we
 * have no measure boundaries and refuse to invent durations.
 *
 * Lines that satisfy the rule but carry no chord tokens (e.g. `|`, `| |`) are
 * "playable" structurally — just silent. Not invalid.
 */
export function isPlayableChordLine(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

/**
 * Slate-aware analogue of `chordLineToProgressionMap`. Reproduces the bar/dot/chord
 * lexer semantics but tags every chord-event with a stable token key derived from
 * its position in the document.
 *
 * `tokenKey` format: `${sectionIndex}:${chordLineIndex}:${tokenIndex}`.
 * Rest events (chord === null) emit `tokenKey: null`.
 */
export function chordLineToProgressionMapWithKeys(
  text: string,
  sectionIndex: number,
  chordLineIndex: number,
  beatsPerBar = 4,
): ChordEvent[] {
  const makeKey = (tokenIndex: number) =>
    `${sectionIndex}:${chordLineIndex}:${tokenIndex}`;

  const out: ChordEvent[] = [];

  for (const bar of analyzeBars(text, beatsPerBar)) {
    if (bar.tokens.length === 0) continue;

    // Кожен токен — слот. Крапка продовжує попередній акорд ще на один слот;
    // крапка на початку такту продовжувати нема чого, тож стає тишею — такт
    // читається самостійно, через риску акорд не тягнеться.
    const startIdx = out.length;
    for (const tk of bar.tokens) {
      if (tk.token === ".") {
        if (out.length === startIdx) {
          out.push({chord: null, duration: bar.slotSize, tokenKey: null});
        } else {
          out[out.length - 1].duration += bar.slotSize;
        }
      } else {
        out.push({
          chord: tk.token,
          duration: bar.slotSize,
          tokenKey: makeKey(tk.tokenIndex),
        });
      }
    }
  }

  return out;
}
