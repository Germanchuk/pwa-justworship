/**
 * Ручний скрол ініціатора, що рухає гурт (`SCROLL-26`), — за ЖЕСТОМ, а не
 * за подією `scroll`: власний
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
const onManualScroll = (handler: () => void): (() => void) => {
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

/**
 * Скільки скрол має стояти після відпускання, щоб гортання скінчилось.
 * Інерція (палець уже знято, а сторінка ще їде) і тачпад шлють події й
 * після «відпустив» — кінцем вважаємо, коли стихли.
 */
const SETTLE_MS = 250;

/**
 * Гортання від початку до кінця (`SCROLL-26`): `start` — перший ручний
 * скрол (`onManualScroll`), `end` — палець знято, а скрол стих. У колеса
 * й клавіш пальця немає — лише тиша. Повертає відписку; гортання, що ще
 * йде, на відписці закінчується (`end`).
 */
export const onScrollGesture = ({
  start,
  end,
}: {
  start: () => void;
  end: () => void;
}): (() => void) => {
  let active = false;
  let pressed = false;
  let timer = 0;

  const finish = () => {
    timer = 0;
    if (!active || pressed) return;
    active = false;
    end();
  };
  const settle = () => {
    if (!active) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(finish, SETTLE_MS);
  };

  const stopManual = onManualScroll(() => {
    if (!active) {
      active = true;
      start();
    }
    settle();
  });
  const onTouch = (event: TouchEvent) => {
    pressed = event.touches.length > 0;
    settle();
  };
  const onDown = () => {
    pressed = true;
  };
  const onUp = () => {
    pressed = false;
    settle();
  };
  // Кнопку миші відпустили поза вікном чи застосунок пішов у фон — `mouseup`
  // чи `touchend` може й не прийти, а гурт не мусить стояти до повернення.
  const onAway = () => {
    pressed = false;
    if (active) finish();
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") onAway();
  };

  const options = { capture: true, passive: true } as const;
  window.addEventListener("touchstart", onTouch, options);
  window.addEventListener("touchend", onTouch, options);
  window.addEventListener("touchcancel", onTouch, options);
  window.addEventListener("mousedown", onDown, options);
  window.addEventListener("mouseup", onUp, options);
  // Подія `scroll` елементів не спливає, але у фазі захоплення доходить до
  // `window` — так чуємо й гортання колонок.
  window.addEventListener("scroll", settle, options);
  window.addEventListener("blur", onAway);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    stopManual();
    window.removeEventListener("touchstart", onTouch, options);
    window.removeEventListener("touchend", onTouch, options);
    window.removeEventListener("touchcancel", onTouch, options);
    window.removeEventListener("mousedown", onDown, options);
    window.removeEventListener("mouseup", onUp, options);
    window.removeEventListener("scroll", settle, options);
    window.removeEventListener("blur", onAway);
    document.removeEventListener("visibilitychange", onVisibility);
    window.clearTimeout(timer);
    if (active) {
      active = false;
      end();
    }
  };
};
