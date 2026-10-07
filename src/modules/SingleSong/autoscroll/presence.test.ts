import { describe, expect, it } from "vitest";

import { initiatorPresent, parsePresence, type Presence } from "./presence";
import type { AutoscrollRun } from "./run";

const run: AutoscrollRun = {
  row: 0,
  startedAt: 0,
  bpm: 60,
  beatsPerBar: 4,
  initiator: { device: "a", name: "Аня" },
  movedAt: null,
  held: false,
  speed: 1,
};

describe("initiatorPresent — чи ініціатор на пісні в читанні (`SCROLL-8`)", () => {
  // Ініціатор — пристрій «a»; пісня — 7.
  it.each<{ name: string; presences: Presence[]; present: boolean }>([
    { name: "на цій пісні в читанні", presences: [{ device: "a", songId: "7", mode: "read" }], present: true },
    { name: "на цій пісні в редагуванні (`SCROLL-31`)", presences: [{ device: "a", songId: "7", mode: "edit" }], present: false },
    { name: "на цій пісні в примітках", presences: [{ device: "a", songId: "7", mode: "notes" }], present: false },
    { name: "на іншій пісні", presences: [{ device: "a", songId: "8", mode: "read" }], present: false },
    { name: "не на пісні (список, інша сторінка)", presences: [], present: false },
    { name: "та сама людина з іншого пристрою (`SCROLL-27`)", presences: [{ device: "b", songId: "7", mode: "read" }], present: false },
    {
      name: "серед інших — він є",
      presences: [
        { device: "b", songId: "7", mode: "read" },
        { device: "a", songId: "7", mode: "read" },
      ],
      present: true,
    },
  ])("$name", ({ presences, present }) => {
    expect(initiatorPresent(run, 7, presences)).toBe(present);
  });
});

describe("parsePresence — запис присутності з awareness", () => {
  it("цілий — як є, пісня рядком", () => {
    expect(parsePresence({ device: "a", songId: 7, mode: "read" })).toEqual({
      device: "a",
      songId: "7",
      mode: "read",
    });
  });

  it.each([
    { name: "нічого", value: undefined },
    { name: "null — пристрій не на пісні", value: null },
    { name: "без пристрою", value: { songId: "7", mode: "read" } },
    { name: "без пісні", value: { device: "a", mode: "read" } },
    { name: "без режиму", value: { device: "a", songId: "7" } },
    { name: "невідомий режим", value: { device: "a", songId: "7", mode: "play" } },
  ])("$name — немає", ({ value }) => {
    expect(parsePresence(value)).toBeNull();
  });
});
