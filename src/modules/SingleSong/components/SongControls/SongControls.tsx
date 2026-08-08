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

export const SongControls = () => {
  // Програвання акордів — функція режиму читання.
  const canPlay = useCanPlay();
  // Вибір, чиї примітки я бачу, — функція режиму приміток. Кнопки програвання
  // й ця не перетинаються в часі, тож ділять те саме місце в панелі.
  const canAnnotate = useCanAnnotate();
  const player = useMemo(() => ChordsProgressionPlayer.getInstance(), []);
  const [playbackState, setPlaybackState] = useState(player.getState());

  useEffect(() => player.onStateChange(setPlaybackState), [player]);

  // Вийшли з режиму читання — глушимо звук: керувати ним звідти вже нічим.
  useEffect(() => {
    if (!canPlay) player.stop();
  }, [canPlay, player]);

  const handlePrimaryAction = useCallback(() => {
    if (playbackState === "paused") {
      player.resume();
      return;
    }
    player.play().catch((error) => {
      console.error("Failed to start chord progression playback", error);
    });
  }, [player, playbackState]);

  const handlePause = useCallback(() => {
    player.pause();
  }, [player]);

  const handleStop = useCallback(() => {
    player.stop();
  }, [player]);

  const isLoading = playbackState === "loading";
  const isPlaying = playbackState === "playing";
  const isPaused = playbackState === "paused";

  return (
    <div className="w-full flex justify-between items-center gap-1">
      <ConnectionStatus />
      <div className="flex gap-1 items-center">
        {canPlay && (
          <div className="flex gap-1">
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
        <ModeSwitch />
        <MoreOptions />
      </div>
    </div>
  )
}
