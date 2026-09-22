import { memo } from "react";

import { StaticSong } from "#modules/SingleSong/components/StaticSong/StaticSong";
import type { GatheringItem } from "./buildGathering";

/**
 * Один пункт служіння на екрані. `memo` тримає ряд спокійним: на екрані до
 * десятка живих Slate-документів, і перемальовувати їх усі без причини дорого.
 */
export const GatheringItemView = memo(function GatheringItemView({ item }: { item: GatheringItem }) {
  return (
    <section className="border-t border-dashed border-border/70 py-4 first:border-t-0 first:pt-0">
      {item.kind === "song" && (
        <>
          {/* Номер над піснею: єдина навігаційна підказка на екрані, де
              гортають пальцем. На репетиції домовляються саме номерами. */}
          <div className="mb-1 text-sm font-semibold text-muted-foreground">{item.number}</div>
          <StaticSong docId={item.point.songId} slate={item.nodes} />
        </>
      )}

      {/* Програш — такий самий документ, як пісня: акорди, згенеровані зі
          стику сусідів, під текстом примітки. Свого вмісту він не має й мати
          не може (`LIST-26`). */}
      {item.kind === "sounding" && <StaticSong docId={item.key} slate={item.nodes} />}

      {/* Примітка без програша — просто рядок: тут говорить ведучий. */}
      {item.kind === "note" && (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-base text-foreground/80">
          {item.text}
        </p>
      )}
    </section>
  );
});
