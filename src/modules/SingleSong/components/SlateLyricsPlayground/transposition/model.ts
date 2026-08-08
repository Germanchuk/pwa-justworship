/**
 * МОДЕЛЬ СТАНУ ТРАНСПОЗИЦІЇ РЕДАКТОРА — єдина точка розуміння.
 *
 * Тут НЕ логіка, а опис: які бувають режими транспозиції, що кожен з них
 * мутує, чий це стан (спільний чи per-user) і куди він персиститься.
 * Реалізація — у `transposeChords.ts` (чисті хелпери) та `operations.ts`
 * (Slate-трансформації).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ДЕ ЖИВЕ СТАН (нагадування про модель документа, див. `../types.ts`)
 *
 *   editor.children[0]  song-name
 *   editor.children[1]  song-meta-row
 *                         ├─ bpm            (void, текст у children[0])
 *                         ├─ time-signature (void)
 *                         ├─ song-key       (void, keyValue: SongKeyValue) ← тональність пісні
 *                         └─ capo           (void, valuesBy: { [username]: semitones }) ← per-user капо
 *   editor.children[2…] section
 *                         └─ chord-line / line / … (акорди — текст chord-line)
 *
 * Документ (Yjs) = джерело правди. `song-key.keyValue` дзеркалиться в
 * `song.key` (Strapi) через collab-bridge; `capo.valuesBy` персиститься лише
 * всередині `song.slate` JSON (НЕ окрема search-колонка).
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { Editor } from "slate";

/**
 * Допустимі тональності. Дзеркалить масив `keys` з `#utils/keyUtils` та
 * enum `key` у Strapi-моделі пісні. "sharp" → "#" лише на відображенні.
 */
export type SongKeyValue =
  | "A"
  | "Asharp"
  | "B"
  | "C"
  | "Csharp"
  | "D"
  | "Dsharp"
  | "E"
  | "F"
  | "Fsharp"
  | "G"
  | "Gsharp";

/** Три незалежні режими транспозиції. */
export type TranspositionMode =
  | "relabel-key" // 1. виправити ярлик тональності БЕЗ перетонації акордів
  | "change-playing-key" // 2. змінити тональність гри + перетонувати всі акорди
  | "capo"; // 3. per-user каподастр (показ лише собі)

/**
 * РЕЖИМ 1 — виправлення тональності.
 * Вказана тональність неправильна → міняємо лише ярлик.
 *   scope:       спільний (бачать усі)
 *   мутує:       song-key.keyValue
 *   персист:     документ → дзеркалиться в song.key
 *   акорди:      НЕ чіпаються
 */
export interface RelabelKeyOp {
  mode: "relabel-key";
  newKey: SongKeyValue;
}

/**
 * РЕЖИМ 2 — зміна тональності гри (деструктивно).
 * І ключ, і всі акорди переписуються на відповідні новій тональності.
 *   scope:       спільний (бачать усі)
 *   мутує:       текст усіх chord-line + song-key.keyValue
 *   персист:     документ → дзеркалиться в song.slate + song.key
 */
export interface ChangePlayingKeyOp {
  mode: "change-playing-key";
  toKey: SongKeyValue;
}

/**
 * РЕЖИМ 3 — per-user каподастр.
 * Музикант ставить капо лише для себе (ідентифікація по нікнейму — той самий
 * патерн, що `section.collapsedFor`). Результат бачить лише він.
 *   scope:       per-user
 *   мутує:       capo.valuesBy[username]
 *   персист:     документ (capo.valuesBy) → у song.slate JSON
 *   де діє:      читання (показ + плейбек) і примітки; у РЕДАГУВАННІ капо
 *                знімається — правки летять у документ у спільній тональності
 *                (таблиця режимів — `SingleSong/mode.tsx`)
 *
 * ЗНАК КАПО (щоб не плутати напрям!):
 *   capo = +N  ⇒  акорди показуються/граються на N півтонів НИЖЧЕ.
 *   Приклад: пісня в C (До), капо +3 → музикант грає в A (Ля), бо C↓3 = A.
 *   Тобто effectiveKey = транспозиція songKey ВНИЗ на capo півтонів
 *   (= keyUtils.transpose(songKey, capo)).
 */
export interface CapoOp {
  mode: "capo";
  username: string;
  /** 0..11; 0 = зняти капо. */
  semitones: number;
}

/**
 * Power-toggle капо (per-user): тимчасово вимкнути/ввімкнути ефект капо,
 * ПАМ'ЯТАЮЧИ значення (`capo.valuesBy[username]`). Зберігається як прапорець
 * `capo.disabledFor` (нік у списку = вимкнено). Коли вимкнено —
 * `resolveTransposition` повертає myCapo=0, тож показ і плейбек поводяться так,
 * ніби капо нема (акорди спільні). Друге, незалежне джерело того ж нуля —
 * режим: див. `useTransposition`.
 */
export interface SetCapoEnabledOp {
  mode: "capo-enabled";
  username: string;
  enabled: boolean;
}

export type TranspositionOp =
  | RelabelKeyOp
  | ChangePlayingKeyOp
  | CapoOp
  | SetCapoEnabledOp;

/**
 * Обчислений стан транспозиції для конкретного користувача в даний момент.
 * Те, що треба знати рендеру/плеєру, щоб показати правильні акорди саме йому.
 */
export interface ResolvedTranspositionState {
  /** Тональність, оголошена на пісні (song-key.keyValue). Спільна. */
  songKey: SongKeyValue;
  /** Капо поточного користувача в півтонах (0 — немає). Per-user. */
  myCapo: number;
  /**
   * Тональність, у якій цей користувач фактично читає/грає.
   * effectiveKey = songKey, транспонована вниз на myCapo.
   */
  effectiveKey: SongKeyValue;
}

// ─── Контракти хелперів (реалізація у сусідніх файлах) ──────────────────────

/** `operations.ts` */
export type RelabelKey = (editor: Editor, newKey: SongKeyValue) => void;
export type ChangePlayingKey = (editor: Editor, toKey: SongKeyValue) => void;
export type SetCapo = (
  editor: Editor,
  username: string,
  semitones: number,
) => void;
export type SetCapoEnabled = (
  editor: Editor,
  username: string,
  enabled: boolean,
) => void;
export type ResolveTransposition = (
  editor: Editor,
  username: string | undefined,
) => ResolvedTranspositionState;

/**
 * ─────────────────────────────────────────────────────────────────────────
 * TODO (відкладена ітерація): "редагування у своїй тональності".
 *
 * Коли капо-юзер хоче правити акорди, він думає у СВОЇЙ тональності
 * (effectiveKey, напр. A), а в документ вони мають приходити у СПІЛЬНІЙ
 * (songKey, напр. C): на ввід — транспозиція ВГОРУ на capo, на показ — вниз.
 *
 * Поки цього немає, вибрано простіше правило: у режимі редагування капо
 * просто НЕ ДІЄ, тож капо-юзер бачить і пише спільні акорди.
 * ─────────────────────────────────────────────────────────────────────────
 */
