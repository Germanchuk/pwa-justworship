/**
 * Ручний скрол (`SCROLL-22`) — за ЖЕСТОМ, а не за подією `scroll`: власний
 * переїзд автоскролу (`scrollTo`, `scrollBy`) теж шле `scroll`, а жестів —
 * ні, тож він ніколи не виглядає як ручний. Ідея — з архівного автоскролу
 * (`archive/chord-player`, `useNeedleScroll`).
 *
 * Жести: палець, що зрушив далі за поріг (`touchmove`; тап — не жест, ним
 * нічого не гортають, а палець на тапі трохи тремтить), колесо й тачпад
 * (`wheel`), клавіші прокрутки, натиск на смугу прокрутки. Слухаємо на
 * `window` у фазі захоплення — так ловимо й гортання колонок усередині
 * редактора.
 *
 * Не ловимо: перетягування накладної смуги прокрутки macOS — вона лежить
 * поверх вмісту, і натиск на неї від натиску на текст не відрізнити.
 */

/** Скільки пікселів має пройти палець, щоб це був скрол, а не тап. */
const TOUCH_SLOP = 10;

const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

/**
 * Клавіша діє не на сторінку: у полі вводу пише текст, а пробіл на кнопці —
 * натискає її.
 */
const keyIsForTarget = (event: KeyboardEvent): boolean => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return true;
  return event.key === " " && target.tagName === "BUTTON";
};

/**
 * Натиск припав на смугу прокрутки: вона лежить поза `client`-областю
 * елемента. У сторінки смуга належить `<html>`, і там рахуємо від вікна.
 * Смуга буває лише в того, що прокручується: у рядкових елементів (слова,
 * акорди) `client`-розмір нульовий, і будь-який клік «потрапляв» би поза
 * нього.
 */
const onScrollbar = (event: MouseEvent): boolean => {
  const target = event.target;
  if (target === document.documentElement) {
    const root = document.documentElement;
    return event.clientX >= root.clientWidth || event.clientY >= root.clientHeight;
  }
  if (!(target instanceof HTMLElement)) return false;
  const { clientWidth, clientHeight, scrollWidth, scrollHeight } = target;
  return (
    (scrollHeight > clientHeight && event.offsetX >= clientWidth) ||
    (scrollWidth > clientWidth && event.offsetY >= clientHeight)
  );
};

/** Слухати ручний скрол. Повертає відписку. */
export const onManualScroll = (handler: () => void): (() => void) => {
  const onKey = (event: KeyboardEvent) => {
    if (SCROLL_KEYS.has(event.key) && !keyIsForTarget(event)) handler();
  };
  let touch: { x: number; y: number } | null = null;
  const onTouchStart = (event: TouchEvent) => {
    const t = event.touches[0];
    touch = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchMove = (event: TouchEvent) => {
    const t = event.touches[0];
    if (!touch || !t) return;
    if (Math.hypot(t.clientX - touch.x, t.clientY - touch.y) > TOUCH_SLOP) handler();
  };
  const onMouse = (event: MouseEvent) => {
    if (onScrollbar(event)) handler();
  };

  const options = { capture: true, passive: true } as const;
  window.addEventListener("touchstart", onTouchStart, options);
  window.addEventListener("touchmove", onTouchMove, options);
  window.addEventListener("wheel", handler, options);
  window.addEventListener("keydown", onKey, options);
  window.addEventListener("mousedown", onMouse, options);
  return () => {
    window.removeEventListener("touchstart", onTouchStart, options);
    window.removeEventListener("touchmove", onTouchMove, options);
    window.removeEventListener("wheel", handler, options);
    window.removeEventListener("keydown", onKey, options);
    window.removeEventListener("mousedown", onMouse, options);
  };
};
