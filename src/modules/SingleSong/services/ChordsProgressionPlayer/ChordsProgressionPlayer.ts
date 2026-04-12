import * as Tone from "tone";
import {
  getMidiPlayerState,
  playMidiProgressionGpt,
  type MidiPlaybackControls,
  type MidiPlayerState,
  type PlayOptions,
} from "./playMidiGpt";
import {getMidiFromSections} from "./getMidiFromSections/getMidiFromSections";
import type {ChordTimelineEvent} from "./getMidiFromSections/utils/progressionToTimeline";

type StateListener = (state: MidiPlayerState) => void;
type ChordListener = (event: ChordTimelineEvent | null) => void;
type SelectionListener = (eventId: number | null) => void;
type PlaybackPlan = {
  midi: ReturnType<typeof getMidiFromSections>["midi"];
  timeline: ChordTimelineEvent[];
  options: PlayOptions;
};

/**
 * Singleton that orchestrates MIDI playback and keeps chord highlights in sync with Tone.Transport.
 */
class ChordsProgressionPlayer {
  static instance: ChordsProgressionPlayer;
  private controls: MidiPlaybackControls | null = null;
  private state: MidiPlayerState = getMidiPlayerState();
  private stateListeners = new Set<StateListener>();
  private chordListeners = new Set<ChordListener>();
  private selectionListeners = new Set<SelectionListener>();
  private scheduledChordEvents: number[] = [];
  private currentChordEvent: ChordTimelineEvent | null = null;
  private selectedChordId: number | null = null;

  static getInstance = () => {
    if (!ChordsProgressionPlayer.instance) {
      ChordsProgressionPlayer.instance = new ChordsProgressionPlayer();
    }
    return ChordsProgressionPlayer.instance;
  };

  play = async (options: Partial<PlayOptions> = {}) => {
    this.stopIfActive();
    const plan = this.buildPlaybackPlan(options);
    if (!plan) return;
    this.setState("loading");
    try {
      this.controls = await playMidiProgressionGpt(plan.midi, plan.options);
      this.scheduleChordHighlights(plan.timeline);
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

  setStartChordId(chordId: number | null) {
    this.selectedChordId = chordId;
    this.emitSelectedChord();
  }

  getStartChordId() {
    return this.selectedChordId;
  }

  onSelectedChordChange(listener: SelectionListener) {
    this.selectionListeners.add(listener);
    listener(this.selectedChordId);
    return () => {
      this.selectionListeners.delete(listener);
    };
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

  private buildPlaybackPlan(options: Partial<PlayOptions>): PlaybackPlan | null {
    const prepared = getMidiFromSections(this.selectedChordId);
    const { midi, timeline, bpm, timeSignature } = prepared;
    const beatsPerBar = timeSignature?.[0] ?? 4;

    if (timeline.length === 0) {
      this.handlePlaybackComplete();
      return null;
    }

    const introBars = Math.max(0, options.introBars ?? 1);
    const timelineWithIntro = this.shiftTimelineForIntro(timeline, introBars, beatsPerBar, bpm);

    const mergedOptions: PlayOptions = {
      bpm,
      ...options,
      introBars,
      onEnded: () => {
        this.handlePlaybackComplete();
        options.onEnded?.();
      },
    };

    return { midi, timeline: timelineWithIntro, options: mergedOptions };
  }

  private shiftTimelineForIntro(
    timeline: ChordTimelineEvent[],
    introBars: number,
    beatsPerBar: number,
    bpm: number,
  ) {
    if (introBars === 0) return timeline;
    const introSeconds = introBars * beatsPerBar * (60 / bpm);
    const introBeats = introBars * beatsPerBar;

    return timeline.map((event) => ({
      ...event,
      start: event.start + introSeconds,
      startBeats: event.startBeats + introBeats,
    }));
  }

  // Keeps the chord highlight timeline aligned with the Tone transport clock.
  private scheduleChordHighlights(timeline: ChordTimelineEvent[]) {
    this.clearScheduledChordEvents();

    if (timeline.length === 0) {
      this.emitChord(null);
      return;
    }

    const transport = Tone.Transport;
    const now = transport.seconds;
    this.seedCurrentChord(timeline, now);

    timeline.forEach((event) => {
      const timeUntilStart = event.start - now;
      if (timeUntilStart <= 0) return;

      const id = transport.scheduleOnce(() => {
        this.emitChord(event);
      }, `+${timeUntilStart}`);
      this.scheduledChordEvents.push(id);
    });
  }

  private seedCurrentChord(timeline: ChordTimelineEvent[], now: number) {
    const activeEvent =
      [...timeline].reverse().find((event) => {
        const end = event.start + event.duration;
        return now >= event.start && now < end;
      }) ?? null;

    this.emitChord(activeEvent);
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

  private emitChord(event: ChordTimelineEvent | null) {
    this.currentChordEvent = event;
    if (event?.id != null && this.selectedChordId === event.id) {
      this.setStartChordId(null);
    }
    this.chordListeners.forEach((listener) => listener(event));
  }

  private emitSelectedChord() {
    this.selectionListeners.forEach((listener) => listener(this.selectedChordId));
  }

  private clearScheduledChordEvents() {
    this.scheduledChordEvents.forEach((id) => Tone.Transport.clear(id));
    this.scheduledChordEvents = [];
  }

  private handlePlaybackComplete() {
    this.clearScheduledChordEvents();
    this.emitChord(null);
    this.controls = null;
    this.setState("idle");
  }
}

export default ChordsProgressionPlayer;
