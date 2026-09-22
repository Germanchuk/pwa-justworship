/**
 * АВТОСКРОЛ — вмикати чи ні, і чи не збив його дотик.
 *
 * Властивість ПРИСТРОЮ, не служіння: у гурті хтось хоче, щоб екран їхав сам, а
 * хтось гортає рукою і від їзди тільки збивається (`LIST-45`). Тому вибір живе
 * в localStorage, а не в документі, і за замовчуванням автоскрол **вимкнений**:
 * непроханий рух екрана посеред служіння дратує сильніше, ніж відсутній.
 *
 * Модуль свідомо без React: підписка йде через `useSyncExternalStore`, і на
 * стан дивляться двоє — кнопки внизу екрана й сам скрол (`useNeedleScroll`).
 *
 * ─── ЧОМУ СТАНІВ ДВА, А НЕ ОДИН ────────────────────────────────────────────
 * Дотик вимикає автоскрол НА МІСЦІ: екран лишається там, куди його привели
 * пальцем, і сам назад не їде. Видно при цьому одне — автоскрол вимкнений, і
 * перемикач не бреше.
 *
 * Але «вимкнув сам» і «збив дотиком» — різні речі, і різняться вони рівно на
 * кнопці «до голки». Збив дотиком, зазирнув уперед, натиснув «до голки» —
 * автоскрол вертається, бо його ніхто не скасовував. А гурт, що вимкнув
 * автоскрол назавжди, тією ж кнопкою просто вертається до гурту, і екран після
 * цього стоїть. Тому `interrupted` — памʼять про причину, і живе вона лише до
 * перезавантаження: переживати сесію їй нема сенсу.
 */

export interface AutoScrollState {
  /** Чи веде екран за голкою. Памʼятається на пристрої. */
  on: boolean;
  /** Вимкнув не я, а мій дотик — тоді «до голки» автоскрол вертає. */
  interrupted: boolean;
}

const STORAGE_KEY = "jw.gathering-autoscroll";

const DEFAULTS: AutoScrollState = { on: false, interrupted: false };

let cached: AutoScrollState | null = null;
const listeners = new Set<() => void>();

// try/catch навколо всього: приватний режим Safari, вимкнене сховище чи
// зіпсований JSON — усе тихо падає на дефолти.
const load = (): AutoScrollState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AutoScrollState>;
    return { on: parsed.on === true, interrupted: false };
  } catch {
    return DEFAULTS;
  }
};

/**
 * ⚠️ Обʼєкт той самий, поки стан не змінився: на цьому стоїть
 * `useSyncExternalStore`.
 */
export function getAutoScroll(): AutoScrollState {
  if (!cached) cached = load();
  return cached;
}

/**
 * Змінити стан і розбудити підписників. Сховища НЕ чіпає — і це головне:
 * записати сюди означало б, що один змах пальцем стер вибір гурту назавжди.
 */
const apply = (next: AutoScrollState): void => {
  const current = getAutoScroll();
  if (current.on === next.on && current.interrupted === next.interrupted) return;
  cached = next;
  listeners.forEach((listener) => listener());
};

/** Явний вибір людини — єдине, що доживає до наступного відкриття. */
export function setAutoScroll(on: boolean): void {
  apply({ on, interrupted: false });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ on }));
  } catch {
    // не збереглось — переживемо, вибір живе до перезавантаження
  }
}

/**
 * Дотик до екрана: автоскрол став на місці.
 *
 * ⚠️ Мовчить, коли міняти нема чого. Це не оптимізація «про всяк випадок»:
 * жест скролу сипле десятками подій, і кожне зайве сповіщення — це
 * перемальовка екрана з усіма піснями служіння.
 *
 * ⚠️ У СХОВИЩЕ НЕ ПИШЕ. Змах пальцем, щоб зазирнути вперед, — не скасування
 * вибору: наступного разу служіння знову відкриється з автоскролом.
 */
export function interruptAutoScroll(): void {
  if (!getAutoScroll().on) return;
  apply({ on: false, interrupted: true });
}

/** «До голки»: везе завжди, а вмикає — лише те, що вимкнув дотик. */
export function resumeAutoScroll(): void {
  if (!getAutoScroll().interrupted) return;
  apply({ on: true, interrupted: false });
}

export function subscribeAutoScroll(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Для тестів: скинути кеш, щоб наступний get перечитав сховище. */
export function resetAutoScrollCache(): void {
  cached = null;
}
