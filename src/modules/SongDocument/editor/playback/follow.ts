/**
 * Стеження за голкою вбік — плавне (2026-10-31: стрибало сторінками). Кожен
 * кадр контейнер кроків підпливає так, щоб голка стояла на чверті видимого, а
 * кроки текли під нею; стрибки голки (риска такту, новий рядок, старт) —
 * згладжені.
 */

/** Де стоїть голка — частка видимої ширини кроків. */
const AT = 0.25;
/** За скільки секунд контейнер наздоганяє голку (стала згасання). */
const LAG_S = 0.15;

/** Прокрутка з дробом: браузер округлює `scrollLeft`, і малі кроки губились би. */
const exact = new WeakMap<HTMLElement, number>();

/**
 * Підплисти контейнером `box` до голки `x` (px від початку його вмісту) за
 * кадр `dt` секунд; `pad` — непрокручуване поле зліва (поле доріжок смуги).
 */
export function followNeedle(box: HTMLElement, x: number, dt: number, pad = 0) {
  let left = exact.get(box);
  // Гортав хтось інший (смуга дійшла до краю, скролбар) — від того, де є.
  if (left === undefined || Math.abs(box.scrollLeft - left) > 2) left = box.scrollLeft;
  const target = Math.max(0, x - pad - (box.clientWidth - pad) * AT);
  left += (target - left) * (1 - Math.exp(-dt / LAG_S));
  exact.set(box, left);
  box.scrollLeft = left;
}

/** Секунди від попереднього кадру `requestAnimationFrame` (перший — 0). */
export function frameClock() {
  let last: number | null = null;
  return (now: number) => {
    const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    return dt;
  };
}
