/**
 * Будь-яка зміна моделі — своя команда, чужа правка з мережі, undo — приходить
 * подією Yjs і тут доходить у видиме: спершу склад рядків, потім текст.
 */
import * as Y from "yjs";
import { layout } from "../../model";
import { quietly, TYPING, ViewState } from "../state";
import { alignLines } from "./align";
import { applyChordsDelta, applyWordsDelta } from "./deltas";

/** Підписатися на модель; повертає відписку. */
export function observeModel(s: ViewState) {
  const onChange = (events: Y.YEvent<Y.AbstractType<unknown>>[], tx: Y.Transaction) => {
    const before = s.lines;
    s.lines = layout(s.song);
    quietly(s, () => {
      const fresh = alignLines(s);
      if (tx.origin === TYPING) return; // власний друк видиме вже показало
      events.forEach((e) => {
        if (!(e instanceof Y.YTextEvent)) return; // кахон, примітки — не в дереві Slate
        if (e.target === s.song.text) applyWordsDelta(s, e.delta, before, fresh);
        else if (!fresh.has(e.target)) applyChordsDelta(s, e.target, e.delta);
      });
    });
  };
  // Список доріжок (нові, прибрані, порядок доданих) — лише склад видимого.
  const lanes = s.song.doc.getMap("lanes");
  const onLanes = () => quietly(s, () => alignLines(s));
  s.song.text.observeDeep(onChange);
  lanes.observeDeep(onLanes);
  return () => {
    s.song.text.unobserveDeep(onChange);
    lanes.unobserveDeep(onLanes);
  };
}
