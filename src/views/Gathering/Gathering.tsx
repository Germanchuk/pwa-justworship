import { useEffect, useMemo, useRef, useState } from "react";
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
import { useGatheringStart } from "#modules/Gathering/useGatheringStart";
import { fetchGathering, type GatheringList } from "#modules/Gathering/gatheringSource";
import { GatheringControls } from "#modules/Gathering/GatheringControls";
import { GatheringItemView } from "#modules/Gathering/GatheringItemView";
import { GatheringScrollControls } from "#modules/Gathering/GatheringScrollControls";
import { useNeedleScroll } from "#modules/Gathering/useNeedleScroll";
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
 * Зупиняється воно тільки на примітці — беззвучній або з програшем, — і далі
 * йде з «продовжити», яке тисне будь-хто з гурту (`LIST-37`, `LIST-41`).
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
 * ─── СТАРТ ІЗ БУДЬ-ЯКОГО АКОРДА ────────────────────────────────────────────
 * Тап по акорду означає «грай звідси й до кінця служіння» (`LIST-43`) — саме
 * служіння, а не ту пісню, у яку тицьнули: далі так само йдуть програші,
 * паузи й наступні пісні. Цим зібрання годиться і для генеральної репетиції,
 * і щоб влитись назад після перезавантаження посеред служіння.
 *
 * ─── ЕКРАН ЇДЕ САМ — ЯКЩО ПОПРОСИЛИ ────────────────────────────────────────
 * Автоскрол за замовчуванням ВИМКНЕНИЙ і вмикається кнопкою внизу
 * (`GatheringScrollControls`, `LIST-45`): частина гуртів гортає сама, і
 * непроханий рух екрана їм лише заважає. Дотик до екрана вимикає автоскрол на
 * місці, а кнопка «до голки» вертає й екран, і його (`autoScroll.ts`).
 *
 * Скрол лише СПОЖИВАЄ голку — ту саму, що підсвічує акорд, — і ніде не
 * питається транспорту (`useNeedleScroll`). Тому голка спільна, а поїздка
 * особиста: капо, фільтри, згорнуті секції й розмір телефона в кожного свої
 * (`LIST-44`).
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
  // Тап по акорду веде тією самою дорогою, що й кнопка «грати», — різна лише
  // адреса (`useGatheringStart`). Функція стабільна, тож `memo` на пунктах
  // лишається живим.
  const startFrom = useGatheringStart(listId!, gathering);
  const currentTokenKey = needleFor({
    localState,
    localTokenKey,
    status: hostStatus,
    target: gatheringTarget(listId!),
  });

  // Ряд пунктів — і межа пошуку для скролу: далі нього автоскролу нема чого
  // шукати, а картка з датою й бар його не стосуються.
  const itemsRef = useRef<HTMLDivElement>(null);
  const toNeedle = useNeedleScroll({ rootRef: itemsRef, needleKey: currentTokenKey });

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
        gathering={gathering}
        listId={listId!}
        hostDesignated={hostDesignated}
      />
    ),
    [list?.date, gathering, listId, hostDesignated],
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

        <div className="flex flex-col" ref={itemsRef}>
          {gathering.items.map((item) => (
            <GatheringItemView
              key={item.key}
              item={item}
              tokenKey={unprefixTokenKey(currentTokenKey, item.tokenKeyPrefix)}
              onPlayFrom={startFrom}
            />
          ))}
        </div>

        {gathering.items.length === 0 && (
          <div className="text-sm text-muted-foreground">
            У цьому служінні ще нічого немає.
          </div>
        )}

        <GatheringScrollControls
          hasNeedle={currentTokenKey != null}
          onToNeedle={toNeedle}
        />
      </StaticSongProvider>
    </SongModeProvider>
  );
}
