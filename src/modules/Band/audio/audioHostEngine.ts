import * as Tone from "tone";

import DronePlayer from "#modules/SingleSong/services/DronePlayer/DronePlayer";
import BandAudioChannel from "./bandAudioChannel";
import { openSongDoc, type SongDocHandle } from "./openSongDoc";
import type { AudioHostPlaybackState, PlaybackCommand, PlaybackTarget } from "./types";

export interface AudioHostEngineState {
  armed: boolean;
  state: AudioHostPlaybackState;
  /** Яка пісня зараз на хості. */
  playing: PlaybackTarget | null;
  playingName: string | null;
  controlledBy: string | null;
}

type EngineListener = (state: AudioHostEngineState) => void;

/**
 * Двигун режиму хоста: слухає команди з band-кімнати, вмикає й вимикає дрон
 * скомандованої пісні й публікує свій статус назад у кімнату. Активний лише
 * поки відкрита сторінка «режим хоста».
 *
 * Пісня приїжджає живим collab-документом (`openSongDoc`), і з нього береться
 * лише шапка: тональність для дрона, темп для метронома. Звук зібрання
 * відкладено разом зі старим плеєром (ADR-0003, `archive/chord-player`).
 */
class AudioHostEngine {
  static instance: AudioHostEngine;

  private channel = BandAudioChannel.getInstance();
  private player = DronePlayer.getInstance();
  private identity: { userId: number | null; username: string | null } = {
    userId: null,
    username: null,
  };

  private running = false;
  private armed = false;
  private controlledBy: string | null = null;
  private songHandle: SongDocHandle | null = null;
  private playing: PlaybackTarget | null = null;
  private playingName: string | null = null;
  private loading = false;

  private listeners = new Set<EngineListener>();
  private unsubscribers: Array<() => void> = [];

  static getInstance = () => {
    if (!AudioHostEngine.instance) {
      AudioHostEngine.instance = new AudioHostEngine();
    }
    return AudioHostEngine.instance;
  };

  isRunning() {
    return this.running;
  }

  getState(): AudioHostEngineState {
    return {
      armed: this.armed,
      state: this.loading ? "loading" : this.player.getState(),
      playing: this.playing,
      playingName: this.playingName,
      controlledBy: this.controlledBy,
    };
  }

  onState(listener: EngineListener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(identity: { userId: number | null; username: string | null }) {
    if (this.running) return;
    this.running = true;
    this.identity = identity;

    this.unsubscribers.push(
      this.channel.onCommand((command) => {
        void this.execute(command);
      }),
      this.player.onStateChange(() => this.publish()),
    );
    this.publish();
  }

  /** Розблокувати аудіо. МУСИТЬ викликатись із обробника дотику (iOS). */
  async arm() {
    await Tone.start();
    this.armed = true;
    this.publish();
  }

  /** Аварійний стоп із самого хоста (кнопка на сторінці). */
  stopPlayback() {
    this.player.stop();
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.player.stop();
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    this.closeSong();
    this.playing = null;
    this.playingName = null;
    this.armed = false;
    this.controlledBy = null;
    this.channel.publishHostStatus(null);
    this.notify();
  }

  private async execute(command: PlaybackCommand) {
    if (!this.running || !this.armed) return;
    // Команду іншого виду (старий клієнт, звук зібрання) мовчки пропускаємо:
    // виконати її нічим, а зупиняти через неї те, що грає, — не нам.
    if (command.target?.kind !== "song") return;
    this.controlledBy = command.issuedBy ?? null;

    switch (command.action) {
      case "play":
        await this.play(command.target);
        break;
      case "stop":
        this.player.stop();
        break;
    }
    this.publish();
  }

  private async play(target: PlaybackTarget) {
    // Ціль публікуємо ще до звуку: доки відкривається документ пісні, гурт має
    // бачити в кімнаті, ЩО саме зараз піднімається — інакше екран, який
    // натиснув, секунду виглядає так, ніби команда не дійшла.
    this.playing = target;
    this.loading = true;
    this.publish();

    let started = false;
    try {
      // Інша пісня — перепідключаємось до її документа.
      if (!this.songHandle || String(this.songHandle.songId) !== String(target.songId)) {
        this.closeSong();
        this.songHandle = openSongDoc(target.songId);
        await this.songHandle.synced;

        const handle = this.songHandle;
        this.player.setSource(() => handle.getHeader());
      }

      this.playingName = this.songHandle.getHeader().name;
      await this.player.play(target.songId);
      started = this.player.getState() !== "idle";
    } catch (error) {
      console.error("[audio-host] failed to play", target, error);
    } finally {
      this.loading = false;
      // Не піднялось — знімаємо ціль: сторінка хоста інакше показувала б
      // «тиша» під назвою того, що так і не заграло. Але лише СВОЮ ціль: поки
      // ми вантажились, могла прийти нова команда, і вона тепер головна.
      if (!started && this.playing === target) {
        this.playing = null;
        this.playingName = null;
      }
      this.publish();
    }
  }

  /** Відпустити документ пісні — разом із джерелом, що його читає. */
  private closeSong() {
    if (!this.songHandle) return;
    this.player.setSource(null);
    this.songHandle.destroy();
    this.songHandle = null;
  }

  private publish() {
    if (!this.running) return;
    const state = this.getState();
    this.channel.publishHostStatus({
      userId: this.identity.userId,
      username: this.identity.username,
      armed: this.armed,
      state: state.state,
      playing: state.playing,
      playingName: state.playingName,
      controlledBy: this.controlledBy,
      updatedAt: Date.now(),
    });
    this.notify();
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }
}

export default AudioHostEngine;
