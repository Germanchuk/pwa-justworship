import {
  PauseIcon,
  PlayIcon,
  StopIcon,
} from "@heroicons/react/24/outline";
import {MoreOptions} from "./MoreOptions/MoreOptions";
import {ModeSwitch} from "./ModeSwitch/ModeSwitch";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import ChordsProgressionPlayer from "../../services/ChordsProgressionPlayer/ChordsProgressionPlayer";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {ConnectionStatus} from "../ConnectionStatus/ConnectionStatus";
import {NotesAudienceSelect} from "../SlateLyricsPlayground/comments/NotesAudienceSelect";
import { useCanAnnotate, useCanPlay } from "../../mode";
import { useBandOrNull } from "#modules/Band/BandLayout";
import { AudioDestination } from "#modules/Band/audio/AudioDestination";
import BandAudioChannel from "#modules/Band/audio/bandAudioChannel";
import { hostStateFor, routeFor } from "#modules/Band/audio/hostView";
import { songTarget } from "#modules/Band/audio/types";
import { useAudioHostStatus } from "#modules/Band/audio/useBandAudio";
import { useCurrentUsername } from "../SlateLyricsPlayground/elements/hooks";
import { useSongId } from "../../redux/selectors";

export const SongControls = () => {
  // Програвання акордів — функція режиму читання.
  const canPlay = useCanPlay();
  // Вибір, чиї примітки я бачу, — функція режиму приміток. Кнопки програвання
  // й ця не перетинаються в часі, тож ділять те саме місце в панелі.
  const canAnnotate = useCanAnnotate();
  const player = useMemo(() => ChordsProgressionPlayer.getInstance(), []);
  const [localState, setLocalState] = useState(player.getState());

  const band = useBandOrNull();
  const username = useCurrentUsername();
  const songId = useSongId();
  const hostStatus = useAudioHostStatus();

  // Хост онлайн і озброєний → кнопки стають пультом: команди їдуть у
  // band-кімнату, звук грає планшет за пультом. Інакше — локально, як завжди.
  // Правило одне на застосунок (`routeFor`): звук, що вже йде з цього
  // пристрою, лишається його — хост, який озброївся посеред пісні, забирає
  // НАСТУПНИЙ запуск, а не той, що звучить.
  const remoteActive = routeFor({ localState, status: hostStatus }) === "host";
  // Хост грає ІНШУ пісню (або ціле служіння) → мої кнопки в idle; мій плей
  // перехоплює («останній перемагає»).
  const hostState = songId == null ? "idle" : hostStateFor(hostStatus, songTarget(songId));
  const hostOnMySong = remoteActive && hostState !== "idle";
  const playbackState = remoteActive ? hostState : localState;

  const hostDesignated =
    (band as {audioHostUserId?: number | null} | null)?.audioHostUserId != null;

  useEffect(() => player.onStateChange(setLocalState), [player]);

  // Вийшли з режиму читання — глушимо СВІЙ звук. Хоста не чіпаємо: він грає
  // для всього гурту, а не для цього екрана.
  useEffect(() => {
    if (!canPlay) player.stop();
  }, [canPlay, player]);

  const sendCommand = useCallback(
    (action: "play" | "pause" | "resume" | "stop") => {
      // Пісні немає — командувати нема чим: хост відкриває документ саме по
      // цьому id.
      if (songId == null) return;
      BandAudioChannel.getInstance().sendCommand({
        action,
        target: songTarget(songId, action === "play" ? player.getStartChordTokenKey() : null),
        issuedBy: username ?? null,
      });
    },
    [songId, player, username],
  );

  const handlePrimaryAction = useCallback(() => {
    if (remoteActive) {
      sendCommand(hostOnMySong && playbackState === "paused" ? "resume" : "play");
      return;
    }
    if (playbackState === "paused") {
      player.resume();
      return;
    }
    player.play().catch((error) => {
      console.error("Failed to start chord progression playback", error);
    });
  }, [remoteActive, hostOnMySong, playbackState, player, sendCommand]);

  const handlePause = useCallback(() => {
    if (remoteActive) {
      sendCommand("pause");
      return;
    }
    player.pause();
  }, [remoteActive, player, sendCommand]);

  const handleStop = useCallback(() => {
    if (remoteActive) {
      sendCommand("stop");
      return;
    }
    player.stop();
  }, [remoteActive, player, sendCommand]);

  const isLoading = playbackState === "loading";
  const isPlaying = playbackState === "playing";
  const isPaused = playbackState === "paused";

  return (
    <div className="w-full flex justify-between items-center gap-1">
      {/* Перемикач режимів і «три крапки» стоять праворуч завжди — це вхід у
          пісню, який не має їздити по панелі. Усе, що зʼявляється й зникає з
          режимом (плеєр, адресат приміток), тулиться ліворуч, тож жодна кнопка
          не міняє місця, коли сусідня зникла. */}
      <div className="flex gap-1 items-center min-w-0">
        {/* Стан звʼязку малюється рамкою самої панелі — місця не займає. */}
        <ConnectionStatus />
        {canPlay && (
          <div className="flex gap-1 items-center">
            {/* Куди йде звук: на хоста чи з цього пристрою (хост офлайн). */}
            <AudioDestination
              route={remoteActive ? "host" : "local"}
              status={hostStatus}
              hostDesignated={hostDesignated}
            />
            <Button
              variant="outline"
              size="icon"
              className="rounded-full border-dashed"
              onClick={isPlaying ? handlePause : handlePrimaryAction}
              disabled={isLoading}
              aria-label={isPlaying ? "Pause progression" : isPaused ? "Resume progression" : "Play progression"}
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isPlaying ? (
                <PauseIcon className="w-6 h-6" />
              ) : (
                <PlayIcon className="w-6 h-6" />
              )}
            </Button>
            {(isPlaying || isPaused) && (
              <Button
                variant="outline"
                size="icon"
                className="rounded-full border-dashed"
                onClick={handleStop}
                disabled={isLoading}
                aria-label="Stop progression"
              >
                <StopIcon className="w-6 h-6" />
              </Button>
            )}
          </div>
        )}
        {canAnnotate && <NotesAudienceSelect />}
      </div>

      <div className="flex gap-1 items-center shrink-0">
        <ModeSwitch />
        <MoreOptions />
      </div>
    </div>
  )
}
