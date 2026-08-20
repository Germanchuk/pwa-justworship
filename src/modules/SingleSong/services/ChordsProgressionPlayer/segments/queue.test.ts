import { describe, expect, it } from "vitest";

import type { ChordEvent } from "../getMidiFromSections/utils/createMidiFromProgression";
import type { PlaybackSegment } from "./model";
import { canRampBetween } from "./model";
import { createQueueState, isOnLoop, pullPasses, requestExit } from "./queue";

/** Прогресія на `bars` тактів 4/4: один акорд на такт. */
const bars = (count: number): ChordEvent[] =>
  Array.from({ length: count }, (_, i) => ({
    chord: "C",
    duration: 4,
    tokenKey: `0:0:${i}`,
  }));

const segment = (over: Partial<PlaybackSegment> = {}): PlaybackSegment => ({
  id: "s",
  progression: bars(1),
  bpm: 80,
  timeSignature: [4, 4],
  kind: "once",
  ...over,
});

describe("черга сегментів", () => {
  it("порожня черга одразу вичерпана", () => {
    const state = createQueueState([]);
    expect(state.finished).toBe(true);

    const { passes } = pullPasses(state, 0, 8);
    expect(passes).toEqual([]);
  });

  it("один `once` доливається один раз і черга закінчується", () => {
    const state = createQueueState([segment({ id: "song", progression: bars(2) })]);

    const result = pullPasses(state, 0, 8);

    expect(result.passes).toHaveLength(1);
    expect(result.passes[0].startBeats).toBe(0);
    expect(result.state.cursorBeats).toBe(8);
    expect(result.state.finished).toBe(true);
  });

  it("сегменти йдуть підряд, курсор накопичує їхні довжини", () => {
    const state = createQueueState([
      segment({ id: "a", progression: bars(1) }),
      segment({ id: "b", progression: bars(2) }),
    ]);

    const { passes, state: next } = pullPasses(state, 0, 100);

    expect(passes.map((p) => [p.segment.id, p.startBeats])).toEqual([
      ["a", 0],
      ["b", 4],
    ]);
    expect(next.cursorBeats).toBe(12);
  });

  it("старт зі зсувом (такти вступного кліку) переносить перший прохід", () => {
    const state = createQueueState([segment({ progression: bars(1) })], 4);

    const { passes } = pullPasses(state, 0, 8);

    expect(passes[0].startBeats).toBe(4);
  });

  it("горизонт обмежує, скільки доливається за раз", () => {
    const state = createQueueState([
      segment({ id: "a", progression: bars(1) }),
      segment({ id: "b", progression: bars(1) }),
      segment({ id: "c", progression: bars(1) }),
    ]);

    // Горизонт 4 імпульси = рівно один такт: доливається лише перший сегмент.
    const { passes, state: next } = pullPasses(state, 0, 4);

    expect(passes.map((p) => p.segment.id)).toEqual(["a"]);
    expect(next.finished).toBe(false);

    // Голка просунулась — доливається наступний.
    const second = pullPasses(next, 4, 4);
    expect(second.passes.map((p) => p.segment.id)).toEqual(["b"]);
  });

  it("луп доливає себе знову й знову, черга не закінчується", () => {
    const state = createQueueState([segment({ id: "loop", progression: bars(1), kind: "loop" })]);

    const { passes, state: next } = pullPasses(state, 0, 12);

    expect(passes).toHaveLength(3);
    expect(passes.map((p) => p.startBeats)).toEqual([0, 4, 8]);
    expect(next.finished).toBe(false);
    expect(isOnLoop(next)).toBe(true);
  });

  it("«далі» виводить із лупа до наступного сегмента", () => {
    const state = createQueueState([
      segment({ id: "loop", progression: bars(1), kind: "loop" }),
      segment({ id: "out", progression: bars(1) }),
    ]);

    const first = pullPasses(state, 0, 4);
    expect(first.passes.map((p) => p.segment.id)).toEqual(["loop"]);

    const asked = requestExit(first.state);
    expect(asked.exitRequested).toBe(true);

    const second = pullPasses(asked, 4, 8);
    expect(second.passes.map((p) => p.segment.id)).toEqual(["out"]);
    expect(second.state.finished).toBe(true);
  });

  it("«далі» на не-лупі нічого не робить — виходити нема звідки", () => {
    const state = createQueueState([segment({ kind: "once" })]);
    expect(requestExit(state)).toBe(state);
    expect(isOnLoop(state)).toBe(false);
  });

  it("порожній сегмент пропускається, а не підвішує планувальник", () => {
    const state = createQueueState([
      segment({ id: "empty", progression: [], kind: "loop" }),
      segment({ id: "real", progression: bars(1) }),
    ]);

    const { passes, state: next } = pullPasses(state, 0, 8);

    expect(passes.map((p) => p.segment.id)).toEqual(["real"]);
    expect(next.finished).toBe(true);
  });
});

describe("рамп темпу", () => {
  it("можна вести плавно лише при однаковому знаменнику", () => {
    expect(canRampBetween([4, 4], [3, 4])).toBe(true);
    expect(canRampBetween([4, 4], [6, 8])).toBe(false);
  });

  it("з нічого рампити нема звідки — перший сегмент завжди стрибком", () => {
    expect(canRampBetween(null, [4, 4])).toBe(false);
  });
});
