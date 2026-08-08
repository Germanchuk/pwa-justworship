import { createContext, useContext, type ReactNode } from "react";
import { useMatch, useNavigate } from "react-router-dom";

import { Routes, bandPath } from "#constants/routes";

/**
 * Режим роботи з піснею (per-user, локальний — у спільний документ не пишеться).
 * Режим визначає і дозволені дії, і те, які персональні налаштування показу
 * застосовуються (таблиця — нижче, біля `useCapoApplies`):
 *
 *   read   — лише перегляд + програвання акордів (tone.js) і клік по акорду,
 *            щоб продовжити гру з цього місця. Видно тільки свої примітки:
 *            видалити тут нічого не можна, тож натякати на чужі нема потреби;
 *   edit   — правка вмісту пісні. Свої примітки видно нормальним кольором,
 *            але лише для читання; чужі — сірими хайлайтами без карток, щоб
 *            було видно, що правка чи видалення зачепить чужий якір;
 *   notes  — створення/редагування/видалення приміток. Видно РІВНО примітки
 *            вибраної в дропдауні людини (за замовчуванням свої), чужих не
 *            видно взагалі.
 *
 * Незалежно від режиму документ живе через websocket (Yjs/Hocuspocus).
 *
 * Джерело правди про режим — ШЛЯХ, а не стан: `songs/:songId` це читання,
 * `songs/:songId/edit` і `songs/:songId/notes` — решта. Тому режим
 * розшарюється посиланням, переживає перезавантаження й відкат назад, а сам
 * стан ніде не дублюється.
 */
export type SongMode = "read" | "edit" | "notes";

/**
 * Режим у шлях пише лише `edit` і `notes`: читання — базовий шлях пісні, без
 * сегмента. Одна пісня в одному режимі = один канонічний URL, тож `/read`
 * свідомо НЕ приймаємо (див. `parseSongMode`).
 */
const MODE_SEGMENTS = ["edit", "notes"] as const;

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

type SongRouteParams = Partial<Record<"bandId" | "songId" | "mode", string>>;

/**
 * Пісня в поточному шляху разом із режимом.
 *
 * Свідомо `useMatch` по всьому URL, а не `useParams()` — та сама причина, що
 * й у `useUrlBandId`: `SongControls` (а з ними й перемикач режимів) оголошені
 * в `SingleSong`, але РЕНДЕРЯТЬСЯ в `PageFooterArea` всередині `BottomBar`,
 * тобто вище пісенного `<Route>`, і route-контекст там про пісню не знає.
 */
const useSongRouteParams = (): SongRouteParams | undefined => {
  const withMode = useMatch(Routes.SingleSongMode);
  const bare = useMatch(Routes.SingleSong);
  return withMode?.params ?? bare?.params;
};

export const useSongMode = (): SongMode => {
  const forced = useContext(ForcedSongModeContext);
  const params = useSongRouteParams();
  return forced ?? parseSongMode(params?.mode) ?? "read";
};

/**
 * Перемикання режиму — це навігація, але `replace`: режим не має накопичувати
 * історію, «назад» з пісні повертає до списку, а не до попереднього режиму.
 */
export const useSetSongMode = () => {
  const navigate = useNavigate();
  const params = useSongRouteParams();

  return (mode: SongMode) => {
    const { bandId, songId } = params ?? {};
    if (!bandId || !songId) return;
    navigate(bandPath.song(bandId, songId, mode), { replace: true });
  };
};

/** Правити вміст пісні (текст, акорди, мета-бейджі, атрибути секцій). */
export const useCanEditContent = () => useSongMode() === "edit";

/**
 * ─── Персональні налаштування показу × режим ────────────────────────────────
 *
 *                        read    edit    notes
 *   капо                  ✓       ✗       ✓
 *   згорнуті секції       ✓       ✗       ✗
 *   фільтри слів/акордів  ✓       ✗       ✗
 *
 * Значення в документі при цьому НЕ чіпаються: режим лише вирішує, чи
 * застосовувати їх до показу. Вийшов з режиму — усе повернулось.
 *
 * Чому так: правити текст і структуру треба, бачачи пісню як вона є —
 * невидимий рядок або згорнута секція означають правку «в темряву». Капо ж
 * зсуває акорди лише для мене, тож у edit його теж знімаємо, щоб правки
 * летіли в документ у спільній тональності. Примітки — читання з курсором:
 * вміст незмінний, тому капо там безпечне й потрібне (позначаю те, що граю),
 * а от ховати від себе рядки, до яких чіпляєш примітки, сенсу немає.
 *
 * ЄДИНЕ місце цієї таблиці — хуки нижче. Компоненти питають їх, а не режим.
 */

/** Чи застосовувати капо поточного користувача до показу й плейбеку. */
export const useCapoApplies = () => useSongMode() !== "edit";

/** Чи ховати рядки за фільтрами «слова / акорди». */
export const useFiltersApply = () => useSongMode() === "read";

/** Чи тримати згорнутими секції, згорнуті цим користувачем. */
export const useCollapseApplies = () => useSongMode() === "read";

/** Створювати/видаляти примітки — виділення й коментарі. */
export const useCanAnnotate = () => useSongMode() === "notes";

/** Програвати акорди й вибирати акорд, з якого продовжити гру. */
export const useCanPlay = () => useSongMode() === "read";
