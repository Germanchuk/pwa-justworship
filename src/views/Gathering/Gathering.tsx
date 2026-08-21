import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { Descendant } from "slate";

import { fetchAPI } from "#utils/fetch-api";
import { formatDate } from "#utils/utils";
import { DEFAULT_LIST_TITLE } from "#constants/app";
import { useBand } from "#modules/Band/BandLayout";
import { ToPageBar } from "#layout/PageBar/ToPageBar";
import { SongModeProvider, StaticSongProvider } from "#modules/SingleSong/mode";
import { fromApi } from "#models/listPoint";
import { buildGathering, type GatheringPoint } from "#modules/Gathering/buildGathering";
import { GatheringControls } from "#modules/Gathering/GatheringControls";
import { GatheringItemView } from "#modules/Gathering/GatheringItemView";
import ChordsProgressionPlayer from "#modules/SingleSong/services/ChordsProgressionPlayer/ChordsProgressionPlayer";
import { unprefixTokenKey } from "#modules/SingleSong/services/ChordsProgressionPlayer/segments/model";

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
 * ─── ЩО ПОКАЗУЄ Й ЩО ГРАЄ ──────────────────────────────────────────────────
 * Ряд елементів, чергу сегментів і відповідність токенів рахує один
 * `buildGathering`. Черга віддається плеєру ОДНИМ шматком, тож служіння
 * звучить наскрізь: пісні йдуть атакою, а голка з плеєра розходиться по
 * пунктах — кожен упізнає лише свої токени (`GatheringItemView`).
 *
 * ─── ЧОГО ЩЕ НЕМА ──────────────────────────────────────────────────────────
 * Звук грає з ЦЬОГО пристрою: хоста й спільної на весь гурт голки ще немає
 * (тікет `05`), «продовжити» — теж (`06`). Наслідок видно одразу: примітка
 * проминається, а програш крутить луп до самого «зупинити» — тобто наскрізь
 * служіння проходить лише до першого програша. Див. `GatheringControls`.
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
  const { items, segments } = useMemo(() => buildGathering(pointsOf(list)), [list]);

  const player = useMemo(() => ChordsProgressionPlayer.getInstance(), []);
  // Голка приходить з плеєра ЦІЛОЮ — з префіксом пункту попереду; розводить її
  // по пунктах `unprefixTokenKey` нижче (причина — там же).
  const [currentTokenKey, setCurrentTokenKey] = useState<string | null>(null);
  useEffect(
    () => player.onChordChange((event) => setCurrentTokenKey(event?.tokenKey ?? null)),
    [player],
  );

  // Вийшли зі служіння — глушимо СВІЙ звук: далі його ніхто не спинить, бо
  // екрана з кнопками вже немає.
  useEffect(() => () => player.stop(), [player]);

  // Бар живе вище роутів і не має смикатись від руху голки: елемент лишається
  // тим самим об'єктом, поки не змінилась сама черга (див. `usePageBarContent`).
  const controls = useMemo(
    () => <GatheringControls title={formatDate(list?.date)} segments={segments} />,
    [list?.date, segments],
  );

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
        <ToPageBar>{controls}</ToPageBar>

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
            <GatheringItemView
              key={item.key}
              item={item}
              tokenKey={unprefixTokenKey(currentTokenKey, item.tokenKeyPrefix)}
            />
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
