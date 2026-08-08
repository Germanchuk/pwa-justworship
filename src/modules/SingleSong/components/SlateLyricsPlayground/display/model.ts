/**
 * Режими показу пісні — per-user фільтри рядків.
 *
 * Точка розуміння: де живе стан і що саме він ховає.
 *
 *   editor.children
 *     [0] song-name
 *     [1] song-meta-row  ←── ТУТ стан:  chordsHiddenFor: string[]
 *          ├ bpm                        lyricsHiddenFor: string[]
 *          ├ time-signature             note:<commentId>: NoteRecord
 *          ├ song-key                   (примітки — comments/noteStore.ts)
 *          └ capo         (той самий per-user патерн: valuesBy / disabledFor)
 *     [2…] section
 *          ├ line | chord-line   ← перший з них = ЗАГОЛОВОК секції
 *          └ …
 *
 * Патерн зберігання — той самий, що `section.collapsedFor` і `capo.disabledFor`:
 * не булеан, а список ніків. Кожен бачить лише свій фільтр, у спільному
 * документі вони не конфліктують.
 *
 * ПРАВИЛО ПОКАЗУ (єдине для обох фільтрів):
 *   1. Перший «змістовний» рядок секції (line або chord-line, якорі коментарів
 *      не рахуються) — це заголовок секції. Він видимий ЗАВЖДИ, хоч би який
 *      фільтр був увімкнений. Саме тому «приховати акорди» лишає заголовок
 *      навіть тоді, коли перший рядок секції — акордовий.
 *   2. Решта рядків ховаються за типом: chordsHidden → chord-line,
 *      lyricsHidden → line.
 *   3. Картка коментаря видима, доки видно ХОЧ ОДИН символ її тексту-якоря.
 *      Окремого коду під це немає: картка малюється над ПЕРШИМ ВИДИМИМ
 *      рядком зі своєю міткою, тож схований рядок просто передає її далі, а
 *      коли видимих не лишилось — картки немає (`comments/noteHeads.ts`).
 *
 * Обидва фільтри незалежні: увімкнені разом дають «тільки структура пісні».
 *
 * ПОЗА РЕЖИМОМ ЧИТАННЯ фільтри НЕ ДІЮТЬ (`useDisplay` → `useRowHidden`):
 * друкувати в невидимий рядок чи чіпляти примітку до схованого — гарантована
 * плутанина. Значення при цьому не втрачається, як і в капо-power-toggle:
 * повернувся в читання — фільтр знову діє. Таблиця режимів — `SingleSong/mode.tsx`.
 */

/** Що саме ховаємо. */
export type DisplayFilter = "chords" | "lyrics";

/** Стан фільтрів для конкретного користувача. */
export interface DisplayState {
  chordsHidden: boolean;
  lyricsHidden: boolean;
}

/** Поле в `song-meta-row`, де лежить список ніків для кожного фільтра. */
export const DISPLAY_FIELD = {
  chords: "chordsHiddenFor",
  lyrics: "lyricsHiddenFor",
} as const satisfies Record<DisplayFilter, string>;
