import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { formatDate } from "#utils/utils";
import { DEFAULT_LIST_TITLE } from "#constants/app";
import { useBand } from "#modules/Band/BandLayout";
import { needleFor } from "#modules/Band/audio/hostView";
import { gatheringTarget } from "#modules/Band/audio/types";
import { useAudioHostStatus } from "#modules/Band/audio/useBandAudio";
import { ToPageBar } from "#layout/PageBar/ToPageBar";
import { SongModeProvider, StaticSongProvider } from "#modules/SingleSong/mode";
import { buildGathering } from "#modules/Gathering/buildGathering";
import { fetchGathering, type GatheringList } from "#modules/Gathering/gatheringSource";
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
 * `buildGathering`. Служіння звучить наскрізь: пісні йдуть атакою, а голка
 * розходиться по пунктах — кожен упізнає лише свої токени
 * (`GatheringItemView`).
 *
 * ─── ЗВУК ІДЕ НА ХОСТА, А ГОЛКА — ДО ВСІХ ──────────────────────────────────
 * Кнопка «грати» відправляє команду в кімнату гурту, і служіння піднімає
 * планшет за пультом (`LIST-46`). Чергу хост збирає САМ — тим самим чистим
 * `buildGathering` і з того самого джерела, тож те, що видно, і те, що
 * звучить, збігаються (`LIST-35`; межі — в `audioHostEngine`). Назад приїжджає
 * лише голка, з ознакою пункту попереду (`PLAY-39`), і підсвічує в кожного
 * його власними акордами: капо й фільтри лишаються особистими (`LIST-44`).
 *
 * Без хоста все те саме грає звідси — сценарій «пройти план удома».
 *
 * ─── ЧОГО ЩЕ НЕМА ──────────────────────────────────────────────────────────
 * «Продовжити» — тікет `06`. Наслідок видно одразу: примітка проминається, а
 * програш крутить луп до самого «зупинити» — тобто наскрізь служіння проходить
 * лише до першого програша. Старт із акорда — `08`, автоскрол — `09`.
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
  const { items, segments } = useMemo(
    () => buildGathering(list?.points ?? []),
    [list],
  );

  const player = useMemo(() => ChordsProgressionPlayer.getInstance(), []);
  const [localState, setLocalState] = useState(player.getState());
  const [localTokenKey, setLocalTokenKey] = useState<string | null>(null);
  useEffect(
    () => player.onChordChange((event) => setLocalTokenKey(event?.tokenKey ?? null)),
    [player],
  );
  useEffect(() => player.onStateChange(setLocalState), [player]);

  // Голка приходить ЦІЛОЮ — з префіксом пункту попереду; чи вона своя, чи з
  // хоста, вирішує одне правило на весь застосунок (`needleFor`), а розводить
  // її по пунктах `unprefixTokenKey` нижче.
  const hostStatus = useAudioHostStatus();
  const currentTokenKey = needleFor({
    localState,
    localTokenKey,
    status: hostStatus,
    target: gatheringTarget(listId!),
  });

  // Вийшли зі служіння — глушимо СВІЙ звук: далі його ніхто не спинить, бо
  // екрана з кнопками вже немає. Хоста не чіпаємо: він грає для всього гурту.
  useEffect(() => () => player.stop(), [player]);

  const hostDesignated =
    (band as { audioHostUserId?: number | null }).audioHostUserId != null;

  // Бар живе вище роутів і не має смикатись від руху голки: елемент лишається
  // тим самим об'єктом, поки не змінилась сама черга (див. `usePageBarContent`).
  const controls = useMemo(
    () => (
      <GatheringControls
        title={formatDate(list?.date)}
        segments={segments}
        listId={listId!}
        hostDesignated={hostDesignated}
      />
    ),
    [list?.date, segments, listId, hostDesignated],
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
