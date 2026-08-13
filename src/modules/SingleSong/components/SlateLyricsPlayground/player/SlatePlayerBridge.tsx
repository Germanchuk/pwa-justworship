import {useEffect, useMemo, useState} from "react";
import type {ReactNode} from "react";
import type {Descendant, Editor} from "slate";

import ChordsProgressionPlayer from "../../../services/ChordsProgressionPlayer/ChordsProgressionPlayer";
import {extractHeader} from "../../../services/ChordsProgressionPlayer/extractHeader";
import {PlayerHighlightContext} from "./PlayerHighlightContext";
import {useAudioHostStatus} from "#modules/Band/audio/useBandAudio";
import {useSongId} from "../../../redux/selectors";

interface Props {
  editor: Editor;
  children: ReactNode;
}

export const SlatePlayerBridge = ({editor, children}: Props) => {
  const player = useMemo(() => ChordsProgressionPlayer.getInstance(), []);

  const [localTokenKey, setLocalTokenKey] = useState<string | null>(null);
  const [localPlayerState, setLocalPlayerState] = useState(player.getState());
  const [selectedTokenKey, setSelectedTokenKey] = useState<string | null>(
    player.getStartChordTokenKey(),
  );

  // Підсвітка від хоста звуку: коли він грає ЦЮ пісню, весь гурт бачить
  // поточний акорд. Локальне програвання (фолбек) має пріоритет.
  const hostStatus = useAudioHostStatus();
  const songId = useSongId();
  const remoteTokenKey =
    hostStatus?.armed &&
    hostStatus.songId != null &&
    String(hostStatus.songId) === String(songId)
      ? hostStatus.currentTokenKey
      : null;
  const currentTokenKey = localPlayerState !== "idle" ? localTokenKey : remoteTokenKey;

  useEffect(() => {
    // Капо свідомо НЕ впливає на звук (рішення 2026-08-09): воно змінює лише
    // відображення акордів. Плеєр завжди грає пісню як записано.
    const provider = () => {
      const nodes = editor.children as Descendant[];
      const {bpm, timeSignature} = extractHeader(nodes);
      return {nodes, bpm, timeSignature};
    };
    player.setContentProvider(provider);
    return () => {
      player.setContentProvider(null);
    };
  }, [editor, player]);

  useEffect(
    () =>
      player.onChordChange((event) => {
        setLocalTokenKey(event?.tokenKey ?? null);
      }),
    [player],
  );

  useEffect(() => player.onStateChange(setLocalPlayerState), [player]);

  useEffect(
    () => player.onSelectedChordKeyChange((key) => setSelectedTokenKey(key)),
    [player],
  );

  const value = useMemo(
    () => ({currentTokenKey, selectedTokenKey}),
    [currentTokenKey, selectedTokenKey],
  );

  return (
    <PlayerHighlightContext.Provider value={value}>
      {children}
    </PlayerHighlightContext.Provider>
  );
};
