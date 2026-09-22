import { PlayIcon, StopIcon } from "@heroicons/react/24/outline";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import DronePlayer from "../../services/DronePlayer/DronePlayer";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useBand } from "#modules/Band/BandLayout";
import { AudioDestination } from "#modules/Band/audio/AudioDestination";
import BandAudioChannel from "#modules/Band/audio/bandAudioChannel";
import { hostStateFor, routeFor } from "#modules/Band/audio/hostView";
import { songTarget } from "#modules/Band/audio/types";
import { useAudioHostStatus } from "#modules/Band/audio/useBandAudio";
import { useCurrentUsername } from "../SlateLyricsPlayground/elements/hooks";
import { useSongId } from "../../redux/selectors";

/**
 * «Увімкнути / вимкнути дрон» — одна кнопка в рядку меню пісні (`PLAY-2`).
 * Паузи немає: дрон вмикають і вимикають, позиції в пісні в нього немає.
 */
export const PlaybackControls = () => {
  const player = useMemo(() => DronePlayer.getInstance(), []);
  const [localState, setLocalState] = useState(player.getState());

  const band = useBand();
  const username = useCurrentUsername();
  const songId = useSongId();
  const hostStatus = useAudioHostStatus();

  // Хост онлайн і озброєний → кнопка стає пультом: команди їдуть у
  // band-кімнату, звук грає планшет за пультом. Інакше — локально.
  // Правило одне на застосунок (`routeFor`): звук, що вже йде з цього
  // пристрою, лишається його — хост, який озброївся посеред пісні, забирає
  // НАСТУПНЕ вмикання, а не те, що звучить.
  const remoteActive = routeFor({ localState, status: hostStatus }) === "host";
  // Хост грає ІНШУ пісню → моя кнопка вимкнена; моє вмикання перехоплює
  // («останній перемагає»).
  const hostState = songId == null ? "idle" : hostStateFor(hostStatus, songTarget(songId));
  const state = remoteActive ? hostState : localState;

  const hostDesignated =
    (band as {audioHostUserId?: number | null}).audioHostUserId != null;

  useEffect(() => player.onStateChange(setLocalState), [player]);

  const sendCommand = useCallback(
    (action: "play" | "stop") => {
      // Пісні немає — командувати нема чим: хост відкриває документ саме по
      // цьому id.
      if (songId == null) return;
      BandAudioChannel.getInstance().sendCommand({
        action,
        target: songTarget(songId),
        issuedBy: username ?? null,
      });
    },
    [songId, username],
  );

  const isLoading = state === "loading";
  const isPlaying = state === "playing";

  const handleToggle = useCallback(() => {
    if (remoteActive) {
      sendCommand(isPlaying ? "stop" : "play");
      return;
    }
    if (isPlaying) {
      player.stop();
      return;
    }
    player.play().catch((error) => {
      console.error("Failed to start the drone", error);
    });
  }, [remoteActive, isPlaying, player, sendCommand]);

  return (
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
        onClick={handleToggle}
        disabled={isLoading}
        aria-label={isPlaying ? "Вимкнути дрон" : "Увімкнути дрон"}
        title={isPlaying ? "Вимкнути дрон" : "Увімкнути дрон"}
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : isPlaying ? (
          <StopIcon className="w-6 h-6" />
        ) : (
          <PlayIcon className="w-6 h-6" />
        )}
      </Button>
    </div>
  );
};
