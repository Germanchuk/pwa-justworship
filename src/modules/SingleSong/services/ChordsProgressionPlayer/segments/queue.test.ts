import { describe, expect, it } from "vitest";

import type { PlaybackSegment } from "./model";
import { canRampBetween } from "./model";
import { awaitingPoint, createQueueState, isOnLoop, isOnPause, pullPasses, requestExit } from "./queue";
import { bars, makeSegment as segment } from "./segmentFixtures";

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

describe("пауза на примітці", () => {
  const pause = (id = "pause"): PlaybackSegment =>
    segment({ id, progression: [], kind: "pause" });

  it("пауза зупиняє доливання — далі не наливається нічого", () => {
    const state = createQueueState([
      segment({ id: "song", progression: bars(1) }),
      pause(),
      segment({ id: "next", progression: bars(1) }),
    ]);

    const { passes, state: next } = pullPasses(state, 0, 100);

    expect(passes.map((p) => p.segment.id)).toEqual(["song"]);
    expect(next.finished).toBe(false);
    expect(isOnPause(next)).toBe(true);
    // Пауза не має довжини, тож курсор стоїть рівно на її межі.
    expect(next.cursorBeats).toBe(4);
  });

  it("пауза не проковтується перевіркою нульової довжини", () => {
    // Той самий нульовий сегмент, але `once`, — проковтується (сусідній тест
    // вище). Різниця саме у виді, і саме її перевіряємо.
    const state = createQueueState([pause(), segment({ id: "next", progression: bars(1) })]);

    const { passes, state: next } = pullPasses(state, 0, 100);

    expect(passes).toEqual([]);
    expect(isOnPause(next)).toBe(true);
    expect(next.index).toBe(0);
  });

  it("«продовжити» знімає паузу — черга йде з наступного сегмента", () => {
    const state = createQueueState([
      segment({ id: "song", progression: bars(1) }),
      pause(),
      segment({ id: "next", progression: bars(1) }),
    ]);

    const stopped = pullPasses(state, 0, 100).state;
    const asked = requestExit(stopped);
    expect(asked.exitRequested).toBe(true);

    const { passes, state: next } = pullPasses(asked, 4, 8);

    expect(passes.map((p) => [p.segment.id, p.startBeats])).toEqual([["next", 4]]);
    expect(isOnPause(next)).toBe(false);
    expect(next.finished).toBe(true);
    // Прохання з'їдено разом із паузою: наступний луп не має вийти сам.
    expect(next.exitRequested).toBe(false);
  });

  it("дві примітки підряд дають дві послідовні зупинки", () => {
    const state = createQueueState([
      segment({ id: "song", progression: bars(1) }),
      pause("first"),
      pause("second"),
      segment({ id: "next", progression: bars(1) }),
    ]);

    const first = pullPasses(state, 0, 100).state;
    expect(isOnPause(first)).toBe(true);

    const afterFirst = pullPasses(requestExit(first), 4, 100);
    // Стали вдруге, а не пішли далі: друга примітка — теж зупинка.
    expect(afterFirst.passes).toEqual([]);
    expect(isOnPause(afterFirst.state)).toBe(true);

    const afterSecond = pullPasses(requestExit(afterFirst.state), 4, 100);
    expect(afterSecond.passes.map((p) => p.segment.id)).toEqual(["next"]);
    expect(isOnPause(afterSecond.state)).toBe(false);
  });

  it("луп після паузи поводиться як раніше", () => {
    const state = createQueueState([
      pause(),
      segment({ id: "loop", progression: bars(1), kind: "loop" }),
      segment({ id: "out", progression: bars(1) }),
    ]);

    const stopped = pullPasses(state, 0, 100).state;
    const started = pullPasses(requestExit(stopped), 0, 12);

    // Луп доливає себе знову й знову — прохання за паузою на нього не перейшло.
    expect(started.passes.map((p) => p.segment.id)).toEqual(["loop", "loop", "loop"]);
    expect(isOnLoop(started.state)).toBe(true);

    const exited = pullPasses(requestExit(started.state), 12, 8);
    expect(exited.passes.map((p) => p.segment.id)).toEqual(["out"]);
  });

  it("пауза останнім пунктом: зупинка, а після «продовжити» — кінець", () => {
    const state = createQueueState([segment({ id: "song", progression: bars(1) }), pause()]);

    const stopped = pullPasses(state, 0, 100).state;
    expect(isOnPause(stopped)).toBe(true);
    expect(stopped.finished).toBe(false);

    const { passes, state: next } = pullPasses(requestExit(stopped), 4, 8);
    expect(passes).toEqual([]);
    expect(next.finished).toBe(true);
  });

  it("«далі» на паузі — те саме прохання, що й на лупі", () => {
    const state = createQueueState([pause()]);
    expect(requestExit(state).exitRequested).toBe(true);
  });
});

describe("на чому черга чекає «продовжити»", () => {
  const pause = (id: string): PlaybackSegment => segment({ id, progression: [], kind: "pause" });

  it("пункт паузи, пункт лупа — і нічого на пісні", () => {
    expect(awaitingPoint(createQueueState([pause("p2:pause")]))).toBe("p2");
    expect(
      awaitingPoint(createQueueState([segment({ id: "p3:loop", kind: "loop" })])),
    ).toBe("p3");
    expect(awaitingPoint(createQueueState([segment({ id: "p0" })]))).toBe(null);
    expect(awaitingPoint(createQueueState([]))).toBe(null);
  });

  it("попросили — більше не чекаємо: прохання вже прийнято", () => {
    const state = createQueueState([
      segment({ id: "p1:loop", progression: bars(1), kind: "loop" }),
      segment({ id: "p2", progression: bars(1) }),
    ]);
    expect(awaitingPoint(state)).toBe("p1");
    // Луп ще доспівує свій прохід, але кнопці більше нема чого робити: інакше
    // вона висіла б до самого виходу й ловила б повторні натиски.
    expect(awaitingPoint(requestExit(state))).toBe(null);
  });

  it("прохання з ЧУЖОГО пункту черга не бере", () => {
    const state = createQueueState([pause("p1:pause"), pause("p2:pause")]);

    // Двоє натиснули на одній примітці; поки їхали команди, служіння стало на
    // наступній. Друга команда каже «продовжити з p1» — а ми вже на `p2`.
    expect(requestExit(state, "p2")).toBe(state);
    expect(requestExit(state, "p1").exitRequested).toBe(true);

    const afterFirst = pullPasses(requestExit(state, "p1"), 0, 100).state;
    expect(awaitingPoint(afterFirst)).toBe("p2");
    // Той самий натиск, що приїхав удруге, другу зупинку не проковтує.
    expect(requestExit(afterFirst, "p1")).toBe(afterFirst);
  });

  it("без пункту прохання діє на те, де стоїмо — так тисне свій же пристрій", () => {
    const state = createQueueState([pause("p1:pause")]);
    expect(requestExit(state).exitRequested).toBe(true);
  });
});
