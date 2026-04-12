import {CopyButton} from "./CopyButton/CopyButton";
import {SwitchEdit} from "./SwitchEdit/SwitchEdit";
import {
  PauseIcon,
  PlayIcon,
  StopIcon,
} from "@heroicons/react/24/outline";
import {MoreOptions} from "./MoreOptions/MoreOptions";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import ChordsProgressionPlayer from "../../services/ChordsProgressionPlayer/ChordsProgressionPlayer";

export const SongControls = ({
  isReadonly,
  songId
}) => {
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
    <div className="w-full flex justify-between">
      <div />
      <div className="flex gap-1 items-center">
        <div className="flex gap-1">
          <button
            className="btn btn-circle btn-dash"
            onClick={isPlaying ? handlePause : handlePrimaryAction}
            disabled={isLoading}
            aria-label={isPlaying ? "Pause progression" : isPaused ? "Resume progression" : "Play progression"}
          >
            {isLoading ? (
              <span className="loading loading-spinner" />
            ) : isPlaying ? (
              <PauseIcon className="w-6 h-6" />
            ) : (
              <PlayIcon className="w-6 h-6" />
            )}
          </button>
          {(isPlaying || isPaused) && (
            <button
              className="btn btn-circle btn-dash"
              onClick={handleStop}
              disabled={isLoading}
              aria-label="Stop progression"
            >
              <StopIcon className="w-6 h-6" />
            </button>
          )}
        </div>
        {
          isReadonly
            ? <CopyButton songId={songId} />
            : <SwitchEdit />
        }
        <MoreOptions />
      </div>
    </div>
  )
}
