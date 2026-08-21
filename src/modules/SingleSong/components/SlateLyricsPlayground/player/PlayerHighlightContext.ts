import {createContext} from "react";

import ChordsProgressionPlayer from "#modules/SingleSong/services/ChordsProgressionPlayer/ChordsProgressionPlayer";

export interface PlayerHighlightValue {
  currentTokenKey: string | null;
  selectedTokenKey: string | null;
  /**
   * Що означає тап по акорду в ЦЬОМУ документі.
   *
   * На сторінці пісні — «звідси почнеться наступне програвання» (`PLAY-14`):
   * акорд позначається й чекає кнопки. У зібранні — «грай звідси й до кінця
   * служіння» (`LIST-43`): тап запускає одразу, і запускає СЛУЖІННЯ, а не ту
   * пісню, у яку тицьнули.
   *
   * Тому це контекст, а не звернення до плеєра просто з рядка: акордовий
   * рядок не знає й не має знати, на якому з двох екранів його показують.
   */
  onChordTap: (tokenKey: string) => void;
}

/**
 * Тап на сторінці пісні: вибрати місце старту, повторний по тому самому —
 * зняти вибір (`PLAY-14`).
 */
export const toggleStartChord = (tokenKey: string) => {
  const player = ChordsProgressionPlayer.getInstance();
  player.setStartChordTokenKey(player.getStartChordTokenKey() === tokenKey ? null : tokenKey);
};

export const PlayerHighlightContext = createContext<PlayerHighlightValue>({
  currentTokenKey: null,
  selectedTokenKey: null,
  onChordTap: toggleStartChord,
});
