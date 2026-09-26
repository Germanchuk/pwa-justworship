import React, { useCallback, useEffect, useMemo, useState } from "react";
import DronePlayer from "../../services/DronePlayer/DronePlayer";
import { Button } from "@/components/ui/button";
import { Loader2, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { AudioDestination } from "#modules/Band/audio/AudioDestination";
import BandAudioChannel from "#modules/Band/audio/bandAudioChannel";
import { hostStateFor, routeFor } from "#modules/Band/audio/hostView";
import { songTarget } from "#modules/Band/audio/types";
import { useAudioHostStatus } from "#modules/Band/audio/useBandAudio";
import { useCurrentUsername } from "../SlateLyricsPlayground/elements/hooks";
import { useSongId } from "../../redux/selectors";
import { MENU_TILE } from "./tile";

/**
 * «Увімкнути / вимкнути дрон» — окрема плитка під «⋯» у меню пісні (`PLAY-2`).
 * Паузи немає: дрон вмикають і вимикають, позиції в пісні в нього немає —
 * тому й кнопка виглядає як вимикач живлення, а не як «грати / стоп»:
 * увімкнена залита, вимкнена — скляна, як решта плиток.
 */
export const PlaybackControls = () => {
  const player = useMemo(() => DronePlayer.getInstance(), []);
  const [localState, setLocalState] = useState(player.getState());

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
  // Мій дрон ще тримає ПОПЕРЕДНЮ пісню (`PLAY-49`) → тут він «не мій»:
  // кнопка контурна, і натискання перемикає звук на цю пісню, а не вимикає.
  const mine = songId != null && player.isSounding(songId);
  const state = remoteActive ? hostState : mine ? localState : "idle";
  const otherSounding = !remoteActive && localState !== "idle" && !mine;

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
    if (songId == null) return;
    player.play(songId).catch((error) => {
      console.error("Failed to start the drone", error);
    });
  }, [remoteActive, isPlaying, player, sendCommand, songId]);

  return (
    <div className="flex items-center gap-2">
      {/* Звук піде на хоста — чий пристрій звучить на зал. */}
      <AudioDestination
        route={remoteActive ? "host" : "local"}
        status={hostStatus}
      />
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          MENU_TILE,
          isPlaying &&
            "border-primary bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:text-primary-foreground",
          otherSounding && "border-primary text-primary",
        )}
        onClick={handleToggle}
        disabled={isLoading}
        aria-pressed={isPlaying}
        aria-label="Дрон"
        title={
          isPlaying
            ? "Вимкнути дрон"
            : otherSounding
              ? "Перемкнути дрон на цю пісню"
              : "Увімкнути дрон"
        }
      >
        {isLoading ? (
          <Loader2 className="size-6 animate-spin" />
        ) : (
          <Power className="size-6" strokeWidth={2.25} />
        )}
      </Button>
    </div>
  );
};
