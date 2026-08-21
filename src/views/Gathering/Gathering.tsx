import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { formatDate } from "#utils/utils";
import { DEFAULT_LIST_TITLE } from "#constants/app";
import { useBand } from "#modules/Band/BandLayout";
import { hostStateFor, needleFor, routeFor } from "#modules/Band/audio/hostView";
import { gatheringTarget } from "#modules/Band/audio/types";
import { useAudioHostStatus } from "#modules/Band/audio/useBandAudio";
import { ToPageBar } from "#layout/PageBar/ToPageBar";
import { SongModeProvider, StaticSongProvider } from "#modules/SingleSong/mode";
import { buildGathering } from "#modules/Gathering/buildGathering";
import { useGatheringStart, type StartOutcome } from "#modules/Gathering/useGatheringStart";
import { silenceReason, type SilenceReason } from "#modules/Gathering/silenceReason";
import { fetchGathering, type GatheringList } from "#modules/Gathering/gatheringSource";
import { GatheringControls } from "#modules/Gathering/GatheringControls";
import { GatheringItemView } from "#modules/Gathering/GatheringItemView";
import { GatheringScrollControls } from "#modules/Gathering/GatheringScrollControls";
import { useNeedleScroll } from "#modules/Gathering/useNeedleScroll";
import ChordsProgressionPlayer from "#modules/SingleSong/services/ChordsProgressionPlayer/ChordsProgressionPlayer";
import { unprefixTokenKey } from "#modules/SingleSong/services/ChordsProgressionPlayer/segments/model";

/**
 * Скільки чекати на хоста, перш ніж сказати, що він не озвався.
 *
 * Це не «скільки він вантажиться»: щойно хост узявся за роботу, він публікує
 * в кімнату `loading`, і питання знімається саме тим. Це час на дорогу туди й
 * назад — команда awareness-ом і статус у відповідь. Менше — і напис блимав би
 * на кожному повільному з'єднанні; більше — і людина встигла б натиснути ще
 * тричі, не розуміючи, чому тихо.
 */
const HOST_ANSWER_MS = 5000;

/** Пояснення тиші — по одному на причину (`silenceReason`, `PLAY-30`). */
const SILENCE_TEXT: Record<SilenceReason, string> = {
  startFailed: "Звук не піднявся на цьому пристрої. Торкнись екрана й спробуй ще раз.",
  empty: "У цьому служінні нема чого грати: жоден пункт не звучить.",
  hostSilent: "Хост звуку не підхопив служіння — звук не пішов. Спробуй ще раз.",
};

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
  const target = useMemo(() => gatheringTarget(listId!), [listId]);
  // Куди йде звук цього служіння — одне правило на весь застосунок
  // (`routeFor`): хоста немає (офлайн, не озброєний, не призначений) — граю
  // тут; хост живий — командую ним; а те, що ВЖЕ грає тут, лишається тут до
  // самої зупинки (`LIST-46`).
  const route = routeFor({ localState, status: hostStatus });
  // Стан того пристрою, який грає МОЄ служіння, — свій або хостовий. Тим самим
  // питанням живуть і кнопки в барі, і напис про тишу нижче.
  const state = route === "host" ? hostStateFor(hostStatus, target) : localState;

  // ─── ЧОМУ ТИХО ───────────────────────────────────────────────────────────
  // Натиснули «грати» — і нічого. Три причини, і жодна з них сама себе не
  // показує: локальний запуск падає в консоль, хост мовчить у своїй кімнаті, а
  // служіння без звучних пунктів просто гасить кнопку. Тому екран збирає їх
  // докупи й каже вголос (`PLAY-30`).
  const [startFailed, setStartFailed] = useState(false);
  const [askedHostAt, setAskedHostAt] = useState<number | null>(null);
  const [hostLate, setHostLate] = useState(false);

  const handleStartOutcome = useCallback((outcome: StartOutcome) => {
    setStartFailed(outcome === "local-failed");
    setAskedHostAt(outcome === "asked-host" ? Date.now() : null);
  }, []);

  // Годинник ставиться на КОЖЕН натиск (звідси `askedHostAt`, а не прапорець):
  // натиснули вдруге — чекаємо знову з нуля, а не досиджуємо чужий відлік.
  useEffect(() => {
    setHostLate(false);
    if (askedHostAt == null) return;
    const timer = setTimeout(() => setHostLate(true), HOST_ANSWER_MS);
    return () => clearTimeout(timer);
  }, [askedHostAt]);

  // Звук ПІШОВ — усі пояснення протухли разом. Інакше «не вдалося» вилізло б
  // знову після наступної зупинки, уже ні про що.
  //
  // ⚠️ «Пішов» — це `playing`/`paused`, а НЕ `loading`: хост публікує
  // «завантажую» одразу на команду, ще нічого не прочитавши. Зарахуй ми це за
  // відповідь — і хост, який упав на завантаженні (не знайшов пункт, не
  // доїхав запит), забирав би з собою й питання, і саме воно й лишилось би
  // без відповіді: тиша під написом «грати». Поки він вантажиться, напису
  // однаково немає — це `sounding` у `silenceReason`.
  useEffect(() => {
    if (state !== "playing" && state !== "paused") return;
    setAskedHostAt(null);
    setStartFailed(false);
  }, [state]);

  // Тап по акорду веде тією самою дорогою, що й кнопка «грати», — різна лише
  // адреса (`useGatheringStart`). Функція стабільна, тож `memo` на пунктах
  // лишається живим.
  const startFrom = useGatheringStart({
    listId: listId!,
    gathering,
    route,
    onOutcome: handleStartOutcome,
  });

  const reason = silenceReason({
    state,
    itemCount: gathering.items.length,
    segmentCount: gathering.segments.length,
    startFailed,
    hostLate,
  });

  const currentTokenKey = needleFor({
    localState,
    localTokenKey,
    status: hostStatus,
    target,
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
        onPlayFrom={startFrom}
      />
    ),
    [list?.date, gathering, listId, hostDesignated, startFrom],
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

        {reason && (
          // Поруч із кнопками внизу, а не вгорі екрана: посеред служіння екран
          // прокручений до третьої пісні, і напис під датою ніхто б не побачив
          // — а тиша чутна саме там, де стоїш.
          <div
            role="status"
            className={`glass fixed left-2 z-30 max-w-[70vw] rounded-2xl px-3 py-2 text-xs ${
              reason === "empty" ? "text-muted-foreground" : "text-destructive"
            }`}
            style={{ bottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
          >
            {SILENCE_TEXT[reason]}
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
