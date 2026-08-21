import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getAutoScroll,
  interruptAutoScroll,
  resetAutoScrollCache,
  resumeAutoScroll,
  setAutoScroll,
  subscribeAutoScroll,
} from "./autoScroll";

// Тести бігають у node — підкладаємо мінімальний localStorage.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  resetAutoScrollCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("autoScroll", () => {
  it("за замовчуванням вимкнений", () => {
    expect(getAutoScroll()).toEqual({ on: false, interrupted: false });
  });

  it("вибір памʼятається на пристрої", () => {
    setAutoScroll(true);
    resetAutoScrollCache();
    expect(getAutoScroll().on).toBe(true);
  });

  it("дотик вимикає автоскрол і памʼятає, що це був дотик", () => {
    setAutoScroll(true);
    interruptAutoScroll();
    expect(getAutoScroll()).toEqual({ on: false, interrupted: true });
  });

  it("«до голки» вертає автоскрол після дотику", () => {
    setAutoScroll(true);
    interruptAutoScroll();
    resumeAutoScroll();
    expect(getAutoScroll()).toEqual({ on: true, interrupted: false });
  });

  it("вимкнув сам — «до голки» лише везе, автоскрол не вмикає", () => {
    setAutoScroll(true);
    interruptAutoScroll();
    // Явний вибір сильніший за памʼять про дотик.
    setAutoScroll(false);
    resumeAutoScroll();
    expect(getAutoScroll()).toEqual({ on: false, interrupted: false });
  });

  it("дотик при вимкненому автоскролі не будить нікого", () => {
    // touchmove сипле десятками подій на один рух пальця: зайве сповіщення
    // тут — це перемальовка екрана служіння на кожну з них.
    const listener = vi.fn();
    subscribeAutoScroll(listener);
    interruptAutoScroll();
    interruptAutoScroll();
    expect(listener).not.toHaveBeenCalled();
  });

  it("другий дотик поспіль теж мовчить", () => {
    setAutoScroll(true);
    const listener = vi.fn();
    subscribeAutoScroll(listener);
    interruptAutoScroll();
    interruptAutoScroll();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("дотик НЕ стирає вибір: наступного разу автоскрол знову веде", () => {
    // Зазирнути вперед — не те саме, що передумати. Інакше один змах пальцем
    // вимикав би автоскрол гурту назавжди.
    setAutoScroll(true);
    interruptAutoScroll();
    expect(store.get("jw.gathering-autoscroll")).toBe(JSON.stringify({ on: true }));
    resetAutoScrollCache();
    expect(getAutoScroll()).toEqual({ on: true, interrupted: false });
  });

  it("стан — той самий обʼєкт, поки він не змінився", () => {
    // На цьому стоїть `useSyncExternalStore`: новий обʼєкт на кожен виклик
    // означав би нескінченний ререндер.
    expect(getAutoScroll()).toBe(getAutoScroll());
  });

  it("зіпсоване сховище — дефолти, без падіння", () => {
    store.set("jw.gathering-autoscroll", "{не json");
    resetAutoScrollCache();
    expect(getAutoScroll()).toEqual({ on: false, interrupted: false });
  });

  it("сховища немає взагалі — теж дефолти", () => {
    vi.stubGlobal("localStorage", undefined);
    resetAutoScrollCache();
    expect(getAutoScroll().on).toBe(false);
    expect(() => setAutoScroll(true)).not.toThrow();
    expect(getAutoScroll().on).toBe(true);
  });

  it("підписник чує зміну й відписується", () => {
    const listener = vi.fn();
    const off = subscribeAutoScroll(listener);
    setAutoScroll(true);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    setAutoScroll(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
