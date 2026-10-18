import { useEffect, type RefObject } from "react";

/** Запас під нижній край екрана, щоб редактор не впирався в самий низ. */
const BOTTOM_GAP = 8;

/** Нижче цього значення не опускаємось, навіть якщо шапка з'їла весь екран. */
const MIN_HEIGHT = 240;

/**
 * Тримає `--song-column-height` рівним усьому місцю, що лишилось під шапкою.
 *
 * Відсоток від висоти екрана (90dvh) тут не працює: над редактором ще є sticky
 * TopBar і шапка пісні, тож будь-яке фіксоване значення або лишає порожнечу,
 * або виштовхує сторінку за межі екрана — і повертає той самий вертикальний
 * скрол, заради усунення якого й зроблені колонки. Тому висоту не вгадуємо, а
 * міряємо: скільки реально лишилось від верху редактора до низу вікна.
 */
export function useFillViewportHeight(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let raf = 0;

    const apply = () => {
      raf = 0;
      const node = ref.current;
      if (!node) return;

      // Позиція саме в документі, а не у вікні: інакше вимір «попливе», якщо
      // сторінка в цей момент прокручена.
      const docTop = node.getBoundingClientRect().top + window.scrollY;
      const next = Math.max(MIN_HEIGHT, window.innerHeight - docTop - BOTTOM_GAP);

      // Зміна нашої висоти сама смикає ResizeObserver на body. Поріг рве цей
      // цикл: docTop від нашої висоти не залежить, тож значення сходиться.
      const prev = Number.parseFloat(
        node.style.getPropertyValue("--song-column-height"),
      );
      if (Math.abs(prev - next) < 1) return;

      node.style.setProperty("--song-column-height", `${next}px`);
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    schedule();

    // body — бо шапка пісні змінює висоту незалежно від редактора (довга назва
    // в два рядки, поява/зникнення рядків меж).
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    window.addEventListener("resize", schedule);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [ref]);
}
