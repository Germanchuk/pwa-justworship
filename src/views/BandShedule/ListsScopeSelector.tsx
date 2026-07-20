import {
  CheckCircleIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import classNames from "classnames";
import CircleIcon from "#icons/CircleIcon";
import { Dropdown } from "#components";
import { Button } from "@/components/ui/button";

export type ListsScope = "currentBand" | "myBands" | "church";

type Option = {
  value: ListsScope;
  label: string;
};

type Props = {
  value: ListsScope;
  onChange: (next: ListsScope) => void;
  userBandsCount: number;
  hasChurch: boolean;
};

const ALL_OPTIONS: Option[] = [
  { value: "currentBand", label: "Поточний гурт" },
  { value: "myBands", label: "Усі мої гурти" },
  { value: "church", label: "Уся церква" },
];

export default function ListsScopeSelector({
  value,
  onChange,
  userBandsCount,
  hasChurch,
}: Props) {
  const options = ALL_OPTIONS.filter((option) => {
    if (option.value === "myBands") return userBandsCount > 1;
    if (option.value === "church") return hasChurch;
    return true;
  });

  const currentLabel =
    ALL_OPTIONS.find((option) => option.value === value)?.label ??
    ALL_OPTIONS[0].label;

  if (options.length <= 1) {
    return null;
  }

  return (
    <Dropdown
      position="bottom"
      trigger={(isOpen) => (
        <Button size="sm" variant="outline">
          {currentLabel}
          <ChevronDownIcon
            className={classNames("w-4 h-4", { "rotate-180": isOpen })}
          />
        </Button>
      )}
    >
      <ul className="flex flex-col gap-1 p-2 list-none bg-muted rounded-md w-full shadow-md m-0 [&_li>span]:flex [&_li>span]:items-center [&_li>span]:gap-2 [&_li>span]:rounded-md [&_li>span]:px-3 [&_li>span]:py-2 [&_li>span]:text-sm hover:[&_li>span]:bg-accent hover:[&_li>span]:text-accent-foreground">
        {options.map((option) => (
          <li key={option.value} onClick={() => onChange(option.value)}>
            <span
              className={classNames("bg-muted", {
                "bg-accent": option.value === value,
              })}
            >
              {option.value === value ? (
                <CheckCircleIcon className="w-5 h-5" />
              ) : (
                <CircleIcon className="w-5 h-5" />
              )}
              {option.label}
            </span>
          </li>
        ))}
      </ul>
    </Dropdown>
  );
}
