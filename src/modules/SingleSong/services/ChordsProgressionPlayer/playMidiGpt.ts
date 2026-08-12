import * as Tone from "tone";
import { Midi } from "@tonejs/midi";
import {getPadPresetDef, type PadPreset, type PadVoice} from "./createPad/padPresets";
import {createPiano} from "./createPiano/createPiano";
import {DEFAULT_BPM, DEFAULT_TIME_SIGNATURE} from "./songDefaults";

/** Tone-ове позначення часу; ми вживаємо тільки тікову форму `"<n>i"`. */
type ToneTime = string | number;

interface MidiEvent {
  time: ToneTime;
  name: string;
  duration: ToneTime;
  velocity: number;
}

export interface PlayOptions {
  /**
   * Темп і розмір — вхідні дані плеєра, а не властивість MIDI. Джерело правди
   * одне: документ пісні (див. `SlatePlayerBridge`), звідки вони приходять сюди
   * через `ChordsProgressionPlayer`. Хедер MIDI лишається валідною метаданою
   * для експорту, але на відтворення не впливає.
   */
  bpm?: number;
  timeSignature?: [number, number];
  metronome?: boolean;     // default: true
  metronomePan?: number;   // -1..1; 1 — правий
  introBars?: number;      // кількість тактів вступного кліку перед відтворенням
  padVolume?: number;      // дБ
  pianoVolume?: number;    // дБ
  padPreset?: PadPreset;   // default залежить від плеєра (defaultPlayer → "classic")
  piano?: boolean;         // грати піаніно-стаб поверх пада; default: true
  onEnded?: () => void;
}

interface MetronomeCtrl {
  start(at?: ToneTime): void;
  stop(): void;
  dispose(): void;
}

export type MidiPlayerState = "idle" | "loading" | "playing" | "paused";

export interface MidiPlaybackControls {
  stop(options?: { hard?: boolean; fadeOut?: number }): void;
  pause(): void;
  resume(): void;
  dispose(): void;
  getState(): MidiPlayerState;
}

/**
 * Долі → тіки транспорту. Доля = чверть (так само рахує `createMidiFromProgression`).
 * Плануємо все в тіках, тому таймінг нот не залежить від темпу: bpm застосовується
 * рівно один раз — на транспорті.
 */
function beatsToTicks(beats: number): ToneTime {
  return `${Math.round(beats * Tone.Transport.PPQ)}i`;
}

function setupTransport(num: number, den: number, bpm: number) {
  const Transport = Tone.Transport;
  Transport.cancel();
  Transport.stop();
  Transport.position = 0;
  Transport.timeSignature = [num, den];
  Transport.bpm.value = bpm;
  return Transport;
}

/**
 * Читаємо ноти в тіках (`n.ticks`), а не в секундах (`n.time`): секунди @tonejs/midi
 * рахує через темп із хедера, а він тут не авторитет.
 */
function midiToPartEvents(midi: Midi): MidiEvent[] {
  const ppq = midi.header.ppq;
  return midi.tracks.flatMap((t) =>
    t.notes.map((n) => ({
      time: beatsToTicks(n.ticks / ppq),
      name: Tone.Frequency(n.midi, "midi").toNote(),
      duration: beatsToTicks(n.durationTicks / ppq),
      velocity: n.velocity ?? 0.7,
    }))
  );
}

function createPart(events: MidiEvent[], players: { pad?: PadVoice; piano?: Tone.Sampler }) {
  const part = new Tone.Part<MidiEvent>((time, e) => {
    players.pad?.triggerAttackRelease(e.name, e.duration, time, e.velocity);
    players.piano?.triggerAttackRelease(e.name, e.duration, time, e.velocity);
  }, events);
  part.loop = false;
  return part;
}

function createMetronome({ num, den, pan = 1 }: { num: number; den: number; pan?: number }): MetronomeCtrl {
  const tick = new Tone.MembraneSynth({
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
    volume: 8,
  });
  const panner = new Tone.Panner(pan).toDestination();
  tick.connect(panner);

  const beatSubdivision = `${den}n`;

  const loop = new Tone.Loop((time) => {
    const Transport = Tone.Transport;
    const ticksPerBeat = Transport.PPQ;
    const ticksPerBar = ticksPerBeat * num;
    const ticks = Transport.ticks;
    const isBarStart = ticks % ticksPerBar === 0;
    const pitch = isBarStart ? "C5" : "C4";
    const velocity = isBarStart ? 1 : 0.55;
    tick.triggerAttackRelease(pitch, "16n", time, velocity);
  }, beatSubdivision);

  return {
    start(at: ToneTime = 0) { loop.start(at); },
    stop() { loop.stop(); },
    dispose() { loop.dispose(); tick.dispose(); panner.dispose(); },
  };
}

function computeEndBeats(midi: Midi): number {
  const ppq = midi.header.ppq;
  return Math.max(
    0,
    ...midi.tracks.flatMap((t) => t.notes.map((n) => (n.ticks + n.durationTicks) / ppq)),
  );
}

function setDestinationVolumeImmediately(volume: number) {
  const destination = Tone.Destination;
  destination.volume.cancelAndHoldAtTime(destination.context.currentTime);
  destination.volume.value = volume;
}

// =================== КЛАС ===================

export class MidiPlayer {
  private part: Tone.Part<MidiEvent> | null = null;
  private metro: MetronomeCtrl | null = null;
  private pad: PadVoice | null = null;
  private piano: Tone.Sampler | null = null;
  private state: MidiPlayerState = "idle";
  private endEventId: number | null = null;
  private fadeTimerId: number | null = null;

