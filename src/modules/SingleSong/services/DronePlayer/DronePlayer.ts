import * as Tone from "tone";

import {keys} from "#utils/keyUtils";
import type {SongHeader} from "../songChords/extractHeader";
import {DEFAULT_BPM} from "../songChords/songDefaults";
import {startDrone, stopDrone} from "./drone";
import {startMetronome, type Metronome} from "./metronome";

export type DroneState = "idle" | "loading" | "playing";

type StateListener = (state: DroneState) => void;
/** Шапка відкритої пісні: з неї дрон бере тональність, метроном — темп. */
type SongSource = () => SongHeader | null;

/** `keys` починаються з `A`, тож `A` — клас висоти 9. */
const pitchClassOf = (key: SongHeader["key"]): number =>
  (9 + Math.max(0, keys.indexOf(key))) % 12;

const sanitizeBpm = (bpm: number): number =>
  Number.isFinite(bpm) && bpm > 0 ? bpm : DEFAULT_BPM;

/**
 * Звук пісні: дрон у тональності (лівий канал) плюс метроном (правий).
 *
 * Його **вмикають і вимикають**, а не грають від початку до кінця: скільки
 * звучати, вирішує гурт, а не запис пісні (ADR-0003). Тому немає ні паузи, ні
 * кінця пісні, ні позиції в ній — лише «звучить» і «ні».
 *
 * Звук **переживає вихід із пісні** (`PLAY-49`): між піснями дрон тримає
 * тональність, доки його не ввімкнуть на наступній, — тоді старий згасає, а
 * новий набирає гучність одночасно (`startDrone`).
 *
 * Синглтон, бо кнопки й хост живуть у різних місцях дерева, а звук один.
 */
class DronePlayer {
  static instance: DronePlayer;

  private state: DroneState = "idle";
  private listeners = new Set<StateListener>();
  private source: SongSource | null = null;
  private metronome: Metronome | null = null;
  /** Чия пісня звучить — щоб кнопка іншої пісні не вдавала, що це її звук. */
  private songId: string | null = null;
  /**
   * Покоління запуску. Між «увімкнути» і звуком стоїть `Tone.start()`, і за цей
   * час людина встигає вимкнути або піти зі сторінки: запуск, що доїхав після
   * цього, не має воскрешати звук.
   */
  private generation = 0;

  static getInstance = () => {
    DronePlayer.instance ??= new DronePlayer();
    return DronePlayer.instance;
  };

  getState() {
    return this.state;
  }

  /** Чи звучить (або піднімається) саме ця пісня. */
  isSounding(songId: string | number) {
    return this.state !== "idle" && this.songId === String(songId);
  }

  onStateChange(listener: StateListener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Звідки брати пісню для НАСТУПНОГО вмикання. Зняти джерело — не вимкнути:
   * те, що звучить, грає далі (`PLAY-49`).
   */
  setSource(source: SongSource | null) {
    this.source = source;
  }

  play = async (songId: string | number) => {
    const song = this.source?.();
    if (!song) return;

    const generation = ++this.generation;
    this.songId = String(songId);
    this.setState("loading");
    try {
      await Tone.start();
    } catch (error) {
      if (generation === this.generation) this.setState("idle");
      throw error;
    }
    if (generation !== this.generation) return;

    this.metronome?.stop();
    this.metronome = startMetronome(sanitizeBpm(song.bpm));
    startDrone(pitchClassOf(song.key));
    this.setState("playing");
  };

  /** Клік стихає одразу, дрон згасає (`DRONE_FADE_SECONDS`). */
  stop = () => {
    this.generation += 1;
    if (this.state === "idle") return;
    this.metronome?.stop();
    this.metronome = null;
    this.songId = null;
    stopDrone();
    this.setState("idle");
  };

  private setState(state: DroneState) {
    if (this.state === state) return;
    this.state = state;
    this.listeners.forEach((listener) => listener(state));
  }
}

export default DronePlayer;
