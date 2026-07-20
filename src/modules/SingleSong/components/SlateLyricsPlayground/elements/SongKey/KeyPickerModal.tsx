import { useState } from "react";
import { keys as VALID_KEYS } from "#utils/keyUtils";

export type KeyChangeMode = "transpose" | "relabel";

interface Props {
  current: string;
  onPick: (key: string, mode: KeyChangeMode) => void;
  onClose: () => void;
}

function display(k: string): string {
  return k.replace("sharp", "#");
}

export function KeyPickerModal({ current, onPick, onClose }: Props) {
  const [mode, setMode] = useState<KeyChangeMode>("transpose");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg p-4 max-w-xs w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-medium mb-3">Тональність</div>

        <div className="flex gap-1 mb-2 p-0.5 bg-gray-100 rounded-md text-xs">
          <button
            type="button"
            onClick={() => setMode("transpose")}
            className={`flex-1 px-2 py-1.5 rounded ${
              mode === "transpose"
                ? "bg-white shadow font-medium"
                : "text-gray-500"
            }`}
          >
            Транспонувати
          </button>
          <button
            type="button"
            onClick={() => setMode("relabel")}
            className={`flex-1 px-2 py-1.5 rounded ${
              mode === "relabel"
                ? "bg-white shadow font-medium"
                : "text-gray-500"
            }`}
          >
            Лише ярлик
          </button>
        </div>
        <div className="text-[11px] text-gray-400 mb-3 leading-snug">
          {mode === "transpose"
            ? "Акорди перепишуться на нову тональність."
            : "Зміниться лише підпис, акорди залишаться без змін."}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {VALID_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              className={`px-2 py-1.5 rounded border text-sm ${
                k === current
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => {
                onPick(k, mode);
                onClose();
              }}
            >
              {display(k)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
