/**
 * Фокусний рядок без автоскролу (`SCROLL-2`): який рядок зараз «по центру».
 *
 * Чисті функції над уже виміряними числами — DOM міряє викликач
 * (`FocusRowProvider`).
 *
 * ЦЕНТР НЕДОСЯЖНИЙ НА КРАЯХ. Перший рядок пісні не прокрутити до центру
 * екрана — вище нуля сторінка не їде; так само останній. Тому фокус не
 * прибитий до центру, а їде разом зі скролом: на самому початку він нагорі,
 * за пів екрана прокрутки — вже в центрі, і так само симетрично внизу. Так
 * кожен рядок пісні можна зробити фокусним, а посеред пісні він стоїть рівно
 * по центру.
 */

/** Прокрутка вздовж осі, якою гортають пісню. */
export type ScrollAxis = {
  /** Скільки вже прокручено. */
  offset: number;
  /** Скільки можна прокрутити всього. */
  max: number;
  /** Розмір видимої області вздовж цієї ж осі. */
  viewport: number;
};

/**
 * Де на видимій області стоїть фокус: 0 — на початку, 0.5 — по центру,
 * 1 — в кінці.
 */
export const focusFraction = ({ offset, max, viewport }: ScrollAxis): number => {
  // Прокручувати нікуди — вся пісня перед очима, фокус на першому рядку.
  if (max <= 0) return 0;

  // Гумовий відскок iOS виносить offset за межі [0, max].
  const at = Math.min(max, Math.max(0, offset));
  // Пів екрана на розгін до центру — але не більше половини всієї прокрутки,
  // інакше зони початку й кінця налізли б одна на одну.
  const zone = Math.min(viewport / 2, max / 2);

  if (at < zone) return (0.5 * at) / zone;
  if (at > max - zone) return 0.5 + (0.5 * (at - (max - zone))) / zone;
  return 0.5;
};

/** Рядок на екрані: його номер і межі вздовж осі прокрутки. */
export type RowBox = { row: number; start: number; end: number };

/**
 * Один стовпець: рядок, чий центр найближчий до проби. Сховані рядки (фільтр,
 * згорнута секція) викликач просто не передає.
 */
export const nearestRow = (rows: RowBox[], probe: number): number | null => {
  let best: RowBox | null = null;
  let bestDistance = Infinity;
  for (const box of rows) {
    const distance = Math.abs((box.start + box.end) / 2 - probe);
    if (distance < bestDistance) {
      best = box;
      bestDistance = distance;
    }
  }
  return best?.row ?? null;
};

/**
 * Газетні колонки (широкий екран, скрол убік): «центр екрана» там не
 * означає місця в пісні, тож рахуємо видимі рядки в порядку читання й беремо
 * той, що на `fraction` цього списку — посередині, коли гортаємо посеред
 * пісні.
 */
export const rowAtFraction = (
  visible: number[],
  fraction: number,
): number | null => {
  if (visible.length === 0) return null;
  return visible[Math.round(fraction * (visible.length - 1))];
};
