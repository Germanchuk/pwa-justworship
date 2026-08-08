import { useSlate } from "slate-react";

import { useFiltersApply } from "../../../mode";
import { useCurrentUsername } from "../elements/hooks";
import type { DisplayState } from "./model";
import { resolveDisplay } from "./operations";

const NOTHING_HIDDEN: DisplayState = { chordsHidden: false, lyricsHidden: false };

/**
 * Фільтри показу, які ДІЮТЬ ЗАРАЗ — на відміну від `resolveDisplay`, що
 * повертає записане в документі.
 *
 * Поза читанням фільтри знімаються (див. таблицю в `mode.tsx`), значення в
 * документі лишається. `filtersApply` дає UI зрозуміти, що перемикач показує
 * не збережений, а вимушений стан.
 */
export interface EffectiveDisplay {
  /** Що ховається зараз. */
  state: DisplayState;
  /** Що записано в документі (повернеться при виході в читання). */
  stored: DisplayState;
  filtersApply: boolean;
}

export const useDisplay = (): EffectiveDisplay => {
  // useSlate (не useSlateStatic): фільтри — per-user стан у документі, без
  // підписки перемикач не перемалював би рядки одразу.
  const editor = useSlate();
  const username = useCurrentUsername();
  const filtersApply = useFiltersApply();

  const stored = resolveDisplay(editor, username);

  return {
    state: filtersApply ? stored : NOTHING_HIDDEN,
    stored,
    filtersApply,
  };
};
