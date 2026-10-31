/**
 * Те, що пісня робить на сторінці в будь-якому форматі (редактор чи смуга):
 * лагодить слоти доріжок, віддає себе меню поза піснею й дрону.
 */
import { useEffect } from "react";
import DronePlayer from "#modules/SingleSong/services/DronePlayer/DronePlayer";
import type { SongKeyValue } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/model";
import { readMeta, Song } from "../model";
import { setActiveSong } from "./activeSong";
import { setDynamicsPanel } from "./dynamics/panel";
import { useHealSlots } from "./useHealSlots";

export function useSongSession(song: Song) {
  useHealSlots(song);

  // Пісня — для меню поза редактором; панель динаміки нової пісні — закрита.
  useEffect(() => {
    setActiveSong(song);
    return () => {
      setActiveSong(null);
      setDynamicsPanel(false);
    };
  }, [song]);

  // Дрон грає ЦЮ пісню: тональність і темп — з документа на кожне «увімкнути».
  useEffect(() => {
    const player = DronePlayer.getInstance();
    player.setSource(() => {
      const m = readMeta(song.doc);
      const [num, den] = m.timeSignature.split("/").map(Number);
      return { name: m.name || null, bpm: m.bpm, timeSignature: [num || 4, den || 4], key: m.key as SongKeyValue };
    });
    return () => player.setSource(null);
  }, [song]);
}
