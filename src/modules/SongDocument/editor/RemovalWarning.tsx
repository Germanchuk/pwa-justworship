/**
 * Попередження перед видаленням рядка з вмістом доріжок (`SONG-90`): перший
 * Backspace на початку порожніх слів показує, що зникне; другий — видаляє.
 * Кнопки — для телефона, де Backspace на порожньому рядку натиснути двічі незручно.
 */
import { allLanes, KIND_NAMES } from "../model";
import { useEditorCtx } from "./context";

export function RemovalWarning() {
  const { lanes, song } = useEditorCtx();
  const pending = lanes.removal.pending();
  if (!pending) return null;
  const all = allLanes(song.doc);
  const names = pending.lanes.map((id) => all.find((l) => l.id === id)?.name ?? KIND_NAMES.chords);
  const keep = (e: React.MouseEvent) => e.preventDefault(); // фокус лишається в редакторі
  return (
    <div
      role="alert"
      className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 w-[min(92vw,26rem)] rounded-lg bg-stone-800 text-white text-sm shadow-lg px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1"
    >
      <span className="flex-1 min-w-[12rem]">
        У рядку є: {names.join(", ")}. Ще раз <b>Backspace</b> — видалити рядок.
      </span>
      <button type="button" className="font-semibold text-red-300" onMouseDown={keep} onClick={lanes.removal.confirm}>
        Видалити
      </button>
      <button type="button" className="text-stone-300" onMouseDown={keep} onClick={lanes.removal.cancel}>
        Скасувати
      </button>
    </div>
  );
}
