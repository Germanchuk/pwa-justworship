import { describe, expect, it } from "vitest";

import type { ChordEvent } from "../getMidiFromSections/utils/createMidiFromProgression";
import type { PlaybackSegment } from "./model";
import { planPass } from "./planPass";

const progression: ChordEvent[] = [
  { chord: "C", duration: 4, tokenKey: "0:0:0" },
  { chord: "G", duration: 4, tokenKey: "0:0:1" },
];

const segment: PlaybackSegment = {
  id: "seg",
  progression,
  bpm: 80,
  timeSignature: [4, 4],
  kind: "once",
};

// Гуманізація вимкнена: інакше ноти отримують мікрозсув у часі, і перевіряти
// точні імпульси стало б неможливо.
const exact = { humanize: 0 };

describe("розкладка проходу в абсолютний час", () => {
  it("довжина проходу — сума тривалостей прогресії", () => {
    expect(planPass(segment, 0, exact).lengthBeats).toBe(8);
  });

  it("з нуля акорди стоять на своїх імпульсах", () => {
    const pass = planPass(segment, 0, exact);

    expect(pass.chords.map((c) => [c.chord, c.beats])).toEqual([
      ["C", 0],
      ["G", 4],
    ]);
  });

  it("старт зі зсувом переносить і акорди, і ноти", () => {
    const pass = planPass(segment, 16, exact);

    expect(pass.chords.map((c) => c.beats)).toEqual([16, 20]);
    expect(Math.min(...pass.notes.map((n) => n.beats))).toBe(16);
  });

  it("той самий сегмент, зіграний двічі, дає той самий малюнок зі зсувом", () => {
    const first = planPass(segment, 0, exact);
    const second = planPass(segment, 8, exact);

    expect(second.chords.map((c) => c.beats - 8)).toEqual(first.chords.map((c) => c.beats));
  });

  it("без префікса ключі токенів лишаються такими, як у пісні", () => {
    const pass = planPass(segment, 0, exact);

    expect(pass.chords.map((c) => c.tokenKey)).toEqual(["0:0:0", "0:0:1"]);
  });

  it("префікс пункту розводить однакові ключі різних пісень", () => {
    const pass = planPass({ ...segment, tokenKeyPrefix: "p3" }, 0, exact);

    expect(pass.chords.map((c) => c.tokenKey)).toEqual(["p3:0:0:0", "p3:0:0:1"]);
  });

  it("ноти справді народжуються — прохід не порожній", () => {
    const pass = planPass(segment, 0, exact);

    expect(pass.notes.length).toBeGreaterThan(0);
    expect(pass.segmentId).toBe("seg");
  });
});
