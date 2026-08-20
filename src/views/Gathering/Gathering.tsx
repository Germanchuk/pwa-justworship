import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { Descendant } from "slate";

import { fetchAPI } from "#utils/fetch-api";
import { formatDate } from "#utils/utils";
import { DEFAULT_LIST_TITLE } from "#constants/app";
import { useBand } from "#modules/Band/BandLayout";
import { ToPageBar } from "#layout/PageBar/ToPageBar";
import { SongModeProvider, StaticSongProvider } from "#modules/SingleSong/mode";
import { StaticSong } from "#modules/SingleSong/components/StaticSong/StaticSong";
import { fromApi } from "#models/listPoint";
import { buildGathering, type GatheringPoint } from "#modules/Gathering/buildGathering";

/**
 * РЕЖИМ ЗІБРАННЯ — усе служіння одним екраном.
 *
 * Задача: не заходити в кожну пісню окремо. Гурт стоїть на сцені, порядок уже
 * складений, і між піснями має бути не повернення до списку, а просто дотик
 * пальцем униз.
 *
 * ─── ТРИ СВІДОМІ «НІ» ──────────────────────────────────────────────────────
 *   не редагується   — тут грають, а не правлять;
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
 * ─── ЩО ПОКАЗУЄ, А ЧОГО ЩЕ НЕ РОБИТЬ ───────────────────────────────────────
 * Ряд елементів рахує `buildGathering` — він же збирає чергу сегментів і
 * відповідність токенів. Тут поки використана лише перша з трьох: програш
 * ВИДНО (згенерований документ поруч із піснями), але ще не чутно. Плеєр —
 * наступні тікети.
 */

/**
 * `fromApi` дає чистий union, але вміст пісні (`slate`) живе поруч із пунктом —
 * зшиваємо по id пісні, а НЕ по індексу: межа відсіює пункти (пісня без пісні,
 * порожня примітка), тож порядки двох рядів не збігаються, і зсув на один тихо
 * підклав би не той документ.
 */
const pointsOf = (list: any): GatheringPoint[] => {
  const rawPoints: any[] = Array.isArray(list?.points) ? list.points : [];
  const slateBySongId = new Map<string, Descendant[] | null | undefined>(
    rawPoints
      .filter((raw) => raw?.__component === "list.song-point" && raw?.song?.id != null)
      .map((raw) => [String(raw.song.id), raw.slate])
  );
  return fromApi(rawPoints).map((point) =>
    point.kind === "song" ? { ...point, slate: slateBySongId.get(String(point.songId)) } : point
  ) as GatheringPoint[];
};

export default function Gathering() {
  const { listId } = useParams();
  const band = useBand();
  const [list, setList] = useState<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAPI(`/bands/${band.id}/lists/${listId}/gathering`)
      .then((data) => {
        if (!cancelled) setList(data?.data ?? null);
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
  const { items } = useMemo(() => buildGathering(pointsOf(list)), [list]);

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
          <div className="text-base font-semibold leading-tight">
            {formatDate(list.date)}
          </div>
          <div className="text-sm text-muted-foreground">
            {list.title?.trim() || DEFAULT_LIST_TITLE}
          </div>
        </div>

        <div className="flex flex-col">
          {items.map((item) => (
            <section
              key={item.key}
              className="border-t border-dashed border-border/70 py-4 first:border-t-0 first:pt-0"
            >
              {item.kind === "song" && (
                <>
                  {/* Номер над піснею: єдина навігаційна підказка на екрані,
                      де гортають пальцем. На репетиції домовляються саме
                      номерами. */}
                  <div className="mb-1 text-sm font-semibold text-muted-foreground">
                    {item.number}
                  </div>
                  <StaticSong docId={item.point.songId} slate={item.nodes} />
                </>
              )}

              {/* Програш — такий самий документ, як пісня: акорди, згенеровані
                  зі стику сусідів, під текстом примітки. Свого вмісту він не
                  має й мати не може (`LIST-26`). */}
              {item.kind === "sounding" && <StaticSong docId={item.key} slate={item.nodes} />}

              {/* Примітка без програша — просто рядок: тут говорить ведучий. */}
              {item.kind === "note" && (
                <p className="rounded-lg bg-muted/60 px-3 py-2 text-base text-foreground/80">
                  {item.text}
                </p>
              )}
            </section>
          ))}
        </div>

        {items.length === 0 && (
          <div className="text-sm text-muted-foreground">
            У цьому служінні ще нічого немає.
          </div>
        )}
      </StaticSongProvider>
    </SongModeProvider>
  );
}
