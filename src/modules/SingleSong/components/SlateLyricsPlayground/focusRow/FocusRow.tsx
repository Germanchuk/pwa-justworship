import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { Node, type Editor, type Element } from "slate";
import { ReactEditor, useSlate } from "slate-react";

import {
  focusFraction,
  nearestRow,
  rowAtFraction,
} from "../../../autoscroll/focus";
import { songRows, type SongRow } from "../../../autoscroll/rows";
import { columnPitch, displayRow } from "../../../autoscroll/run";
import {
  useAutoscrollDrive,
  type Drive,
} from "../../../services/Autoscroll/useAutoscroll";
import { COLUMNS_QUERY } from "../useColumnsRelayout";
import "./FocusRow.css";

/**
 * Фокусний рядок (`SCROLL-1`…`SCROLL-3`): кружечок перед рядком, що зараз
 * «по центру». Звідси стартує автоскрол.
 *
 * Поки автоскрол іде, а цей пристрій — ініціатор, фокусний рядок веде не
 * скрол, а позиція автоскролу: кружечок перескакує з рядка на рядок, а
 * сторінка підтягує його до центру (`SCROLL-18`).
 *
 * Правила — у чистому модулі `autoscroll/` (номери рядків — `rows.ts`, вибір
 * за прокруткою — `focus.ts`). Тут лише вимір DOM і доставка результату
 * рядкам.
 *
 * Доставка — через зовнішній стор, а не через значення контексту: фокус
 * міняється на кожен кадр скролу, і контекст перемальовував би всю сотню
 * рядків. Так перемальовуються лише два — той, що втратив кружечок, і той,
 * що отримав.
 */

export type Focus = {
  /** Номер рядка пісні — однаковий для всіх (`SCROLL-16`). */
  row: number;
  /** Вузол, перед яким малюємо кружечок: перший ВИДИМИЙ вузол рядка. */
  node: Element;
  /** Іде відлік автоскролу — кружечок блимає на кожну долю (`SCROLL-7`). */
  counting?: boolean;
};

type FocusStore = {
  get: () => Focus | null;
  set: (next: Focus | null) => void;
  subscribe: (listener: () => void) => () => void;
};

