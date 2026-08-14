import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";

interface Props {
  open: boolean;
  current: number;
  /**
   * Стеля темпу. Залежить від розміру такту: BPM рахує імпульси, тому пісня в
   * 6/8 записується темпом вісімок і вимагає більшого діапазону, ніж 4/4.
   */
  max?: number;
  /** Що саме рахує BPM у цьому розмірі — «чвертей/хв» проти «вісімок/хв». */
  unitLabel?: string;
  onSave: (value: number) => void;
  onClose: () => void;
}

const BPM_MIN = 40;

export function BpmModal({
  open,
  current,
  max = 160,
  unitLabel = "уд/хв (BPM)",
  onSave,
  onClose,
}: Props) {
  // Clamp initial value to the allowed range. Default to 80 if current is 0 or out of range.
  const initialValue = current && current >= BPM_MIN && current <= max ? current : 80;
  const [draft, setDraft] = useState<number>(initialValue);

  // The Drawer stays mounted (so vaul can animate close); re-sync the draft and
  // dismiss the mobile keyboard each time it opens.
  useEffect(() => {
    if (!open) return;
    setDraft(initialValue);
    if (
      document.activeElement &&
      typeof (document.activeElement as HTMLElement).blur === "function"
    ) {
      (document.activeElement as HTMLElement).blur();
    }
  }, [open, initialValue]);

  const commit = () => {
    onSave(draft);
    onClose();
  };

  // Позначки — кожні 10, а на широкому діапазоні (6/8) кожні 20, щоб підписи
  // не злиплися. Крайні прибираємо: вони сидять на заокруглених кінцях доріжки.
  const tickStep = max - BPM_MIN > 120 ? 20 : 10;
  const ticks: number[] = [];
  for (let t = BPM_MIN; t <= max; t += tickStep) ticks.push(t);
  const shownTicks = ticks.slice(1, -1);

  const percentOf = (value: number) => ((value - BPM_MIN) / (max - BPM_MIN)) * 100;

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="px-4 pb-6 select-none bg-white data-[vaul-drawer-direction=bottom]:h-[97dvh] data-[vaul-drawer-direction=bottom]:max-h-[97dvh] data-[vaul-drawer-direction=bottom]:mt-0">
        <DrawerHeader className="pb-1 text-center shrink-0">
          <DrawerTitle className="text-sm font-semibold text-stone-500 uppercase tracking-wider">
            Темп (BPM)
          </DrawerTitle>
        </DrawerHeader>

        {/* Tall vertical layout container */}
        <div className="flex flex-col flex-1 justify-between py-2 mt-2 min-h-0">
          {/* Large indicator with +/- buttons */}
          <div className="flex items-center justify-between px-6 shrink-0">
            <button
              type="button"
              className="size-10 rounded-full border border-stone-200 flex items-center justify-center text-2xl hover:bg-stone-50 active:scale-90 transition-all font-semibold text-stone-700 cursor-pointer shadow-sm select-none p-0 m-0 bg-transparent"
              onClick={() => setDraft((v) => Math.max(BPM_MIN, v - 1))}
            >
              –
            </button>
            <div className="text-center select-none">
              <span className="text-5xl font-extrabold text-stone-900 tracking-tight tabular-nums">
                {draft}
              </span>
              <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-bold mt-0.5">
                {unitLabel}
              </span>
            </div>
            <button
              type="button"
              className="size-10 rounded-full border border-stone-200 flex items-center justify-center text-2xl hover:bg-stone-50 active:scale-90 transition-all font-semibold text-stone-700 cursor-pointer shadow-sm select-none p-0 m-0 bg-transparent"
              onClick={() => setDraft((v) => Math.min(max, v + 1))}
            >
              +
            </button>
          </div>

          {/* Vertical Slider & labeled ticks - occupying maximum remaining height */}
          <div className="flex-1 flex justify-center items-center py-6 my-2 min-h-0">
            <div className="relative h-full flex items-stretch gap-6 w-32 justify-center">
              {/* Tick labels (left) */}
              <div className="relative h-full w-12 text-stone-500 select-none py-1">
                {shownTicks.map((t) => {
                  const percent = percentOf(t);
                  const isActive = draft === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDraft(t)}
                      className={`absolute right-0 text-right text-[10px] font-semibold transition-all -translate-y-1/2 cursor-pointer hover:text-blue-900 active:scale-90 p-0 m-0 border-none bg-transparent outline-none focus:outline-none whitespace-nowrap ${
                        isActive ? "text-blue-900 font-bold scale-125" : "text-stone-400"
                      }`}
                      style={{ top: `${100 - percent}%` }}
                    >
                      {t} —
                    </button>
                  );
                })}
              </div>

              {/* Vertical fader slider (right) */}
              <div className="h-full py-1">
                <Slider
                  orientation="vertical"
                  min={BPM_MIN}
                  max={max}
                  step={1}
                  value={[draft]}
                  onValueChange={(val) => setDraft(val[0])}
                  ticks={shownTicks}
                  aria-label="Темп пісні"
                  className="h-full"
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-3 border-t border-stone-100 shrink-0">
            <DrawerClose asChild>
              <button
                type="button"
                className="flex-1 py-3 text-sm font-semibold rounded-md border border-stone-200 text-stone-700 hover:bg-stone-50 active:scale-95 transition-all cursor-pointer bg-transparent animate-none"
                onClick={onClose}
              >
                Скасувати
              </button>
            </DrawerClose>
            <button
              type="button"
              className="flex-1 py-3 text-sm font-semibold rounded-md bg-blue-900 text-white hover:bg-blue-950 active:scale-95 transition-all cursor-pointer shadow-sm border-none animate-none"
              onClick={commit}
            >
              Зберегти
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

