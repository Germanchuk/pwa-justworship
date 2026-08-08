import type { ReactNode } from "react";
import { Switch as AriaSwitch } from "react-aria-components";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

type SwitchProps = {
  className?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible label (no visible label is rendered). */
  "aria-label"?: string;
  title?: string;
  /** Іконка в кружечку у ввімкненому / вимкненому стані. */
  iconOn?: ReactNode;
  iconOff?: ReactNode;
};

/**
 * App switch built on React Aria (як і Slider). Кружечок несе іконку стану:
 * за замовчуванням відкрите око (ввімкнено) / закреслене (вимкнено).
 */
function Switch({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  "aria-label": ariaLabel = "Перемикач",
  title,
  iconOn = <Eye />,
  iconOff = <EyeOff />,
}: SwitchProps) {
  return (
    <AriaSwitch
      aria-label={ariaLabel}
      isSelected={checked}
      defaultSelected={defaultChecked}
      isDisabled={disabled}
      onChange={onCheckedChange}
      className={cn(
        "group inline-flex shrink-0 cursor-pointer touch-none select-none items-center outline-none data-[disabled]:cursor-default data-[disabled]:opacity-50",
        className,
      )}
    >
      <span
        title={title}
        className={cn(
          "relative flex h-7 w-12 items-center rounded-full border border-stone-300 bg-stone-200 p-0.5 transition-colors",
          "group-data-[selected]:border-blue-900 group-data-[selected]:bg-blue-900",
          "group-data-[focus-visible]:ring-4 group-data-[focus-visible]:ring-blue-900/25",
        )}
      >
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full bg-white text-stone-500 shadow-sm transition-[transform,color]",
            "[&_svg]:size-3.5 [&_svg]:stroke-[2.25]",
            "group-data-[selected]:translate-x-5 group-data-[selected]:text-blue-900",
          )}
        >
          <span className="group-data-[selected]:hidden">{iconOff}</span>
          <span className="hidden group-data-[selected]:block">{iconOn}</span>
        </span>
      </span>
    </AriaSwitch>
  );
}

export { Switch };