  constructor(private defaults: PlayOptions = {}) {}

  getState(): MidiPlayerState {
    return this.state;
  }

  private setState(next: MidiPlayerState) {
    this.state = next;
  }

  private clearFadeTimer() {
    if (this.fadeTimerId != null) {
      Tone.getContext().clearTimeout(this.fadeTimerId);
      this.fadeTimerId = null;
    }
  }

  private cancelEndEvent() {
    if (this.endEventId != null) {
      Tone.Transport.clear(this.endEventId);
      this.endEventId = null;
    }
  }

  async play(midi: Midi, opts: PlayOptions = {}): Promise<MidiPlaybackControls> {
    this.setState("loading");
    await Tone.start();

    if (this.state === "playing" || this.state === "paused") {
      this.stop({ hard: true });
    }
    this.dispose(); // чистий старт

    const bpm = opts.bpm ?? this.defaults.bpm ?? DEFAULT_BPM;
    const [num, den] = opts.timeSignature ?? this.defaults.timeSignature ?? DEFAULT_TIME_SIGNATURE;
    const Transport = setupTransport(num, den, bpm);

    const introBars = Math.max(0, opts.introBars ?? this.defaults.introBars ?? 1);
    // Такт вступу рахуємо в долях (num), а не через Tone-ове `"1m"`: воно міряє
    // такт відносно знаменника, і на розмірах на кшталт 6/8 розійшлося б із тим,
    // як такт розуміє лексер акордів.
    const introBeats = introBars * num;
    const introOffset = beatsToTicks(introBeats);

    const preset = opts.padPreset ?? this.defaults.padPreset ?? "classic";
    this.pad = getPadPresetDef(preset).create();
    if (typeof opts.padVolume === "number") {
      this.pad.volume.value = opts.padVolume;
    }

    // Піаніно — додатковий "стаб" поверх пада. Якщо вимкнено (`piano: false`),
    // пед лишається основним (і єдиним) звуком.
    const wantPiano = (opts.piano ?? this.defaults.piano) !== false;
    this.piano = wantPiano ? createPiano() : null;
    if (this.piano && typeof opts.pianoVolume === "number") {
      this.piano.volume.value = opts.pianoVolume;
    }

    await Tone.loaded();

    const events = midiToPartEvents(midi);
    this.part = createPart(events, { pad: this.pad, piano: this.piano ?? undefined });
    this.part.start(introOffset);

    const endWithIntro = beatsToTicks(introBeats + computeEndBeats(midi));

    if ((opts.metronome ?? this.defaults.metronome) !== false) {
      this.metro = createMetronome({ num, den, pan: opts.metronomePan ?? this.defaults.metronomePan ?? 1 });
      this.metro.start(0);
    }

    this.cancelEndEvent();
    this.endEventId = Transport.scheduleOnce(() => {
      this.endEventId = null;
      this.stop({ hard: true });
      opts.onEnded?.();
    }, endWithIntro);

    this.clearFadeTimer();
    setDestinationVolumeImmediately(0);

    Transport.start();
    this.setState("playing");

    return {
      stop: (options) => this.stop(options),
      pause: () => this.pause(),
      resume: () => this.resume(),
      dispose: () => this.dispose(),
      getState: () => this.getState(),
    };
  }

  pause() {
    if (this.state !== "playing") return;
    Tone.Transport.pause();
    this.setState("paused");
  }

  resume() {
    if (this.state !== "paused") {
      return;
    }
    Tone.Transport.start();
    this.setState("playing");
  }

  stop({ hard = false, fadeOut = 0 }: { hard?: boolean; fadeOut?: number } = {}) {
    const Transport = Tone.Transport;

    this.cancelEndEvent();
    this.clearFadeTimer();

    if (fadeOut > 0) {
      Tone.Destination.volume.rampTo(-Infinity, fadeOut);
      this.fadeTimerId = Tone.getContext().setTimeout(() => {
        setDestinationVolumeImmediately(0);
      }, fadeOut);
    }

    this.metro?.stop();
    this.part?.stop();

    Transport.stop();
    if (hard) {
      Transport.cancel();
      Transport.position = 0;
    }

    this.setState("idle");
  }

  dispose() {
    this.cancelEndEvent();
    this.clearFadeTimer();
    try { this.metro?.dispose(); } catch { /* ignore */ }
    try { this.part?.dispose(); } catch { /* ignore */ }
    try { this.pad?.dispose(); } catch { /* ignore */ }
    try { this.piano?.dispose(); } catch { /* ignore */ }
    this.metro = null;
    this.part = null;
    this.pad = null;
    this.piano = null;
    this.setState("idle");
  }
}

// ========== Тонка обгортка під старе API (окремі функції) ==========
// Режим піаніно: семпл-пед (lotus-pond, пресет "classic") лишається підкладкою,
// поверх нього грає піаніно-стаб.
const defaultPlayer = new MidiPlayer({ padPreset: "classic", piano: true });

export async function playMidiProgressionGpt(midi: Midi, opts?: PlayOptions) {
  return defaultPlayer.play(midi, opts);
}

export function stopMidiProgression(options?: { hard?: boolean; fadeOut?: number }) {
  defaultPlayer.stop(options);
}

export function pauseMidiProgression() {
  defaultPlayer.pause();
}

export function resumeMidiProgression() {
  defaultPlayer.resume();
}

export function disposeMidiProgression() {
  defaultPlayer.dispose();
}

export function getMidiPlayerState(): MidiPlayerState {
  return defaultPlayer.getState();
}
