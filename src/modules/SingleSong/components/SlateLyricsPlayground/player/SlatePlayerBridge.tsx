import {useEffect, useMemo, useState} from "react";
import type {ReactNode} from "react";
import type {Descendant, Editor} from "slate";

import ChordsProgressionPlayer from "../../../services/ChordsProgressionPlayer/ChordsProgressionPlayer";
import {extractHeader} from "../../../services/ChordsProgressionPlayer/extractHeader";
import {PlayerHighlightContext, toggleStartChord} from "./PlayerHighlightContext";
import {needleFor} from "#modules/Band/audio/hostView";
import {songTarget} from "#modules/Band/audio/types";
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
  const currentTokenKey = needleFor({
    localState: localPlayerState,
    localTokenKey,
    status: hostStatus,
    target: songId == null ? null : songTarget(songId),
  });

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
    // Тап тут ПОЗНАЧАЄ акорд, а не запускає: на сторінці пісні між вибором і
    // звуком стоїть кнопка (`PLAY-14`). У зібранні те саме місце значить інше
    // — див. `GatheringItemView`.
    () => ({currentTokenKey, selectedTokenKey, onChordTap: toggleStartChord}),
    [currentTokenKey, selectedTokenKey],
  );

  return (
    <PlayerHighlightContext.Provider value={value}>
      {children}
    </PlayerHighlightContext.Provider>
  );
};
