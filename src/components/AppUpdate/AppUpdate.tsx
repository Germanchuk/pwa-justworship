import { useState } from "react";
import { ArrowPathIcon, SparklesIcon, XMarkIcon } from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";
import { APP_VERSION } from "#constants/changelog";
import { useAppUpdate, useWhatsNew } from "#hooks/useAppUpdate";

/**
 * «Є нова версія» на головному екрані.
 *
 * Оновлення НЕ примусове: нова версія лежить готова, але вмикає її сам
 * користувач — щоб застосунок не перезавантажився посеред служіння.
 */
export function UpdateBanner() {
  const { needRefresh, applyUpdate } = useAppUpdate();
  const [updating, setUpdating] = useState(false);

  if (!needRefresh) return null;

  async function onUpdate() {
    setUpdating(true);
    try {
      // Перемикає SW і сама перезавантажує сторінку — стан «updating»
      // живе рівно до перезавантаження.
      await applyUpdate();
    } catch (e) {
      console.error("App update failed", e);
      setUpdating(false);
    }
  }

  return (
    <div className="mb-3 flex items-center gap-3 rounded-xl border border-foreground/20 bg-accent/50 p-3 shadow-xs">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background/60 text-foreground/70">
        <SparklesIcon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">Є нова версія</p>
        <p className="text-sm text-muted-foreground">
          Оновлення вже завантажене — застосунок перезапуститься.
        </p>
      </div>
      <Button size="sm" onClick={onUpdate} disabled={updating}>
        <ArrowPathIcon className={updating ? "size-4 animate-spin" : "size-4"} />
        {updating ? "Оновлюю…" : "Оновити"}
      </Button>
    </div>
  );
}

/**
 * «Що нового» після оновлення: список змін усіх версій, що вийшли з
 * моменту, коли користувач востаннє відкривав застосунок.
 */
export function WhatsNewCard() {
  const { entries, dismiss } = useWhatsNew();

  if (entries.length === 0) return null;

  return (
    <div className="mb-3 rounded-xl border border-border bg-background/60 p-3 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">
            Оновлено до версії {APP_VERSION}
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1 ps-5 text-sm text-muted-foreground">
            {entries.flatMap((entry) =>
              entry.changes.map((change) => (
                <li key={`${entry.version}-${change}`}>{change}</li>
              )),
            )}
          </ul>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Сховати"
          className="rounded-md p-1 text-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
        >
          <XMarkIcon className="size-5" />
        </button>
      </div>
    </div>
  );
}
