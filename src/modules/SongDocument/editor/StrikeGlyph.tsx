/** Знак закреслення на кружечку палітри — для закресленої примітки й для тиші в динаміці. */
import { STRIKE_INK } from "#modules/SingleSong/components/SlateLyricsPlayground/comments/colors";

export const STRIKE_SWATCH_STYLE = { background: "white", border: `2px solid ${STRIKE_INK}` } as const;

export const StrikeGlyph = () => <span style={{ textDecoration: "line-through", color: STRIKE_INK, lineHeight: 1 }}>S</span>;
