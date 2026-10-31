/**
 * Тембри програвання доріжок (ADR-0009) — спершу найдешевші, синтезовані, без
 * семплів; судить вухо. Кожен виклик — подія в момент `time` (секунди
 * аудіоконтексту), тож звучить точно, навіть якщо запланована наперед.
 *
 *  - таби — щипок Karplus-Strong (`PluckSynth`), м'який, з дещицею кімнати, по
 *    синту на струну: новий щипок тієї ж струни глушить попередній, як на
 *    гітарі; `x` — глухий клац;
 *  - кахон — бас (мембрана), тон (шум у середині й коротка мембрана), гост
 *    (тихий сухий шум);
 *  - прямокутники — акорд м'яким синтом, розкладений як піаніст (`voiceChord`);
 *  - піаніно — нота клавішним синтом, поки ваншот (згасає сама);
 *  - відлік — дерев'яний клац.
 */
import * as Tone from "tone";
import { Chord, Midi, Note } from "@tonaljs/tonal";
import type { CajonHit } from "./timeline";
import { voiceChord } from "./voiceChord";

/** Відкриті струни (MIDI) згори донизу, як рядки табів: e B G D A E. */
const OPEN = [64, 59, 55, 50, 45, 40];
/** Скільки секунд дзвенить щипок струни (до −60 дБ). */
const RING_S = 1.8;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export type Kit = {
  tab: (string: number, fret: number | "x", time: number) => void;
  cajon: (hit: CajonHit, time: number) => void;
  chord: (name: string, seconds: number, time: number) => void;
  note: (midi: number, time: number) => void;
  click: (time: number) => void;
  dispose: () => void;
};

const pitchClass = (name: string) => {
  const midi = Midi.toMidi(`${name}4`);
  return midi == null ? null : ((midi % 12) + 12) % 12;
};

/** Ноти акорду за назвою (`Am7`, `F/A`); не акорд і не нота — нічого. */
function chordNotes(name: string, prevUpper: number[] | null) {
  const [symbol, slash] = name.split("/");
  const parsed = Chord.get(symbol);
  const pcs = (parsed.notes.length ? parsed.notes : [Note.get(symbol).name].filter(Boolean)).map(pitchClass).filter((pc): pc is number => pc != null);
  if (!pcs.length) return null;
  const bassPc = (slash ? pitchClass(Note.get(slash).name) : null) ?? pcs[0];
  return voiceChord({ chordPcs: pcs, bassPc, prevUpper });
}

