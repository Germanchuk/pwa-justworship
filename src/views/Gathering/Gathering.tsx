import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { formatDate } from "#utils/utils";
import { DEFAULT_LIST_TITLE } from "#constants/app";
import { useBand } from "#modules/Band/BandLayout";
import { ToPageBar } from "#layout/PageBar/ToPageBar";
import { SongModeProvider, StaticSongProvider } from "#modules/SingleSong/mode";
import { buildGathering } from "#modules/Gathering/buildGathering";
import { fetchGathering, type GatheringList } from "#modules/Gathering/gatheringSource";
import { GatheringItemView } from "#modules/Gathering/GatheringItemView";

/**
 * РЕЖИМ ЗІБРАННЯ — усе служіння одним екраном.
 *
 * Задача: не заходити в кожну пісню окремо. Гурт стоїть на сцені, порядок уже
 * складений, і між піснями має бути не повернення до списку, а просто дотик
 * пальцем униз.
 *
 * ─── ТРИ СВІДОМІ «НІ» ──────────────────────────────────────────────────────
 *   не редагується   — тут читають, а не правлять;
 *   не підключається — жодного вебсокета: вміст приїжджає одним HTTP-запитом;
 *   не оновлюється   — це знімок «як налаштували на репетиції», і саме тому
 *                      на нього можна покластись посеред служіння.
 *
 * ─── ЩО ВСЕ-ТАКИ ПЕРСОНАЛЬНЕ ───────────────────────────────────────────────
 * Капо, фільтри слів/акордів, згорнуті секції й свої примітки — усе на місці:
 * вони живуть у самому документі, тож приїжджають разом з ним (див.
 * `StaticSong`). Міняти їх тут не можна: змінам нікуди подітись. Хто хоче
 * інше капо — заходить у пісню.
 *
 * ─── БЕЗ ЗВУКУ ─────────────────────────────────────────────────────────────
 * Звук зібрання відкладено разом зі старим плеєром (ADR-0003,
 * `archive/chord-player`): тут немає ні «грати», ні голки, ні автоскролу.
 * Програш лишився — як акорди переходу, які гурт грає сам.
 */
export default function Gathering() {
  const { listId } = useParams();
  const band = useBand();
  const [list, setList] = useState<GatheringList | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchGathering(band.id, listId!)
      .then((data) => {
        if (!cancelled) setList(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [band.id, listId]);

  // Хук стоїть ДО ранніх виходів — інакше він викликався б через раз.
  // Знімок міняється рівно раз (коли приїхав), а збірка проганяє лексером усі
  // документи служіння: без пам'яті це рахувалось би на кожен ререндер екрана.
  const gathering = useMemo(() => buildGathering(list?.points ?? []), [list]);

  if (failed) {
    return (
      <div className="p-4 text-sm text-destructive">
        Не вдалося завантажити служіння. Спробуй ще раз.
      </div>
    );
  }

  if (!list) return null;

  return (
    // Режим форсуємо: у зібранні пісні в адресі немає, а від режиму залежить,
    // чи діють персональні налаштування показу (таблиця — в `mode.tsx`).
    <SongModeProvider mode="read">
      {/* Знімок, а не живий документ: налаштування показані й діють, але не
          редагуються, а шапка пісні закріплена (див. `mode.tsx`). */}
      <StaticSongProvider>
        <ToPageBar>{formatDate(list.date)}</ToPageBar>

        <div className="mb-3 rounded-xl border border-border bg-background/60 px-3 py-2 shadow-xs">
          <div className="text-base font-semibold leading-tight">{formatDate(list.date)}</div>
          <div className="text-sm text-muted-foreground">
            {list.title?.trim() || DEFAULT_LIST_TITLE}
          </div>
        </div>

        <div className="flex flex-col">
          {gathering.items.map((item) => (
            <GatheringItemView key={item.key} item={item} />
          ))}
        </div>

        {gathering.items.length === 0 && (
          <div className="text-sm text-muted-foreground">У цьому служінні ще нічого немає.</div>
        )}
      </StaticSongProvider>
    </SongModeProvider>
  );
}
