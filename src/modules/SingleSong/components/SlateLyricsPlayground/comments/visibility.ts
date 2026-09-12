/**
 * КОМУ НАЛЕЖИТЬ ПОЗНАЧКА.
 *
 * Кожна мітка на тексті (`CommentMark`) і кожен запис примітки (`NoteRecord`)
 * несе `visibleFor: string[]` — ніки тих, кому позначка належить. Літерал
 * "all" усередині списку означає «всім, хто в гурті, хто б там не був»;
 * перелік ніків означає «оцим людям», і список не доганяє новачків гурту.
 *
 * Дивимось ми НАБОРОМ адресатів (`Audience`): відмітивши трьох вокалістів,
 * я бачу те, що бачить КОЖЕН з трьох — тобто позначки, чий `visibleFor` є
 * надмножиною набору. Один спільний коментар для трьох — це один запис із
 * трьома ніками, а не три записи.
 *
 * Права на керування від видимості поки не відділені: кого бачиш, того й
 * правиш (`NOTE-24`).
 */

export const AUDIENCE_ALL = "all";

/** Чиїми очима дивимось. Порожній набір = не видно нічого. */
export type Audience = string[];

/**
 * Чи бачить цю позначку КОЖЕН з набору. Саме «кожен», а не «хтось»: інакше
 * вибір трьох людей висипав би на екран три різні приватні набори.
 */
export const isVisibleToAll = (
  source: { visibleFor?: string[] },
  audience: Audience,
): boolean => {
  const list = source.visibleFor;
  if (!Array.isArray(list) || list.length === 0) return false;
  if (list.includes(AUDIENCE_ALL)) return true;
  if (audience.length === 0) return false;
  return audience.every((username) => list.includes(username));
};

/**
 * Кому позначка лишиться, якщо видалити її, дивлячись очима `audience`.
 * `null` = не лишиться нікому, тобто видаляємо повністю.
 *
 * Видалення ЗВУЖУЄ адресатів, а не зносить коментар: дивлячись очима трьох
 * вокалістів, я не можу стерти підказку четвертому, якого на екрані не бачив.
 *
 * Виняток — публічний коментар ("all"): з "all" нікого не віднімеш, бо це не
 * перелік людей, а окрема річ. Він зноситься цілком, як і до мультивибору.
 */
export const narrowAudience = (
  source: { visibleFor?: string[] },
  audience: Audience,
): string[] | null => {
  const list = source.visibleFor;
  if (!Array.isArray(list)) return null;
  if (list.includes(AUDIENCE_ALL)) return null;
  const rest = list.filter((username) => !audience.includes(username));
  return rest.length === 0 ? null : rest;
};

/**
 * Скільки людей переживе моє видалення — те саме число, що показується на
 * картці як «+N» (`NOTE-31`). Публічний коментар дає 0: його публічність уже
 * видно за сірим кольором, і «+N» там був би на кожній картці в кожній пісні.
 */
export const restCount = (
  source: { visibleFor?: string[] },
  audience: Audience,
): number => narrowAudience(source, audience)?.length ?? 0;

/**
 * True iff the comment is addressed to exactly one person — `username`.
 * Distinguishes "my own private note" from one I wrote *for* somebody else,
 * which matters when deciding whether a deletion should surface as lost.
 */
export const isPrivateTo = (
  source: { visibleFor?: string[] },
  username: string | undefined,
): boolean => {
  const list = source.visibleFor;
  if (!username || !Array.isArray(list)) return false;
  return list.length === 1 && list[0] === username;
};

export const publicVisibility = (): string[] => [AUDIENCE_ALL];
