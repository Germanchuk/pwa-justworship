import { describe, expect, it } from "vitest";

import { followView, IDLE_VIEW, type FollowView } from "./follow";
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

describe("followView — хто прикріплений до автоскролу (`SCROLL-19`…`SCROLL-22`)", () => {
  const mine = run({ initiator: { device: "me", name: "Я" } });

  it.each<{
    name: string;
    run: AutoscrollRun | null;
    reading: boolean;
    steering: boolean;
    view: FollowView;
  }>([
    { name: "автоскролу немає — нічого", run: null, reading: true, steering: false, view: IDLE_VIEW },
    {
      name: "учасник у читанні — їде разом, тонка тінь",
      run: run(),
      reading: true,
      steering: false,
      view: { attached: true, edge: "follower" },
    },
    {
      name: "учасник поза читанням — не прикріплений, нічого не видно",
      run: run(),
      reading: false,
      steering: false,
      view: IDLE_VIEW,
    },
    {
      name: "ініціатор у читанні — веде, своя тінь (`SCROLL-29`)",
      run: mine,
      reading: true,
      steering: false,
      view: { attached: true, edge: "initiator" },
    },
    {
      name: "ініціатор гортає — фокус за скролом, тінь лишається (`SCROLL-25`)",
      run: mine,
      reading: true,
      steering: true,
      view: { attached: false, edge: "initiator" },
    },
    {
      name: "ініціатор поза читанням — не веде (`SCROLL-31`)",
      run: mine,
      reading: false,
      steering: false,
      view: IDLE_VIEW,
    },
  ])("$name", ({ run, reading, steering, view }) => {
    expect(followView({ run, device: "me", reading, steering })).toEqual(view);
  });
});
