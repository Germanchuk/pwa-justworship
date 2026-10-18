/**
 * Фарбування динаміки — не через Slate: зона збоку рядка поза текстом. Один
 * мазок пальцем — одна правка моделі й один крок undo.
 */
import { DynamicsLayer, DynamicsStepKey, Line, paintDynamics } from "../../model";
import type { History } from "../history";
import { COMMAND, ViewState } from "../state";

export type Paint = (lines: Line[], key: DynamicsStepKey | null, layer?: DynamicsLayer) => void;

export function installPaint(s: ViewState, history: History): Paint {
  return (lines, key, layer = null) => {
    history.before();
    s.undoManager.stopCapturing();
    s.song.doc.transact(() => paintDynamics(s.song, lines, key, layer), COMMAND);
    s.undoManager.stopCapturing();
    history.after();
  };
}
