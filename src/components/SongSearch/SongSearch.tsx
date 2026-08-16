import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

import { Routes } from "#constants/routes";
import { cn } from "@/lib/utils";

/** Спільний вигляд поля: тригер на головній має виглядати як справжній ввід. */
const fieldClass =
  "flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-start shadow-xs";

const PLACEHOLDER = "Знайти пісню";

/**
 * Поле пошуку на головній. Це кнопка, а не ввід: клік веде на сторінку
 * пошуку, а вже там стоїть справжній ввід з фокусом. Так на мобільному не
 * блимає клавіатура перед самим переходом.
 */
export function SongSearchTrigger({ className }: { className?: string }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(Routes.SearchSongs)}
      className={cn(fieldClass, "cursor-pointer hover:bg-accent/40", className)}
    >
      <MagnifyingGlassIcon className="size-5 shrink-0 text-muted-foreground" />
      <span className="text-base text-muted-foreground md:text-sm">
        {PLACEHOLDER}
      </span>
    </button>
  );
}

/** Справжнє поле вводу — живе на сторінці пошуку й фокусується саме. */
export function SongSearchInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  const ref = useRef<HTMLInputElement>(null);

  // autoFocus атрибутом на мобільному часто ігнорується — фокусуємо руками
  // одразу після монтування.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <label className={cn(fieldClass, className)}>
      <MagnifyingGlassIcon className="size-5 shrink-0 text-muted-foreground" />
      <input
        ref={ref}
        type="search"
        placeholder={PLACEHOLDER}
        className="grow bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
        {...props}
      />
    </label>
  );
}
