/**
 * Друк і стирання символу: видиме застосовує операцію саме, у модель іде та
 * сама правка тексту — без перемальовування рядка. Будь-яка інша операція
 * Slate, що прийшла в обхід правил, відкочується: видиме збирається з моделі.
 */
import { eraseIn, insertIn } from "../../model";
import { rebuild } from "../from-model/align";
import type { History } from "../history";
import { toModel } from "../positions";
import { TYPING, ViewState } from "../state";

export function interceptTyping(s: ViewState, history: History) {
  const { song, view } = s;
  const { apply } = view;
  let rebuildQueued = false;

  view.apply = (op) => {
    if (s.syncing || op.type === "set_selection") return apply(op);
    if (op.type === "insert_text" || op.type === "remove_text") {
      const at = toModel(s, { path: op.path, offset: op.offset });
      history.before();
      apply(op);
      song.doc.transact(() => {
        if (op.type === "insert_text") insertIn(song, at, op.text);
        else eraseIn(song, at.line, at.lane, at.offset, at.offset + op.text.length);
      }, TYPING);
      history.after();
      return;
    }
    // Щось змінило структуру видимого в обхід правил — відкочуємо видиме до моделі.
    apply(op);
    if (!rebuildQueued) {
      rebuildQueued = true;
      console.warn(`laneView: операція «${op.type}» не через правила — видиме відкочено до документа`);
      queueMicrotask(() => {
        rebuildQueued = false;
        rebuild(s);
      });
    }
  };

  // Видиме — проєкція валідної моделі, нормалізувати нічого.
  view.normalizeNode = () => {};
}
