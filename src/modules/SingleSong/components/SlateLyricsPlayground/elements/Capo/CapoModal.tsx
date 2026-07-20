import { useState } from "react";
import { MetaModal } from "../MetaModal/MetaModal";

interface Props {
  current: number;
  onSave: (value: number) => void;
  onClose: () => void;
}

export function CapoModal({ current, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(String(current));

  const commit = () => {
    const n = Math.max(0, Math.min(11, Math.floor(Number(draft) || 0)));
    onSave(n);
    onClose();
  };

  return (
    <MetaModal title="Капо (поріг)" onClose={onClose}>
      <input
        type="text"
        inputMode="numeric"
        autoFocus
        className="w-full border border-gray-300 rounded px-2 py-1 text-lg tabular-nums"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 2))}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") onClose();
        }}
      />
      <div className="text-xs text-gray-500 mt-1">0–11 (тільки для тебе)</div>
      <div className="flex justify-end gap-2 mt-3">
        <button
          type="button"
          className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50"
          onClick={onClose}
        >
          Скасувати
        </button>
        <button
          type="button"
          className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          onClick={commit}
        >
          Зберегти
        </button>
      </div>
    </MetaModal>
  );
}
