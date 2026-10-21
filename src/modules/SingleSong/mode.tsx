import { createContext, useContext, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { bandPath } from "#constants/routes";

/**
 * Режим роботи з піснею (per-user, локальний — у спільний документ не пишеться).
 * Режим визначає і дозволені дії, і те, які персональні налаштування показу
 * застосовуються (таблиця — нижче, біля `useCapoApplies`):
 *
 *   read   — вміст незмінний: без contentEditable, тап не ставить каретку й
 *            не відкриває клавіатуру; дрон;
 *   edit   — правка вмісту пісні; чужі примітки — сірими підсвітками без
 *            карток, щоб було видно, що правка чи видалення зачепить чужий якір.
 *
 * Примітки й динаміка — в обох режимах (з 2026-10-21 окремого режиму
 * приміток немає): позначка — з виділення, фарба — поки відкрита панель
 * динаміки.
 *
 * Незалежно від режиму документ живе через websocket (Yjs/Hocuspocus).
 *
 * Джерело правди про режим — ШЛЯХ, а не стан: `songs/:songId` це читання,
 * `songs/:songId/edit` — правка. Тому режим
 * розшарюється посиланням, переживає перезавантаження й відкат назад, а сам
 * стан ніде не дублюється.
 */
export type SongMode = "read" | "edit";

/**
 * Режим у шлях пише лише `edit`: читання — базовий шлях пісні, без сегмента.
 * Одна пісня в одному режимі = один канонічний URL, тож `/read` свідомо НЕ
 * приймаємо (див. `parseSongMode`). Колишній `/notes` — теж сміття: веде в
 * читання (`MODE-27`).
 */
const MODE_SEGMENTS = ["edit"] as const;

/**
 * Сегмент шляху → режим. Порожній сегмент (базовий шлях пісні) = читання,
 * будь-яке інше сміття = `null`, і викликач вирішує, що з ним робити.
 */
export const parseSongMode = (segment: string | undefined): SongMode | null => {
  if (!segment) return "read";
  return (MODE_SEGMENTS as readonly string[]).includes(segment)
    ? (segment as SongMode)
    : null;
};

/**
 * Форсований режим для екранів, де пісні в URL ще нема (створення з нуля).
 * `null` = звичайний випадок: режим читаємо зі шляху.
 */
const ForcedSongModeContext = createContext<SongMode | null>(null);

export const SongModeProvider = ({
  mode,
  children,
}: {
  mode: SongMode;
  children: ReactNode;
}) => (
  <ForcedSongModeContext.Provider value={mode}>
    {children}
  </ForcedSongModeContext.Provider>
);

export const useSongMode = (): SongMode => {
  const forced = useContext(ForcedSongModeContext);
  const params = useParams();
  return forced ?? parseSongMode(params.mode) ?? "read";
};

/**
 * Перемикання режиму — це навігація, але `replace`: режим не має накопичувати
 * історію, «назад» з пісні повертає до списку, а не до попереднього режиму.
 */
export const useSetSongMode = () => {
  const navigate = useNavigate();
  const { bandId, listId, songId } = useParams();

  return (mode: SongMode) => {
    if (!bandId || !songId) return;
    navigate(
      listId
        ? bandPath.listSong(bandId, listId, songId, mode)
        : bandPath.song(bandId, songId, mode),
      { replace: true }
    );
  };
};

/** Правити вміст пісні (текст, акорди, мета-бейджі, атрибути секцій). */
export const useCanEditContent = () => useSongMode() === "edit";

/**
 * ─── Персональні налаштування показу × режим ────────────────────────────────
 *
 *                        read    edit
 *   капо                  ✓       ✗
 *   згорнуті секції       ✓       ✗
 *   фільтри слів/акордів  ✓       ✗
 *
 * Значення в документі при цьому НЕ чіпаються: режим лише вирішує, чи
 * застосовувати їх до показу. Вийшов з режиму — усе повернулось.
 *
 * Чому так: правити текст і структуру треба, бачачи пісню як вона є —
 * невидимий рядок або згорнута секція означають правку «в темряву». Капо ж
 * зсуває акорди лише для мене, тож у edit його знімаємо, щоб правки летіли
 * в документ у спільній тональності.
 *
 * Акорди з капо в читанні — показ поверх документного рядка (сам рядок
 * схований), тож позначку на них з капо не поставити: виділяється не текст
 * пісні. Слова — як завжди.
 *
 * ЄДИНЕ місце цієї таблиці — хуки нижче. Компоненти питають їх, а не режим.
 */

/** Чи застосовувати капо поточного користувача до показу й плейбеку. */
export const useCapoApplies = () => useSongMode() === "read";

/** Чи ховати рядки за фільтрами «слова / акорди». */
export const useFiltersApply = () => useSongMode() === "read";

/** Чи тримати згорнутими секції, згорнуті цим користувачем. */
export const useCollapseApplies = () => useSongMode() === "read";

/**
 * ─── СТАТИЧНИЙ ПОКАЗ ────────────────────────────────────────────────────────
 *
 * Пісня показана ЗНІМКОМ, а не документом: без підключення до collab, у складі
 * чогось більшого (режим зібрання). Звідси відмінність від сторінки пісні, і
 * випливає вона з одного факту — змінам тут нікуди подітись: НАЛАШТУВАННЯ НЕ
 * РЕДАГУЮТЬСЯ. Капо й фільтри показані так, як їх зберегли на репетиції, і саме
 * так вони й ДІЮТЬ — але перемикачі inert. Інакше вийшла б пастка: той самий
 * елемент, що на сторінці пісні запам'ятовує вибір, тут мовчки губив би його
 * при перезавантаженні.
 *
 * Свідомо ОКРЕМО від `SongMode`: режим — це «що я зараз роблю з піснею», а це —
 * «звідки взято те, що я бачу». Читання лишається читанням в обох випадках.
 */
const StaticSongContext = createContext(false);

export const StaticSongProvider = ({ children }: { children: ReactNode }) => (
  <StaticSongContext.Provider value={true}>{children}</StaticSongContext.Provider>
);

/** Чи це знімок (а не живий документ пісні). */
export const useIsStaticSong = () => useContext(StaticSongContext);

/**
 * Чи можна МІНЯТИ персональні налаштування показу (капо, фільтри).
 *
 * Не плутати з тим, чи вони ДІЮТЬ: у знімку вони діють повністю, просто
 * записати новий вибір нікуди.
 */
export const useSettingsEditable = () => !useIsStaticSong();

/**
 * Створювати/правити/видаляти примітки — у будь-якому режимі живої пісні; у
 * знімку (зібрання) змінам нікуди подітись.
 */
export const useCanAnnotate = () => !useIsStaticSong();

/** Програвати акорди й вибирати акорд, з якого продовжити гру. */
export const useCanPlay = () => useSongMode() === "read";
