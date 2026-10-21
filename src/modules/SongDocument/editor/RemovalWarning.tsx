/**
 * Попередження перед видаленням рядків: рядка з вмістом доріжок (`SONG-90`),
 * виділення через кілька рядків (`SONG-91`) чи склеюванням двох рядків
 * (`SONG-92`). Друга така сама дія — виконує.
 * Кнопки — для телефона, де Backspace на порожньому рядку натиснути двічі незручно.
 */
import { allLanes, KIND_NAMES } from "../model";
import { useEditorCtx } from "./context";
import { DYNAMICS_PANEL_BOTTOM } from "./dynamics/DynamicsPalette";
import { useDynamicsPanel } from "./dynamics/panel";

export function RemovalWarning() {
  const { lanes, song } = useEditorCtx();
  const pending = lanes.removal.pending();
  const panel = useDynamicsPanel();
  if (!pending) return null;
  const all = allLanes(song.doc);
  const what =
    pending.kind === "line" ? (
      <>
        У рядку є: {pending.lanes.map((id) => all.find((l) => l.id === id)?.name ?? KIND_NAMES.chords).join(", ")}. Ще раз{" "}
        <b>Backspace</b> — видалити рядок.
      </>
    ) : pending.kind === "range" ? (
      <>
        Виділення захоплює {pending.rows} {rowsWord(pending.rows)}. Ще раз <b>Backspace</b> чи <b>Delete</b> — видалити.
      </>
    ) : (
      <>
        Цей рядок склеїться з {pending.forward ? "наступним" : "попереднім"}. Ще раз{" "}
        <b>{pending.forward ? "Delete" : "Backspace"}</b> — склеїти.
      </>
    );
  const keep = (e: React.MouseEvent) => e.preventDefault(); // фокус лишається в редакторі
  return (
    <div
      role="alert"
      // Відкрита панель динаміки стоїть там само — попередження над нею.
      style={panel ? { bottom: `calc(${DYNAMICS_PANEL_BOTTOM} + 6.5rem)` } : undefined}
      className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 w-[min(92vw,26rem)] rounded-lg bg-stone-800 text-white text-sm shadow-lg px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1"
    >
      <span className="flex-1 min-w-[12rem]">{what}</span>
      <button type="button" className="font-semibold text-red-300" onMouseDown={keep} onClick={lanes.removal.confirm}>
        {pending.kind === "merge" ? "Склеїти" : "Видалити"}
      </button>
      <button type="button" className="text-stone-300" onMouseDown={keep} onClick={lanes.removal.cancel}>
        Скасувати
      </button>
    </div>
  );
}

/** «рядок / рядки / рядків» за числом. */
function rowsWord(n: number) {
  const [d, dd] = [n % 10, n % 100];
  if (d === 1 && dd !== 11) return "рядок";
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return "рядки";
  return "рядків";
}
