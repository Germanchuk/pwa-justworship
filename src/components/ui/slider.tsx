import * as React from "react";
import {
  Slider as AriaSlider,
  SliderTrack,
  SliderThumb,
  SliderFill,
} from "react-aria-components";

import { cn } from "@/lib/utils";

type SliderProps = {
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  disabled?: boolean;
  /** Tick values to mark along the track, e.g. [1, 5, 10]. */
  ticks?: number[];
  /** Accessible label (no visible label is rendered). */
  "aria-label"?: string;
  orientation?: "horizontal" | "vertical";
};

/**
 * App slider built on React Aria. Range-ready: pass two values to get two
 * thumbs (від–до). Kept API-compatible with the previous Radix wrapper
 * (array `value` / `onValueChange`) so call sites don't change.
 */
function Slider({
  className,
  min = 0,
  max = 100,
  step = 1,
  value,
  defaultValue,
  onValueChange,
  disabled,
  ticks,
  "aria-label": ariaLabel = "Слайдер",
  orientation = "horizontal",
}: SliderProps) {
  const thumbCount = (value ?? defaultValue ?? [min]).length;
  const isVertical = orientation === "vertical";

  const percentOf = (v: number) => ((v - min) / (max - min)) * 100;

  return (
    <AriaSlider
      aria-label={ariaLabel}
      orientation={orientation}
      value={value}
      defaultValue={defaultValue}
      minValue={min}
      maxValue={max}
      step={step}
      isDisabled={disabled}
      onChange={(v) =>
        onValueChange?.(Array.isArray(v) ? v : [v as number])
      }
      className={cn(
        "relative flex touch-none select-none data-[disabled]:opacity-50",
        isVertical ? "h-full justify-center" : "w-full items-center",
        className,
      )}
    >
      <SliderTrack className={cn("relative flex", isVertical ? "w-11 h-full justify-center" : "h-11 w-full items-center")}>
        {/* visible bar */}
        <div
          className={cn(
            "absolute overflow-hidden rounded-full bg-stone-300/80",
            isVertical
              ? "inset-y-0 left-1/2 w-2.5 -translate-x-1/2"
              : "inset-x-0 top-1/2 h-2.5 -translate-y-1/2"
          )}
        >
          <SliderFill
            className={cn(
              "rounded-full bg-blue-900",
              isVertical ? "w-full" : "h-full"
            )}
          />
        </div>

        {ticks?.map((t) => (
          <span
            key={t}
            aria-hidden
            className={cn(
              "absolute rounded-full bg-stone-400/70",
              isVertical
                ? "left-1/2 w-3.5 h-0.5 -translate-x-1/2 translate-y-1/2"
                : "top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2"
            )}
            style={isVertical ? { bottom: `${percentOf(t)}%` } : { left: `${percentOf(t)}%` }}
          />
        ))}

        {Array.from({ length: thumbCount }, (_, index) => (
          <SliderThumb
            key={index}
            index={index}
            className={cn(
              "group flex size-11 items-center justify-center rounded-full outline-none",
              isVertical ? "left-1/2" : "top-1/2"
            )}
          >
            <span className="size-6 rounded-full border-2 border-blue-900 bg-white shadow-sm transition-[transform,box-shadow] group-hover:ring-4 group-data-[dragging]:scale-110 group-data-[focus-visible]:ring-4 ring-blue-900/25" />
          </SliderThumb>
        ))}
      </SliderTrack>
    </AriaSlider>
  );
}

export { Slider };
