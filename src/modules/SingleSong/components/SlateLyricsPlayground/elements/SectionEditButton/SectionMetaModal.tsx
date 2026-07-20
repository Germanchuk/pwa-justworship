import { useMemo, useState } from "react";
import { XMarkIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Slider } from "@/components/ui/slider";
import { MetaModal } from "../MetaModal/MetaModal";
import {
  DYNAMICS_STEPS,
  DYNAMICS_STEPS_MAX,
  buildDynamicsGradient,
  getDynamicsStep,
  type DynamicsStepKey,
} from "../../constants/dynamicsSteps";

interface Props {
  sectionPreview: string;
  currentRepeat: number | undefined;
  currentDynamicsSteps: DynamicsStepKey[] | undefined;
  onSave: (next: {
    repeat: number | undefined;
    dynamicsSteps: DynamicsStepKey[] | undefined;
  }) => void;
  onClose: () => void;
}

export function SectionMetaModal({
  sectionPreview,
  currentRepeat,
  currentDynamicsSteps,
  onSave,
  onClose,
}: Props) {
  const [repeat, setRepeat] = useState(
    Math.min(10, Math.max(1, currentRepeat ?? 1)),
  );
  const [steps, setSteps] = useState<DynamicsStepKey[]>(
    currentDynamicsSteps ? [...currentDynamicsSteps] : [],
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const previewGradient = useMemo(
    () => buildDynamicsGradient(steps) ?? "#e5e7eb",
    [steps],
  );

  const atLimit = steps.length >= DYNAMICS_STEPS_MAX;

  const addStep = (key: DynamicsStepKey) => {
    if (atLimit) return;
    setSteps((prev) => [...prev, key]);
    setPickerOpen(false);
  };
  const removeAt = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };
  const moveStep = (index: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const commit = () => {
    onSave({
      repeat: repeat <= 1 ? undefined : repeat,
      dynamicsSteps: steps.length === 0 ? undefined : steps,
    });
    onClose();
  };

  return (
    <MetaModal title="Атрибути секції" onClose={onClose}>
      {sectionPreview && (
        <div className="text-sm text-gray-800 italic mb-3 truncate border-l-2 border-blue-900 pl-2">
          {sectionPreview}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-600">Повторів</label>
          <span className="text-xs tabular-nums text-gray-700">x{repeat}</span>
        </div>
        <Slider
          aria-label="Повторів"
          min={1}
          max={10}
          step={1}
          ticks={[1, 5, 10]}
          value={[repeat]}
          onValueChange={(v) => setRepeat(v[0] ?? 1)}
          className="mt-1"
        />
      </div>

      <div className="flex flex-col gap-2 mt-4">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-600">Кроки динаміки</label>
          <span className="text-xs tabular-nums text-gray-700">
            {steps.length}/{DYNAMICS_STEPS_MAX}
          </span>
        </div>

        <div className="flex items-stretch gap-2">
          <div
            className="w-2 rounded-sm shrink-0"
            style={{ background: previewGradient }}
            aria-hidden
          />
          <div className="flex-1 flex flex-col gap-1">
            {steps.length === 0 && (
              <div className="text-xs text-gray-500 italic">
                Кроків ще немає. Додайте перший.
              </div>
            )}
            {steps.map((key, index) => {
              const step = getDynamicsStep(key);
              return (
                <div
                  key={`${key}-${index}`}
                  className="flex items-center gap-2 text-sm border border-gray-200 rounded px-2 py-1"
                >
                  <span
                    className="inline-block w-3 h-3 rounded-full border border-black/10"
                    style={{ background: step.color }}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">{step.label}</span>
                  <button
                    type="button"
                    className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30"
                    onClick={() => moveStep(index, -1)}
                    disabled={index === 0}
                    aria-label="Перемістити вгору"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30"
                    onClick={() => moveStep(index, 1)}
                    disabled={index === steps.length - 1}
                    aria-label="Перемістити вниз"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-red-600"
                    onClick={() => removeAt(index)}
                    aria-label="Видалити крок"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {pickerOpen ? (
          <div className="border border-gray-200 rounded p-2 flex flex-col gap-1 bg-gray-50">
            {DYNAMICS_STEPS.map((step) => (
              <button
                key={step.key}
                type="button"
                className="flex items-center gap-2 text-sm rounded px-2 py-1 hover:bg-white"
                onClick={() => addStep(step.key)}
              >
                <span
                  className="inline-block w-3 h-3 rounded-full border border-black/10"
                  style={{ background: step.color }}
                  aria-hidden
                />
                <span className="flex-1 text-left">{step.label}</span>
              </button>
            ))}
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-800 self-end mt-1"
              onClick={() => setPickerOpen(false)}
            >
              Закрити
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="flex items-center justify-center gap-1 text-sm rounded border border-dashed border-gray-300 hover:bg-gray-50 px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setPickerOpen(true)}
            disabled={atLimit}
          >
            <PlusIcon className="w-4 h-4" />
            Додати крок
          </button>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-4">
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