const createFocusStore = (): FocusStore => {
  let current: Focus | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (next) => {
      if (
        current?.row === next?.row &&
        current?.node === next?.node &&
        current?.counting === next?.counting
      ) {
        return;
      }
      current = next;
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

const FocusCtx = createContext<FocusStore | null>(null);

/**
 * Стор відкритої пісні — для кнопки автоскролу, що живе в меню пісні, поза
 * деревом `<Slate>` (той самий патерн, що `songEditorRegistry`).
 */
let activeStore: FocusStore | null = null;

/** Номер фокусного рядка відкритої пісні — звідси стартує автоскрол. */
export const getFocusRow = (): number | null => activeStore?.get()?.row ?? null;

type Measured = { row: number; node: Element; rect: DOMRect };

/**
 * Видимі рядки з їхніми прямокутниками. Рядок, усі вузли якого сховані
 * (фільтр, згорнута секція), у вибір не потрапляє: у згорнутій секції
 * лишається лише заголовок, тож фокус стоїть на ньому.
 */
const measureRows = (editor: Editor, rows: SongRow[]): Measured[] => {
  const out: Measured[] = [];
  rows.forEach((paths, row) => {
    for (const path of paths) {
      try {
        const node = Node.get(editor, path) as Element;
        const rect = ReactEditor.toDOMNode(editor, node).getBoundingClientRect();
        if (rect.height === 0) continue; // `display: none`
        out.push({ row, node, rect });
        return;
      } catch {
        // Вузол саме зараз перебудовується — пропускаємо цей кадр.
      }
    }
  });
  return out;
};

const pickFocus = (
  measured: Measured[],
  editable: HTMLElement,
): Focus | null => {
  let row: number | null;

  if (window.matchMedia(COLUMNS_QUERY).matches) {
    // Колонки гортаються вбік усередині редактора; низ колонки може ще й
    // ховатись під краєм вікна, якщо сторінку трохи прокрутили.
    const box = editable.getBoundingClientRect();
    const visible = measured
      .filter(({ rect }) => {
        const x = (rect.left + rect.right) / 2;
        const y = (rect.top + rect.bottom) / 2;
        return (
          x >= box.left && x <= box.right && y >= 0 && y <= window.innerHeight
        );
      })
      .map((m) => m.row);
    row = rowAtFraction(
      visible,
      focusFraction({
        offset: editable.scrollLeft,
        max: editable.scrollWidth - editable.clientWidth,
        viewport: editable.clientWidth,
      }),
    );
  } else {
    // Один стовпець гортає вся сторінка.
    const viewport = window.innerHeight;
    const fraction = focusFraction({
      offset: window.scrollY,
      max: document.documentElement.scrollHeight - viewport,
      viewport,
    });
    row = nearestRow(
      measured.map(({ row, rect }) => ({ row, start: rect.top, end: rect.bottom })),
      fraction * viewport,
    );
  }

  const hit = measured.find((m) => m.row === row);
  return hit ? { row: hit.row, node: hit.node } : null;
};

/**
 * Тримає кружечок у полі зору, поки його веде автоскрол (`SCROLL-18`).
 * Один стовпець — сторінка плавно підтягує рядок до центру екрана. Колонки —
 * сторінка стоїть, доки кружечок не перейде середину видимої області, тоді
 * гортається на одну колонку.
 */
const keepInView = (rect: DOMRect, editable: HTMLElement) => {
  if (!window.matchMedia(COLUMNS_QUERY).matches) {
    window.scrollTo({
      top: window.scrollY + (rect.top + rect.bottom) / 2 - window.innerHeight / 2,
      behavior: "smooth",
    });
    return;
  }

  const box = editable.getBoundingClientRect();
  const style = getComputedStyle(editable);
  const pitch = columnPitch(
    editable.clientWidth,
    parseFloat(style.columnWidth) || box.width,
    parseFloat(style.columnGap) || 0,
  );
  const delta = rect.left - box.left;
  // Рядок зовсім поза видимою областю (змінили розмір вікна, рядок далеко) —
  // гортаємо одразу до його колонки.
  const steps =
    rect.right < box.left || rect.left > box.right
      ? Math.floor(delta / pitch)
      : rect.left > box.left + box.width / 2
        ? 1
        : 0;
  if (steps !== 0) {
    editable.scrollBy({ left: steps * pitch, behavior: "smooth" });
  }
};

/** Автоскрол веде фокус: позиція, показана на МОЄМУ видимому рядку. */
const placeDriven = (
  measured: Measured[],
  drive: Pick<Drive, "row" | "counting">,
): (Focus & { rect: DOMRect }) | null => {
  const shown = displayRow(
    measured.map((m) => m.row),
    drive.row,
  );
  const hit = measured.find((m) => m.row === shown);
  return hit
    ? { row: drive.row, node: hit.node, counting: drive.counting, rect: hit.rect }
    : null;
};

export const FocusRowProvider = ({
  songId,
  enabled,
  editableRef,
  children,
}: {
  songId: string | number;
  /** Фокусний рядок є лише в режимі читання (`SCROLL-1`). */
  enabled: boolean;
  editableRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) => {
  const editor = useSlate();
  const store = useMemo(createFocusStore, []);

  // `editor.children` — тригер: Slate на кожну операцію будує новий масив
  // (див. `NoteHeadsProvider`). Сюди ж приходять згортання й фільтри — вони
  // живуть у документі.
  const rows = useMemo(
    () => songRows(editor.children),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, editor.children],
  );

  const drive = useAutoscrollDrive(songId, rows.length);
  const drivenRow = drive?.row ?? null;
  const counting = drive?.counting ?? false;
  const beat = drive?.beatMs ?? null;

  useEffect(() => {
    activeStore = store;
    return () => {
      if (activeStore === store) activeStore = null;
    };
  }, [store]);

  useEffect(() => {
    const editable = editableRef.current;
    if (!enabled || !editable) {
      store.set(null);
      return;
    }

    // Темп блимання на відліку — CSS-анімація кружечка (`FocusRow.css`).
    if (beat != null) {
      editable.style.setProperty("--autoscroll-beat", `${beat}ms`);
    }

    let raf = 0;
    const measure = () => {
      raf = 0;
      const measured = measureRows(editor, rows);
      if (drivenRow == null) {
        store.set(pickFocus(measured, editable));
        return;
      }
      const placed = placeDriven(measured, { row: drivenRow, counting });
      if (!placed) {
        store.set(null);
        return;
      }
      const { rect, ...focus } = placed;
      // Сторінку рухаємо, лише коли кружечок перейшов на інший вузол, — а
      // не на кожну зміну розкладки й не на старті: рядок старту вже там, де
      // його лишила людина.
      const moved = store.get()?.node !== focus.node;
      store.set(focus);
      if (moved) keepInView(rect, editable);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };

    schedule();
    // Поки фокус веде автоскрол, скрол його не рухає.
    const onScroll = drivenRow == null ? schedule : null;
    if (onScroll) {
      window.addEventListener("scroll", onScroll, { passive: true });
      editable.addEventListener("scroll", onScroll, { passive: true });
    }
    window.addEventListener("resize", schedule);
    // Розкладка міняється й без скролу: шрифти доїхали, змінилась висота
    // колонок, згорнули секцію.
    const observer = new ResizeObserver(schedule);
    observer.observe(editable);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (onScroll) {
        window.removeEventListener("scroll", onScroll);
        editable.removeEventListener("scroll", onScroll);
      }
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [enabled, editor, rows, store, editableRef, drivenRow, counting, beat]);

  return <FocusCtx.Provider value={store}>{children}</FocusCtx.Provider>;
};

const noSubscribe = () => () => {};

/**
 * Клас кружечка для цього вузла: `song-row--focus`, на відліку ще й
 * `song-row--counting`, або нічого. Поза провайдером (статичний показ у
 * зібранні) — нічого.
 */
export const useFocusClass = (element: Element): string => {
  const store = useContext(FocusCtx);
  return useSyncExternalStore(store?.subscribe ?? noSubscribe, () => {
    const focus = store?.get();
    if (focus?.node !== element) return "";
    return focus.counting ? "song-row--focus song-row--counting" : "song-row--focus";
  });
};
