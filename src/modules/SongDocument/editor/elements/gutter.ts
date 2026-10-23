/**
 * Поле рядка: кожна доріжка — слова, акорди, вигуки, таби, кахон,
 * прямокутники — починається з однієї лінії (як поле в зошиті). До лінії —
 * своє кожної доріжки, що не прокручується: назви струн і ударів, кнопка
 * довжини рядка; смужка динаміки — перед словами й акордами.
 */
import type { CSSProperties } from "react";

export const GUTTER = 24;
const MARGIN_INK = "rgba(220, 38, 38, 0.2)";
/** Лінія поля — фоном доріжки: доріжки рядка складають її суцільною. */
export const MARGIN_LINE: CSSProperties = {
  backgroundImage: `linear-gradient(${MARGIN_INK}, ${MARGIN_INK})`,
  backgroundSize: "1px 100%",
  backgroundPosition: `${GUTTER - 2}px 0`,
  backgroundRepeat: "no-repeat",
};
