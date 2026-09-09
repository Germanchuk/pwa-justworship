import { describe, expect, it } from "vitest";

import {
  cardBg,
  cardBorder,
  COMMENT_PALETTE,
  highlightBg,
  isStrike,
  STRIKE_COLOR,
  STRIKE_INK,
} from "./colors";

/**
 * Закреслення їде в тому ж полі `color`, що й hex, — тож кожен helper, який
 * малює колір, зобовʼязаний резолвити sentinel. Інакше `parseInt("strike", 16)`
 * дає NaN і в стилі опиняється `rgba(NaN, NaN, NaN, 0.32)`.
 */
describe("strike sentinel", () => {
  it("не є жодним кольором палітри", () => {
    expect(COMMENT_PALETTE.some((c) => c.hex === STRIKE_COLOR)).toBe(false);
    expect(isStrike(STRIKE_COLOR)).toBe(true);
    expect(isStrike(COMMENT_PALETTE[0].hex)).toBe(false);
  });

  it("не дає NaN у жодному helper", () => {
    for (const css of [
      highlightBg(STRIKE_COLOR),
      cardBg(STRIKE_COLOR),
      cardBorder(STRIKE_COLOR),
    ]) {
      expect(css).not.toContain("NaN");
    }
    expect(cardBorder(STRIKE_COLOR)).toBe(STRIKE_INK);
  });

  it("не чіпає звичайні кольори", () => {
    expect(highlightBg("#F5C518")).toBe("rgba(245, 197, 24, 0.32)");
    expect(cardBorder("#F5C518")).toBe("#F5C518");
  });
});
