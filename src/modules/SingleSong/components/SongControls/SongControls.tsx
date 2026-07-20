import {
  DocumentDuplicateIcon,
  EyeIcon,
  EyeSlashIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
} from "@heroicons/react/24/outline";
import {MoreOptions} from "./MoreOptions/MoreOptions";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import ChordsProgressionPlayer from "../../services/ChordsProgressionPlayer/ChordsProgressionPlayer";
import { Button } from "@/components/ui/button";
import { Loader2, Highlighter } from "lucide-react";
import {ConnectionStatus} from "../ConnectionStatus/ConnectionStatus";
import { useCarefulMode, useSetCarefulMode } from "../../redux/selectors";

export const SongControls = ({
  isReadonly,
  songId
}) => {
  const [chordsHidden, setChordsHidden] = useState(false);
  const carefulMode = useCarefulMode();
  const setCarefulMode = useSetCarefulMode();
  const player = useMemo(() => ChordsProgressionPlayer.getInstance(), []);
  const [playbackState, setPlaybackState] = useState(player.getState());

  useEffect(() => player.onStateChange(setPlaybackState), [player]);

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
    <div className="w-full flex justify-between items-center">
      <ConnectionStatus />
      <div className="flex gap-1 items-center">
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
        <Button
          variant="outline"
          size="icon"
          className="rounded-full border-dashed"
          onClick={() => {}}
          aria-label="Скопіювати"
        >
          <DocumentDuplicateIcon className="w-6 h-6" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full border-dashed"
          onClick={() => setChordsHidden((v) => !v)}
          aria-label={chordsHidden ? "Показати акорди" : "Сховати акорди"}
        >
          {chordsHidden ? <EyeIcon className="w-6 h-6" /> : <EyeSlashIcon className="w-6 h-6" />}
        </Button>
        <Button
          variant={carefulMode ? "default" : "outline"}
          size="icon"
          className="rounded-full border-dashed"
          onClick={() => setCarefulMode(!carefulMode)}
          aria-label={carefulMode ? "Вимкнути обережний режим" : "Увімкнути обережний режим"}
          aria-pressed={carefulMode}
          title={carefulMode ? "Обережний режим: ON" : "Обережний режим: OFF"}
        >
          <Highlighter className="w-5 h-5" />
        </Button>
        <MoreOptions />
      </div>
    </div>
  )
}
