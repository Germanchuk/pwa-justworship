import {useEffect, useMemo, useState, useSyncExternalStore} from "react";
import {useSelector} from "react-redux";
import {SpeakerWaveIcon, StopIcon} from "@heroicons/react/24/outline";

import {useBand} from "#modules/Band/BandLayout";
import AudioHostEngine, {
  type AudioHostEngineState,
} from "#modules/Band/audio/audioHostEngine";
import BandAudioChannel from "#modules/Band/audio/bandAudioChannel";
import {useAudioHostStatus} from "#modules/Band/audio/useBandAudio";
import {
  getMetronomeTrim,
  isMetronomeMuted,
  METRONOME_TRIM_RANGE,
  setMetronomeTrim,
  subscribeMetronomeTrim,
} from "#modules/SingleSong/services/DronePlayer/metronomeTrim";
import {padTrim} from "#modules/SingleSong/services/DronePlayer/padTrim";
import {Button} from "@/components/ui/button";
import {Slider} from "@/components/ui/slider";

const STATE_LABELS: Record<AudioHostEngineState["state"], string> = {
  idle: "Тиша — чекаю команду",
  // Назва пісні, що піднімається, стоїть рядком нижче.
  loading: "Завантажую…",
  playing: "Грає",
};

const useMetronomeTrim = () =>
  useSyncExternalStore(subscribeMetronomeTrim, getMetronomeTrim);
const usePadTrim = () => useSyncExternalStore(padTrim.subscribe, padTrim.get);

const formatTrim = (trim: number, muted: boolean): string => {
  if (muted) return "Вимк.";
  return `${trim > 0 ? "+" : ""}${trim} дБ`;
};

/** Жива ручка пульта: діє одразу й не зберігається (`liveTrim`). */
const TrimSlider = ({
  label,
  value,
  range,
  muted,
  onChange,
}: {
  label: string;
  value: number;
  range: [number, number];
  muted: boolean;
  onChange: (value: number) => void;
}) => (
  <div className="w-full max-w-sm text-left">
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm font-semibold text-stone-800">{label}</span>
      <span className="text-xs font-semibold text-stone-600 tabular-nums">
        {formatTrim(value, muted)}
      </span>
    </div>
    <Slider
      min={range[0]}
      max={range[1]}
      step={1}
      value={[value]}
      onValueChange={([next]) => onChange(next)}
      aria-label={`Гучність: ${label.toLowerCase()}`}
      className="mt-2"
    />
  </div>
);

/**
 * Режим хоста звуку: цю сторінку відкривають на пристрої за пультом.
 * Поки вона відкрита й звук «озброєно» — будь-чий плей у гурті звучить звідси.
 */
export default function AudioHost() {
  const band = useBand();
  const me = useSelector(
    (state: {user?: {id?: number; username?: string}}) => state.user,
  );

  const engine = useMemo(() => AudioHostEngine.getInstance(), []);
  const [engineState, setEngineState] = useState<AudioHostEngineState>(engine.getState());
  const metronomeTrim = useMetronomeTrim();
  const padTrimValue = usePadTrim();

  // Дубль-сесія: той самий акаунт уже веде звук з іншого пристрою.
  const hostStatus = useAudioHostStatus();
  const [duplicateHosts, setDuplicateHosts] = useState(false);

  useEffect(() => {
    engine.start({userId: me?.id ?? null, username: me?.username ?? null});
    return () => {
      engine.stop();
    };
  }, [engine, me?.id, me?.username]);

  useEffect(() => engine.onState(setEngineState), [engine]);

  useEffect(() => {
    setDuplicateHosts(BandAudioChannel.getInstance().countPublishingHosts() > 1);
  }, [hostStatus]);

  // Екран хоста не має засинати посеред служіння. Best-effort: не всі
  // браузери вміють Wake Lock, відмова — не привід падати.
  useEffect(() => {
    let lock: {release: () => Promise<void>} | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const wakeLock = (navigator as Navigator & {
          wakeLock?: {request: (type: "screen") => Promise<{release: () => Promise<void>}>};
        }).wakeLock;
        if (!wakeLock) return;
        const acquired = await wakeLock.request("screen");
        if (cancelled) {
          void acquired.release();
        } else {
          lock = acquired;
        }
      } catch {
        // відмовили — ну і гаразд
      }
    };

    void request();
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, []);

  const isDesignatedHost =
    (band as {audioHostUserId?: number | null}).audioHostUserId != null &&
    Number((band as {audioHostUserId?: number | null}).audioHostUserId) === Number(me?.id);

  return (
    <>

      <div className="mt-6 flex flex-col items-center gap-5 text-center">
        {!isDesignatedHost && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 m-0">
            Цей акаунт не призначений хостом звуку в складі гурту. Команди він
            однаково прийматиме, але переконайся, що це той пристрій.
          </p>
        )}
        {duplicateHosts && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 m-0">
            Схоже, режим хоста вже відкритий на іншому пристрої — буде подвійний
            звук. Закрий один із них.
          </p>
        )}

        {!engineState.armed ? (
          <>
            <p className="text-sm text-stone-500 max-w-sm m-0">
              Браузер вмикає звук лише після дотику. Натисни — і цей пристрій
              почне грати все, що гурт запускає зі своїх телефонів.
            </p>
            <Button size="lg" className="gap-2 px-8 py-6 text-base" onClick={() => void engine.arm()}>
              <SpeakerWaveIcon className="size-6" />
              Озброїти звук
            </Button>
          </>
        ) : (
          <>
            <div
              className={`flex size-28 items-center justify-center rounded-full border-4 ${
                engineState.state === "playing"
                  ? "border-blue-900 text-blue-900 animate-pulse"
                  : "border-stone-300 text-stone-400"
              }`}
            >
              <SpeakerWaveIcon className="size-12" />
            </div>

            <div>
              <div className="text-lg font-bold text-stone-800">
                {STATE_LABELS[engineState.state]}
              </div>
              {engineState.playingName && (
                <div className="text-sm text-stone-500 mt-1">
                  {engineState.playingName}
                  {engineState.controlledBy && ` — керує ${engineState.controlledBy}`}
                </div>
              )}
            </div>

            {engineState.state === "playing" && (
              <Button variant="outline" className="gap-2" onClick={() => engine.stopPlayback()}>
                <StopIcon className="size-5" />
                Зупинити
              </Button>
            )}

            {/* Ручки пульта: пед у лівому каналі, клік у правому (`PLAY-43`). */}
            <TrimSlider
              label="Пед"
              value={padTrimValue}
              range={padTrim.range}
              muted={padTrim.isMuted(padTrimValue)}
              onChange={padTrim.set}
            />
            <TrimSlider
              label="Метроном"
              value={metronomeTrim}
              range={METRONOME_TRIM_RANGE}
              muted={isMetronomeMuted(metronomeTrim)}
              onChange={setMetronomeTrim}
            />
            <p className="text-xs text-stone-400 max-w-sm m-0 -mt-3">
              Чутно одразу. Не зберігається — після перезавантаження знову 0 дБ.
            </p>

            <p className="text-xs text-stone-400 max-w-sm m-0">
              Не закривай цю сторінку і не блокуй екран: звук іде з цього
              пристрою.
            </p>
          </>
        )}
      </div>
    </>
  );
}
