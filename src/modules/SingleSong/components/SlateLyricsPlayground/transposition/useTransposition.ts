import { useSlate } from "slate-react";

import { useCapoApplies } from "../../../mode";
import { useCurrentUsername } from "../elements/hooks";
import type { ResolvedTranspositionState } from "./model";
import { resolveTransposition } from "./operations";

/**
 * Транспозиція, яка ДІЄ ЗАРАЗ — на відміну від `resolveTransposition`, що
 * повертає те, що записано в документі.
 *
 * Різниця — режим: у редагуванні капо знімається (див. таблицю в `mode.tsx`).
 * Документ при цьому не чіпаємо: значення капо лишається, просто не
 * застосовується. Тому все, що ПОКАЗУЄ або ГРАЄ акорди, ходить сюди, а не в
 * `resolveTransposition` напряму.
 *
 * `applies: false` — капо виставлене, але цей режим його не застосовує; UI
 * використовує це, щоб приглушити бейдж і не брехати перемикачем.
 */
export interface EffectiveTransposition extends ResolvedTranspositionState {
  /** Капо, записане в документі (0 — немає або вимкнене свічем). */
  storedCapo: number;
  /** Чи застосовується капо в поточному режимі. */
  capoApplies: boolean;
}

export const useTransposition = (): EffectiveTransposition => {
  // useSlate (не useSlateStatic): капо живе в документі, і без підписки на
  // зміни редактора підпис/акорди не перемалювались би одразу.
  const editor = useSlate();
  const username = useCurrentUsername();
  const capoApplies = useCapoApplies();

  const stored = resolveTransposition(editor, username);

  return capoApplies
    ? { ...stored, storedCapo: stored.myCapo, capoApplies }
    : {
        songKey: stored.songKey,
        myCapo: 0,
        effectiveKey: stored.songKey,
        storedCapo: stored.myCapo,
        capoApplies,
      };
};
