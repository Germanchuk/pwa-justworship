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
import { COLUMNS_QUERY } from "../useColumnsRelayout";
import "./FocusRow.css";

/**
 * Фокусний рядок (`SCROLL-1`…`SCROLL-3`): кружечок перед рядком, що зараз
 * «по центру». Звідси стартуватиме автоскрол.
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
      if (current?.row === next?.row && current?.node === next?.node) return;
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

export const FocusRowProvider = ({
  enabled,
  editableRef,
  children,
}: {
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

  useEffect(() => {
    const editable = editableRef.current;
    if (!enabled || !editable) {
      store.set(null);
      return;
    }

    let raf = 0;
    const measure = () => {
      raf = 0;
      store.set(pickFocus(measureRows(editor, rows), editable));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    editable.addEventListener("scroll", schedule, { passive: true });
    // Розкладка міняється й без скролу: шрифти доїхали, змінилась висота
    // колонок, згорнули секцію.
    const observer = new ResizeObserver(schedule);
    observer.observe(editable);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      editable.removeEventListener("scroll", schedule);
      observer.disconnect();
    };
  }, [enabled, editor, rows, store, editableRef]);

  return <FocusCtx.Provider value={store}>{children}</FocusCtx.Provider>;
};

const noSubscribe = () => () => {};

/**
 * Чи малювати кружечок перед цим вузлом. Поза провайдером (статичний показ
 * у зібранні) — ніколи.
 */
export const useIsFocusNode = (element: Element): boolean => {
  const store = useContext(FocusCtx);
  return useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => store?.get()?.node === element,
  );
};
