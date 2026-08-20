import {
  getMidiPlayerState,
  playSegments,
  type MidiPlaybackControls,
  type MidiPlayerState,
  type PlayOptions,
} from "./playMidiGpt";
import {getProgressionFromSlate, type SongContentSnapshot} from "./getMidiFromSlate/getMidiFromSlate";
import type {PlannedChord, PlaybackSegment} from "./segments/model";
import {DEFAULT_BPM, DEFAULT_TIME_SIGNATURE} from "./songDefaults";
import {getHumanizeFactor, getPlayerSettings} from "./playerSettings";

type StateListener = (state: MidiPlayerState) => void;
type ChordListener = (event: PlannedChord | null) => void;
type SelectionListener = (eventKey: string | null) => void;
type ContentProvider = () => SongContentSnapshot | null;

const sanitizeBpm = (bpm: number | undefined, fallback: number): number =>
  typeof bpm === "number" && Number.isFinite(bpm) && bpm > 0 ? bpm : fallback;

/**
 * Singleton, що керує відтворенням і тримає підсвітку акордів у синхроні з
 * транспортом Tone.
 *
 * Планування часу тут більше НЕ живе: рулонний `MidiPlayer` сам розкладає
 * матеріал у тіки й повідомляє, що зараз звучить. Раніше підсвітка рахувалась
 * тут у СЕКУНДАХ з єдиного bpm — під плавною зміною темпу така арифметика
 * розсипалась би, тож вона пішла разом із «одна пісня = один темп».
 */
class ChordsProgressionPlayer {
  static instance: ChordsProgressionPlayer;
  private controls: MidiPlaybackControls | null = null;
  private state: MidiPlayerState = getMidiPlayerState();
  private stateListeners = new Set<StateListener>();
  private chordListeners = new Set<ChordListener>();
  private selectionListeners = new Set<SelectionListener>();
  private currentChordEvent: PlannedChord | null = null;
  private selectedKey: string | null = null;
  private contentProvider: ContentProvider | null = null;

  static getInstance = () => {
    if (!ChordsProgressionPlayer.instance) {
      ChordsProgressionPlayer.instance = new ChordsProgressionPlayer();
    }
    return ChordsProgressionPlayer.instance;
  };

  /** Пісня зі сторінки пісні: черга з одного сегмента. */
  play = async (options: Partial<PlayOptions> = {}) => {
    const segments = this.buildSongSegments();
    if (!segments) return;
    await this.playQueue(segments, options);
  };

  /**
   * Загальний вхід: зіграти довільну чергу сегментів.
   *
   * Саме сюди прийде режим зібрання — пісня, програш-луп, наступна пісня —
   * не змінюючи більше нічого в цьому класі.
   */
  playQueue = async (segments: PlaybackSegment[], options: Partial<PlayOptions> = {}) => {
    this.stopIfActive();
    if (segments.length === 0) {
      this.handlePlaybackComplete();
      return;
    }

    // Налаштування пристрою (пресет педа, піаніно, гуманізація) — базовий шар;
    // явні опції виклику сильніші. Читаються на кожен запуск, тож зміна в меню
    // діє з наступного разу.
    const settings = getPlayerSettings();

    this.setState("loading");
    try {
      this.controls = await playSegments(segments, {
        padPreset: settings.padPreset,
        piano: settings.piano,
        pianoVolume: settings.pianoVolume,
        humanize: getHumanizeFactor(settings.humanize),
        ...options,
        onChord: (chord) => this.emitChord(chord),
        onEnded: () => {
          this.handlePlaybackComplete();
          options.onEnded?.();
        },
      });
      this.setState("playing");
    } catch (error) {
      this.handlePlaybackComplete();
      throw error;
    }
  };

  getState() {
    return this.state;
  }

  getCurrentChord() {
    return this.currentChordEvent;
  }

  /** Чи крутиться зараз луп — тобто чи є сенс у кнопці «далі». */
  isOnLoop() {
    return this.controls?.isOnLoop() ?? false;
  }

  /** «Далі»: вийти з поточного лупа наприкінці його проходу. */
  next() {
    this.controls?.next();
  }

  onStateChange(listener: StateListener) {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  onChordChange(listener: ChordListener) {
    this.chordListeners.add(listener);
    listener(this.currentChordEvent);
    return () => {
      this.chordListeners.delete(listener);
    };
  }

  setStartChordTokenKey(tokenKey: string | null) {
    if (this.selectedKey === tokenKey) return;
    this.selectedKey = tokenKey;
    this.emitSelectedChord();
  }

  getStartChordTokenKey() {
    return this.selectedKey;
  }

  onSelectedChordKeyChange(listener: SelectionListener) {
    this.selectionListeners.add(listener);
    listener(this.selectedKey);
    return () => {
      this.selectionListeners.delete(listener);
    };
  }

  setContentProvider(provider: ContentProvider | null) {
    if (this.contentProvider === provider) return;
    if (this.contentProvider && provider == null && this.state !== "idle") {
      this.stop();
    }
    this.contentProvider = provider;
  }

  pause = () => {
    if (this.state !== "playing") return;
    this.controls?.pause();
    this.setState("paused");
  };

  resume = () => {
    if (this.state !== "paused") return;
    this.controls?.resume();
    this.setState("playing");
  };

  stop = () => {
    if (this.state === "idle") return;
    this.controls?.stop({ hard: true });
    this.handlePlaybackComplete();
  };

  /** Документ відкритої пісні → один сегмент `once`. */
  private buildSongSegments(): PlaybackSegment[] | null {
    if (!this.contentProvider) {
      this.handlePlaybackComplete();
      return null;
    }

    const {progression, bpm, timeSignature} = getProgressionFromSlate(
      this.contentProvider(),
      this.selectedKey,
    );

    if (progression.length === 0) {
      this.handlePlaybackComplete();
      return null;
    }

    return [
      {
        id: "song",
        progression,
        bpm: sanitizeBpm(bpm, DEFAULT_BPM),
        timeSignature: timeSignature ?? DEFAULT_TIME_SIGNATURE,
        kind: "once",
      },
    ];
  }

  private stopIfActive() {
    if (this.state !== "idle") {
      this.stop();
    }
  }

  private setState(state: MidiPlayerState) {
    if (this.state === state) return;
    this.state = state;
    this.stateListeners.forEach((listener) => listener(state));
  }

  private emitChord(event: PlannedChord | null) {
    this.currentChordEvent = event;
    const key = event?.tokenKey ?? null;
    if (key != null && this.selectedKey === key) {
      this.setStartChordTokenKey(null);
    }
    this.chordListeners.forEach((listener) => listener(event));
  }

  private emitSelectedChord() {
    this.selectionListeners.forEach((listener) => listener(this.selectedKey));
  }

  private handlePlaybackComplete() {
    this.emitChord(null);
    this.controls = null;
    this.setState("idle");
  }
}

export default ChordsProgressionPlayer;
