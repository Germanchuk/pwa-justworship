import { describe, expect, it } from "vitest";

import {
  follow,
  followView,
  NOT_FOLLOWING,
  type FollowEvent,
  type FollowState,
} from "./follow";
import type { AutoscrollRun } from "./run";

const run = (patch: Partial<AutoscrollRun> = {}): AutoscrollRun => ({
  row: 0,
  startedAt: 1000,
  bpm: 60,
  beatsPerBar: 4,
  initiator: { device: "a", name: "Аня" },
  movedAt: null,
  held: false,
  speed: 1,
  ...patch,
});

const FOLLOWING: FollowState = { running: true, following: true };
const NOT_ATTACHED: FollowState = { running: true, following: false };

describe("follow — переходи слідування (`SCROLL-19`…`SCROLL-24`)", () => {
  // Пісню я відкрив у момент 5000.
  const opened = 5000;

  it.each<{ name: string; from: FollowState; event: FollowEvent; to: FollowState }>([
    {
      name: "відкрив пісню, автоскрол уже йде — слідую одразу",
      from: NOT_FOLLOWING,
      event: { type: "run", run: run({ startedAt: 1000 }), openedAt: opened, reading: true },
      to: FOLLOWING,
    },
    {
      name: "відкрив пісню не в читанні — не слідую, кнопка є",
      from: NOT_FOLLOWING,
      event: { type: "run", run: run({ startedAt: 1000 }), openedAt: opened, reading: false },
      to: NOT_ATTACHED,
    },
    {
      name: "стартували, поки я був на пісні — не затягує",
      from: NOT_FOLLOWING,
      event: { type: "run", run: run({ startedAt: 7000 }), openedAt: opened, reading: true },
      to: NOT_ATTACHED,
    },
    {
      name: "старт у ту саму мить, що й відкриття, — уже був на пісні",
      from: NOT_FOLLOWING,
      event: { type: "run", run: run({ startedAt: opened }), openedAt: opened, reading: true },
      to: NOT_ATTACHED,
    },
    {
      name: "запис оновився посеред автоскролу — слідую й далі",
      from: FOLLOWING,
      event: { type: "run", run: run({ row: 9, startedAt: 9000 }), openedAt: opened, reading: true },
      to: FOLLOWING,
    },
    {
      name: "запис оновився, а я не слідую — і далі не слідую",
      from: NOT_ATTACHED,
      event: { type: "run", run: run({ startedAt: 1000 }), openedAt: opened, reading: true },
      to: NOT_ATTACHED,
    },
    {
      name: "стоп — ні слідування, ні кнопки",
      from: FOLLOWING,
      event: { type: "run", run: null, openedAt: opened, reading: true },
      to: NOT_FOLLOWING,
    },
    {
      name: "ручний скрол виводить зі слідування",
      from: FOLLOWING,
      event: { type: "gesture" },
      to: NOT_ATTACHED,
    },
    {
      name: "вихід із читання виводить зі слідування",
      from: FOLLOWING,
      event: { type: "leave-read" },
      to: NOT_ATTACHED,
    },
    {
      name: "кнопка повернення — знову слідую",
      from: NOT_ATTACHED,
      event: { type: "return" },
      to: FOLLOWING,
    },
    {
      name: "повертатись нікуди, коли автоскрол не йде",
      from: NOT_FOLLOWING,
      event: { type: "return" },
      to: NOT_FOLLOWING,
    },
  ])("$name", ({ from, event, to }) => {
    expect(follow(from, event)).toEqual(to);
  });

  it.each<{ name: string; from: FollowState; event: FollowEvent }>([
    // `touchmove` сипле десятками подій — новий обʼєкт означав би перемальовку на кожну.
    { name: "ручний скрол, коли я вже не слідую", from: NOT_ATTACHED, event: { type: "gesture" } },
    { name: "ручний скрол без автоскролу", from: NOT_FOLLOWING, event: { type: "gesture" } },
    { name: "вихід із читання без автоскролу", from: NOT_FOLLOWING, event: { type: "leave-read" } },
    { name: "повернення, коли вже слідую", from: FOLLOWING, event: { type: "return" } },
    {
      name: "той самий автоскрол, коли я слідую",
      from: FOLLOWING,
      event: { type: "run", run: run(), openedAt: 5000, reading: true },
    },
    {
      name: "автоскролу немає й не було",
      from: NOT_FOLLOWING,
      event: { type: "run", run: null, openedAt: 5000, reading: true },
    },
  ])("нічого не змінилось — той самий обʼєкт: $name", ({ from, event }) => {
    expect(follow(from, event)).toBe(from);
  });
});

describe("followView — що показати цьому пристрою", () => {
  it.each([
    {
      name: "автоскролу немає — нічого",
      run: null,
      following: false,
      reading: true,
      view: { attached: false, edge: null, returnButton: false },
    },
    {
      name: "слідую в читанні — екран їде, тонка тінь",
      run: run(),
      following: true,
      reading: true,
      view: { attached: true, edge: "follower", returnButton: false },
    },
    {
      name: "не слідую — кнопка повернення",
      run: run(),
      following: false,
      reading: true,
      view: { attached: false, edge: null, returnButton: true },
    },
    {
      name: "в іншому режимі — кнопка повернення, вона ж вертає в читання",
      run: run(),
      following: false,
      reading: false,
      view: { attached: false, edge: null, returnButton: true },
    },
    {
      name: "ініціатор у читанні — веде позицію, своя тінь, без кнопки",
      run: run({ initiator: { device: "me", name: "Я" } }),
      following: false,
      reading: true,
      view: { attached: true, edge: "initiator", returnButton: false },
    },
    {
      name: "ініціатор в іншому режимі — кнопка повертає його в читання",
      run: run({ initiator: { device: "me", name: "Я" } }),
      following: false,
      reading: false,
      view: { attached: false, edge: null, returnButton: true },
    },
  ])("$name", ({ run, following, reading, view }) => {
    expect(followView({ run, device: "me", following, reading, steering: false })).toEqual(view);
  });
});

describe("followView — ініціатор рухає гурт (`SCROLL-25`)", () => {
  const mine = run({ initiator: { device: "me", name: "Я" } });

  it("гортає — фокусний рядок за його скролом, тінь лишається, кнопки немає", () => {
    expect(
      followView({ run: mine, device: "me", following: false, reading: true, steering: true }),
    ).toEqual({ attached: false, edge: "initiator", returnButton: false });
  });

  it("у того, хто слідує, скрол ініціатора нічого не міняє", () => {
    expect(
      followView({ run: run(), device: "me", following: true, reading: true, steering: false }),
    ).toEqual({ attached: true, edge: "follower", returnButton: false });
  });
});