export function createKit(): Kit {
  const out = new Tone.Volume(-10).toDestination(); // удари кахона й акорд разом не перевантажують вихід
  const nodes: { dispose: () => unknown }[] = [out];
  const add = <T extends { dispose: () => unknown }>(node: T) => (nodes.push(node), node);

  /**
   * Монофонічний синт не приймає два старти в ту саму мить — тоді наступний
   * зсуваємо на мілісекунду (на слух те саме).
   */
  const lastAt = new Map<object, number>();
  const at = (synth: object, time: number) => {
    const t = Math.max(time, (lastAt.get(synth) ?? -1) + 0.001);
    lastAt.set(synth, t);
    return t;
  };
  const safely = (fn: () => void) => {
    try {
      fn();
    } catch (error) {
      console.warn("lane playback", error);
    }
  };

  // Гітара (2026-10-31: була різка, низи дзижчали). У `PluckSynth` Tone 15 фільтр стоїть лише
  // на шумі атаки, а не в петлі струни: усі гармоніки згасають разом, і низька нота довго
  // дзижчить «пилкою». Тож верхи гасимо самі — фільтр струни після щипка за мить темніє до
  // кількох гармонік (`tab`), — а дзвін рівняємо в секундах, не в періодах. Плюс трохи кімнати.
  const guitar = add(new Tone.Volume(4).connect(out));
  const room = add(new Tone.Reverb({ decay: 1.5, preDelay: 0.01, wet: 0.2 }).connect(guitar));
  // Басові струни трохи гучніші: без дзизку їм бракує ваги поруч із верхніми.
  const strings = OPEN.map((_, i) => {
    const tone = add(new Tone.Filter({ type: "lowpass", frequency: 3000, rolloff: -12, Q: 0.3 }).connect(room));
    return { synth: add(new Tone.PluckSynth({ attackNoise: 0.5, dampening: 2200, release: 1, volume: i * 0.8 }).connect(tone)), tone };
  });
  const muteFilter = add(new Tone.Filter({ type: "bandpass", frequency: 1400, Q: 1.2 }).connect(out));
  const mute = add(new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 }, volume: -10 }).connect(muteFilter));

  const bass = add(new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 3, envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 }, volume: -2 }).connect(out));
  const slapFilter = add(new Tone.Filter({ type: "bandpass", frequency: 2600, Q: 0.9 }).connect(out));
  const slap = add(new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.11, sustain: 0 }, volume: -4 }).connect(slapFilter));
  const slapBody = add(new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 1.5, envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }, volume: -8 }).connect(out));
  const ghostFilter = add(new Tone.Filter({ type: "highpass", frequency: 3200 }).connect(out));
  const ghost = add(new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 }, volume: -16 }).connect(ghostFilter));

  const pad = add(
    new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fattriangle", count: 2, spread: 14 },
      envelope: { attack: 0.03, decay: 0.8, sustain: 0.4, release: 0.9 },
      volume: -16,
    }).connect(out),
  );
  let prevUpper: number[] | null = null;
  const keys = add(
    new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.004, decay: 0.9, sustain: 0.08, release: 0.5 },
      volume: -8,
    }).connect(out),
  );

  const clickFilter = add(new Tone.Filter({ type: "bandpass", frequency: 2200, Q: 2.5 }).connect(out));
  const tick = add(new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.015, sustain: 0 }, volume: -2 }).connect(clickFilter));

  const hz = (midi: number) => Tone.Frequency(midi, "midi").toFrequency();

  return {
    tab: (string, fret, time) =>
      safely(() => {
        if (fret === "x") return mute.triggerAttackRelease(0.04, at(mute, time));
        const s = strings[string - 1];
        if (!s) return;
        const f = hz(OPEN[string - 1] + fret);
        const t = at(s.synth, time);
        s.synth.resonance = 10 ** (-3 / (RING_S * f)); // −60 дБ за RING_S секунд на будь-якій висоті
        s.tone.frequency.cancelScheduledValues(t);
        s.tone.frequency.setValueAtTime(clamp(f * 14, 2500, 6000), t);
        s.tone.frequency.exponentialRampToValueAtTime(clamp(f * 6, 800, 3000), t + 0.4);
        s.synth.triggerAttack(f, t);
      }),
    cajon: (hit, time) =>
      safely(() => {
        if (hit === "B") bass.triggerAttackRelease(58, 0.2, at(bass, time));
        else if (hit === "T") {
          slap.triggerAttackRelease(0.1, at(slap, time));
          slapBody.triggerAttackRelease(190, 0.06, at(slapBody, time));
        } else ghost.triggerAttackRelease(0.03, at(ghost, time));
      }),
    chord: (name, seconds, time) =>
      safely(() => {
        const voiced = chordNotes(name, prevUpper);
        if (!voiced) return;
        prevUpper = voiced.upper;
        pad.triggerAttackRelease([voiced.bass, ...voiced.upper].map(hz), Math.max(0.05, seconds - 0.02), time);
      }),
    note: (midi, time) => safely(() => keys.triggerAttackRelease(hz(midi), 0.5, time)),
    click: (time) => safely(() => tick.triggerAttackRelease(0.015, at(tick, time))),
    dispose: () => nodes.forEach((n) => safely(() => n.dispose())),
  };
}
