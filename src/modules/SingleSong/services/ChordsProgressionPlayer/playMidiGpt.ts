import * as Tone from "tone";
import { Midi } from "@tonejs/midi";
import {createPad} from "./createPad/createPad";
import {createWorshipPad} from "./createPad/createWorshipPad";
import {createPiano} from "./createPiano/createPiano";

type BBSTime = string; // "bars:beats:sixteenths"

export type PadPreset = "classic" | "worship";

/**
 * Anything that exposes Tone's note-trigger interface. Lets us swap between the
 * sample-based `createPad` and the synth-based `createWorshipPad` without
 * leaking concrete types through the player.
 */
type PadVoice = {
  triggerAttackRelease(
    notes: string | string[],
    duration: BBSTime | number,
    time?: number,
    velocity?: number,
  ): unknown;
  volume: Tone.Param<"decibels"> | {value: number};
  dispose(): unknown;
};

interface MidiEvent {
  time: BBSTime;
  name: string;
  duration: BBSTime;
  velocity: number;
}

export interface PlayOptions {
  bpm?: number;
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
  start(at?: BBSTime | number): void;
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

function toBBS(sec: number): BBSTime {
  return Tone.Time(sec).toBarsBeatsSixteenths();
}

function extractSignatureAndTempo(midi: Midi, fallbackBpm = 70) {
  const [num, den] = (midi.header.timeSignatures?.[0]?.timeSignature as [number, number]) || [4, 4];
  const bpm = midi.header.tempos?.[0]?.bpm ?? fallbackBpm;
  return { num, den, bpm };
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

function midiToBBSEvents(midi: Midi): MidiEvent[] {
  return midi.tracks.flatMap((t) =>
    t.notes.map((n) => ({
      time: toBBS(n.time),
      name: Tone.Frequency(n.midi, "midi").toNote(),
      duration: toBBS(n.duration),
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
    start(at: BBSTime | number = 0) { loop.start(at); },
    stop() { loop.stop(); },
    dispose() { loop.dispose(); tick.dispose(); panner.dispose(); },
  };
}

function computeEndBBS(midi: Midi): BBSTime {
  const maxEndSec = Math.max(0, ...midi.tracks.flatMap((t) => t.notes.map((n) => n.time + n.duration)));
  return toBBS(maxEndSec);
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

    const { num, den, bpm } = extractSignatureAndTempo(midi, opts.bpm ?? this.defaults.bpm ?? 70);
    const Transport = setupTransport(num, den, bpm);

    const introBars = Math.max(0, opts.introBars ?? this.defaults.introBars ?? 1);
    const introOffset = introBars > 0 ? `${introBars}m` : 0;
    const introOffsetSeconds = Tone.Time(introOffset).toSeconds();

    const preset = opts.padPreset ?? this.defaults.padPreset ?? "worship";
    this.pad = preset === "worship" ? createWorshipPad() : createPad();
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

    const events = midiToBBSEvents(midi);
    this.part = createPart(events, { pad: this.pad, piano: this.piano ?? undefined });
    this.part.start(introOffset);

    const endBBS = computeEndBBS(midi);
    const endWithIntroSeconds = Tone.Time(endBBS).toSeconds() + introOffsetSeconds;

    if ((opts.metronome ?? this.defaults.metronome) !== false) {
      this.metro = createMetronome({ num, den, pan: opts.metronomePan ?? this.defaults.metronomePan ?? 1 });
      this.metro.start(0);
    }

    this.cancelEndEvent();
    this.endEventId = Transport.scheduleOnce(() => {
      this.endEventId = null;
      this.stop({ hard: true });
      opts.onEnded?.();
    }, endWithIntroSeconds);

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
