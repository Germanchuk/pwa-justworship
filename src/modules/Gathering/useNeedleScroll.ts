import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

import { pointOfKey } from "#modules/SingleSong/services/ChordsProgressionPlayer/segments/model";
import {
  getAutoScroll,
  interruptAutoScroll,
  resumeAutoScroll,
  subscribeAutoScroll,
} from "./autoScroll";
import { needleScrollTop } from "./needleScroll";

/**
 * ЕКРАН, ЩО ЇДЕ ЗА ГОЛКОЮ — єдине місце, де автоскрол зустрічається з DOM.
 *
 * ─── ГОЛКА — ОКРЕМЕ ДЖЕРЕЛО, І ЦЕ НАВМИСНЕ ─────────────────────────────────
 * Сюди приходить готовий ключ токена — той самий, що підсвічує акорд
 * (`needleFor`). Скрол його лише СПОЖИВАЄ: він не питає плеєр, не знає про
 * сегменти, не бачить транспорту й не вміє його спинити. Причина далека —
 * колись голку має вміти давати аналіз звуку з мікрофона; тоді це буде друге
 * джерело того самого ключа, а не переписування скролу.
 *
 * ─── ЧОМУ ПОЗИЦІЮ ПИТАЄМО В DOM, А НЕ РАХУЄМО ──────────────────────────────
 * Голка спільна, а куди її везти — особисте (`LIST-44`): капо міняє ширину
 * акордів, фільтри ховають цілі рядки, згорнута секція ховає все, крім
 * заголовка, а екран у кожного свого розміру. Усе це вже пораховане браузером,
 * тож питаємо рамку елемента — і жодне з цих правил не доводиться повторювати
 * тут ще раз.
 *
 * ⚠️ Голки може не бути ВИДНО: я сховав акорди фільтром, а звучить програш —
 * він суцільно акордовий, і вузол на екрані є, але з нульовою рамкою. Тоді
 * везем до самого ПУНКТУ (`data-gathering-point`): точного місця не покажемо,
 * але «ми ось тут у служінні» лишається правдою.
 *
 * ─── ДОТИК СИЛЬНІШИЙ ЗА АВТОСКРОЛ ──────────────────────────────────────────
 * Слухаємо `touchmove` і `wheel` — тобто ЖЕСТ ГОРТАННЯ, а не будь-який дотик:
 * тап по акорду в зібранні означає «грай звідси» (`LIST-43`), і вимикати ним
 * автоскрол було б покаранням за запуск. Обидві події від програмного скролу
 * не приходять узагалі, тож власний переїзд ніколи не виглядає як чужий —
 * саме тому вони, а не `scroll`.
 */

/** Підсвічений акорд у розмітці — та сама позначка, що й у `renderLeaf`. */
const NEEDLE = ".chord-playing-now";

/** Липкий верхній бар: він накриває початок вікна, коли є (`TopBar`). */
const HEADER = ".top";

interface Options {
  /** Ряд пунктів служіння: у ньому й шукаємо. */
  rootRef: React.RefObject<HTMLElement | null>;
  /** Голка з префіксом пункту, як вона їде по мережі. `null` — тиша. */
  needleKey: string | null;
}

/** Схований рядок чи згорнута секція не мають рамки — і не мають місця. */
const laidOut = (element: Element): boolean => element.getClientRects().length > 0;

/**
 * Спершу пункт, і аж потім акорд у ньому.
 *
 * Пункт відомий з самого ключа (`pointOfKey`), тож брати перший підсвічений
 * акорд по всьому служінню — значить довіряти позиції в DOM там, де є адреса:
 * підсвітка, що на кадр затрималась у попередній пісні, повезла б екран у
 * чужий пункт. Тотожність у зібранні тримається на префіксі пункту (ADR-0001),
 * і тут вона тримається так само.
 *
 * Акорда може не бути ВИДНО — сховані фільтром рядки, згорнута секція, — і
 * тоді лишається сам пункт: «ми ось тут у служінні».
 */
const needleElement = (root: HTMLElement, needleKey: string): Element | null => {
  const point = root.querySelector(
    `[data-gathering-point="${CSS.escape(pointOfKey(needleKey))}"]`,
  );
  if (!point) return null;
  const chord = point.querySelector(NEEDLE);
  if (chord && laidOut(chord)) return chord;
  return laidOut(point) ? point : null;
};

/**
 * Повертає «до голки» — ту саму дорогу, якою їде автоскрол, лише на вимогу.
 */
export function useNeedleScroll({ rootRef, needleKey }: Options): () => void {
  const auto = useSyncExternalStore(subscribeAutoScroll, getAutoScroll);

  // Голка змінюється кілька разів на такт, а кнопка «до голки» має лишатись
  // тим самим обʼєктом: інакше вона перемальовується на кожен акорд.
  const needleRef = useRef(needleKey);
  needleRef.current = needleKey;

  const scrollToNeedle = useCallback(
    (force: boolean) => {
      const root = rootRef.current;
      const key = needleRef.current;
      if (!root || key == null) return;

      const element = needleElement(root, key);
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const header = document.querySelector(HEADER);
      const top = needleScrollTop(
        {
          top: rect.top,
          bottom: rect.bottom,
          viewport: window.innerHeight,
          headroom: Math.max(0, header?.getBoundingClientRect().bottom ?? 0),
          scrollTop: window.scrollY,
          maxScrollTop: Math.max(
            0,
            document.documentElement.scrollHeight - window.innerHeight,
          ),
        },
        { force },
      );
      if (top == null) return;

      window.scrollTo({ top, behavior: "smooth" });
    },
    [rootRef],
  );

  // Голка рушила — везем за нею. Ефект, а не подія: до цієї миті React уже
  // домалював підсвітку, тож рамку є в кого спитати.
  useEffect(() => {
    if (!auto.on || needleKey == null) return;
    scrollToNeedle(false);
  }, [auto.on, needleKey, scrollToNeedle]);

  useEffect(() => {
    if (!auto.on) return;
    const interrupt = () => interruptAutoScroll();
    window.addEventListener("touchmove", interrupt, { passive: true });
    window.addEventListener("wheel", interrupt, { passive: true });
    return () => {
      window.removeEventListener("touchmove", interrupt);
      window.removeEventListener("wheel", interrupt);
    };
  }, [auto.on]);

  return useCallback(() => {
    // Спершу вернути автоскрол, потім їхати: увімкнений він одразу підхопить
    // наступний акорд, і після кнопки екран не стане знову.
    resumeAutoScroll();
    scrollToNeedle(true);
  }, [scrollToNeedle]);
}
