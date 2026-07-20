import { describe, expect, it } from "vitest";
import {
  keyForCapo,
  transposeChordText,
  transposeChordTextForCapo,
} from "./transposeChords";

describe("transposeChords (sanity)", () => {
  it("капо вниз: C, капо +3 → грає в A", () => {
    expect(keyForCapo("C", 3)).toBe("A");
    expect(keyForCapo("C", 0)).toBe("C");
  });

  it("re-pitch зберігає бари/пробіли, міняє лише акорди", () => {
    // C→D (вгору 2 півтони). Бар | і крапки . лишаються; пробіли збережені.
    const out = transposeChordText("| C  . G | Am F |", "C", "D");
    expect(out).toBe("| D  . A | Bm G |");
  });

  it("капо-показ транспонує вниз на capo", () => {
    // songKey C, capo 3 → ефективна A: C→A, G→E, Am→F#m, F→D
    const out = transposeChordTextForCapo("| C G | Am F |", "C", 3);
    expect(out).toBe("| A E | F#m D |");
  });

  it("капо 2 від C працює (A# → енгармонік Bb, бо chord-transposer не має A# major)", () => {
    // Регресія: раніше .toKey("A#") хибно резолвилось у C → акорди не мінялись.
    const out = transposeChordTextForCapo("| C G | Am F |", "C", 2);
    expect(out).toBe("| Bb F | Gm Eb |");
  });

  it("не чіпає не-акорди й порожнечу", () => {
    expect(transposeChordText("", "C", "D")).toBe("");
    expect(transposeChordTextForCapo("| C G |", "C", 0)).toBe("| C G |");
  });
});
