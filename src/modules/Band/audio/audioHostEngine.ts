import * as Tone from "tone";

import ChordsProgressionPlayer from "#modules/SingleSong/services/ChordsProgressionPlayer/ChordsProgressionPlayer";
import BandAudioChannel from "./bandAudioChannel";
import {openSongDoc, type SongDocHandle} from "./openSongDoc";
import type {AudioHostPlaybackState, PlaybackCommand} from "./types";

export interface AudioHostEngineState {
  armed: boolean;
  state: AudioHostPlaybackState;
  songId: string | number | null;
  songName: string | null;
  controlledBy: string | null;
}

type EngineListener = (state: AudioHostEngineState) => void;

/**
 * Двигун режиму хоста: слухає команди з band-кімнати, головним плеєром грає
 * скомандовану пісню (headless-док) і публікує свій статус назад у кімнату.
 * Активний лише поки відкрита сторінка «режим хоста».
 */
class AudioHostEngine {
  static instance: AudioHostEngine;

  private channel = BandAudioChannel.getInstance();
  private player = ChordsProgressionPlayer.getInstance();
  private identity: {userId: number | null; username: string | null} = {
    userId: null,
    username: null,
  };

  private running = false;
  private armed = false;
  private controlledBy: string | null = null;
  private songHandle: SongDocHandle | null = null;
  private songName: string | null = null;
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
      songId: this.songHandle?.songId ?? null,
      songName: this.songName,
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

  start(identity: {userId: number | null; username: string | null}) {
    if (this.running) return;
    this.running = true;
    this.identity = identity;

    this.unsubscribers.push(
      this.channel.onCommand((command) => {
        void this.execute(command);
      }),
      this.player.onStateChange(() => this.publish()),
      this.player.onChordChange(() => this.publish()),
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
    this.songHandle?.destroy();
    this.songHandle = null;
    this.songName = null;
    this.armed = false;
    this.controlledBy = null;
    this.channel.publishHostStatus(null);
    this.notify();
  }

  private async execute(command: PlaybackCommand) {
    if (!this.running || !this.armed) return;
    this.controlledBy = command.issuedBy ?? null;

    switch (command.action) {
      case "play":
        await this.play(command);
        break;
      case "pause":
        this.player.pause();
        break;
      case "resume":
        this.player.resume();
        break;
      case "stop":
        this.player.stop();
        break;
    }
    this.publish();
  }

  private async play(command: PlaybackCommand) {
    if (command.songId == null) return;

    try {
      // Інша пісня — перепідключаємось до її документа.
      if (!this.songHandle || String(this.songHandle.songId) !== String(command.songId)) {
        this.loading = true;
        this.publish();

        this.songHandle?.destroy();
        this.songHandle = openSongDoc(command.songId);
        await this.songHandle.synced;

        const handle = this.songHandle;
        this.player.setContentProvider(() => handle.getSnapshot());
      }

      this.songName = this.songHandle.getSnapshot().name;
      this.player.setStartChordTokenKey(command.startTokenKey ?? null);
      await this.player.play();
    } catch (error) {
      console.error("[audio-host] failed to play song", command.songId, error);
    } finally {
      this.loading = false;
      this.publish();
    }
  }

  private publish() {
    if (!this.running) return;
    const state = this.getState();
    this.channel.publishHostStatus({
      userId: this.identity.userId,
      username: this.identity.username,
      armed: this.armed,
      state: state.state,
      songId: state.songId,
      songName: state.songName,
      currentTokenKey: this.player.getCurrentChord()?.tokenKey ?? null,
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
