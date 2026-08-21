import * as Tone from "tone";

import { buildGathering, sliceFromPoint } from "#modules/Gathering/buildGathering";
import { fetchGathering } from "#modules/Gathering/gatheringSource";
import ChordsProgressionPlayer from "#modules/SingleSong/services/ChordsProgressionPlayer/ChordsProgressionPlayer";
import { formatDate } from "#utils/utils";
import BandAudioChannel from "./bandAudioChannel";
import { openSongDoc, type SongDocHandle } from "./openSongDoc";
import type { AudioHostPlaybackState, PlaybackCommand, PlaybackTarget } from "./types";

export interface AudioHostEngineState {
  armed: boolean;
  state: AudioHostPlaybackState;
  /** Що зараз на хості: пісня чи служіння — і яке саме. */
  playing: PlaybackTarget | null;
  playingName: string | null;
  controlledBy: string | null;
}

type EngineListener = (state: AudioHostEngineState) => void;

/**
 * Двигун режиму хоста: слухає команди з band-кімнати, головним плеєром грає
 * скомандоване й публікує свій статус назад у кімнату. Активний лише поки
 * відкрита сторінка «режим хоста».
 *
 * ─── ДВА ВИПАДКИ, ОДИН ТРАНСПОРТ ───────────────────────────────────────────
 * Команда буває про пісню або про служіння (`PLAY-38`), і це різні дороги до
 * звуку: пісня приїжджає живим collab-документом, служіння — одним HTTP-
 * запитом і збіркою `buildGathering`. Далі вони сходяться в ОДИН плеєр — тому
 * пісня й зібрання не можуть звучати одночасно (`PLAY-40`) і тому ж хост
 * лишається однією річчю, а не двома двигунами.
 *
 * ─── ЧОМУ СЛУЖІННЯ ПЕРЕЧИТУЄТЬСЯ ЩОРАЗУ ────────────────────────────────────
 * Хост читає служіння з того самого ендпоінта, що й екрани гурту, і читає його
 * на кожен запуск — так само, як підхоплює правки пісні (`PLAY-34`). Збірка
 * чиста, тож з ОДНАКОВОГО знімка виходить однакова черга.
 *
 * ⚠️ Однаковий він не завжди: екран читає знімок, коли його відкрили, а хост —
 * коли натиснули «грати». Правка, збережена між цими двома митями, дійде до
 * хоста й не дійде до екрана. Знімок екрана тим часом свідомо не оновлюється
 * (`LIST-32`), тож на служінні це саме та рідкість, заради якої не варто
 * заводити третій шлях; на генеральній репетиції — привід перевідкрити екран.
 */
class AudioHostEngine {
  static instance: AudioHostEngine;

  private channel = BandAudioChannel.getInstance();
  private player = ChordsProgressionPlayer.getInstance();
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
    this.controlledBy = command.issuedBy ?? null;

    switch (command.action) {
      case "play":
        await this.play(command.target);
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

  private async play(target: PlaybackTarget) {
    // Спершу глушимо те, що грало (`PLAY-40`), і аж потім вантажимо нове.
    // Порядок саме такий, бо між командою і звуком стоїть завантаження: якби
    // старе глушив лише запуск нового, невдалий старт лишив би гурт слухати
    // попереднє під написом про нове.
    this.player.stop();

    // Ціль публікуємо ще до звуку: доти, доки вантажаться семпли, гурт має
    // бачити в кімнаті, ЩО саме зараз піднімається — інакше екран, який
    // натиснув, півсекунди виглядає так, ніби команда не дійшла.
    this.playing = target;
    this.loading = true;
    this.publish();

    let started = false;
    try {
      started =
        target.kind === "song"
          ? await this.playSong(target)
          : await this.playGathering(target);
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

  private async playSong(target: Extract<PlaybackTarget, { kind: "song" }>) {
    // Інша пісня — перепідключаємось до її документа.
    if (!this.songHandle || String(this.songHandle.songId) !== String(target.songId)) {
      this.closeSong();
      this.songHandle = openSongDoc(target.songId);
      await this.songHandle.synced;

      const handle = this.songHandle;
      this.player.setContentProvider(() => handle.getSnapshot());
    }

    this.playingName = this.songHandle.getSnapshot().name;
    this.player.setStartChordTokenKey(target.startTokenKey);
    await this.player.play();
    // Пісня без розмічених тактів не має чого грати — плеєр мовчки лишається
    // в тиші, і ціллю це не є.
    return this.player.getState() !== "idle";
  }

  private async playGathering(target: Extract<PlaybackTarget, { kind: "gathering" }>) {
    const bandId = this.channel.getBandId();
    if (bandId == null) return false;

    // Пісня й служіння — різні дороги до звуку, і тримати відкритим документ
    // пісні, поки грає служіння, нема заради чого: наступний запуск пісні
    // відкриє його наново.
    this.closeSong();

    const list = await fetchGathering(bandId, target.listId);
    this.playingName = formatDate(list.date) ?? null;

    const queue = sliceFromPoint(buildGathering(list.points).segments, target.fromPoint);
    if (queue.length === 0) {
      // Пункту немає в тому списку, що бачить хост (див. `sliceFromPoint`):
      // краще тиша, з якої видно, що команда не вийшла.
      console.warn("[audio-host] gathering point not found", target);
      return false;
    }

    await this.player.playQueue(queue);
    return this.player.getState() !== "idle";
  }

  /** Відпустити документ пісні — разом із провайдером, що його читає. */
  private closeSong() {
    if (!this.songHandle) return;
    this.player.setContentProvider(null);
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
      // У зібранні ключ приходить із ознакою пункту попереду — так він і їде
      // в кімнату (`PLAY-39`): без неї той самий акорд спалахнув би одразу в
      // кількох піснях служіння.
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
