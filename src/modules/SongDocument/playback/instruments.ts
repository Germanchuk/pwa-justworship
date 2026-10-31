/**
 * Тембри програвання доріжок (ADR-0009) — дешеві, синтезовані, крім гітари й
 * кахона (семпли, `loadSamples`); судить вухо. Кожен виклик — подія в момент
 * `time` (секунди аудіоконтексту), тож звучить точно, навіть якщо запланована
 * наперед.
 *
 *  - таби — семпли електрогітари, трохи овердрайву й кімнати, по семплеру на
 *    струну: новий щипок тієї ж струни глушить попередній, як на гітарі; `x` —
 *    глухий клац;
 *  - кахон — семпли справжнього кахона: бас, тон (снейр), закритий хет, том; під
 *    кожним — тихіший синтезований шар (щільніше);
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

// Електрогітара Karoryfer Samples з набору tonejs-instruments (Nicholaus Brosowsky), CC-BY 3.0.
// Семпл на кожну малу терцію E2–C6, тож Sampler розтягує ≤ ±1.5 півтона; обрізані до 3 с.
const GUITAR_URLS = import.meta.glob<string>("./guitar/*.mp3", { eager: true, query: "?url", import: "default" });
// Кахон VCSL (Versilian Studios), CC0: бас, слеп (снейр), том — бас із серединою на 3 півтони
// вище, закритий хет — тихий слеп, лише верхи й коротко; по два варіанти удару (B1, B2…).
const CAJON_URLS = import.meta.glob<string>("./cajon/*.mp3", { eager: true, query: "?url", import: "default" });

/** Удар кахона — нота семплера (як у GM-барабанах); другий варіант — на півтон вище. */
const CAJON_NOTE: Record<CajonHit, number> = { B: 36, T: 38, H: 42, M: 45 };
/** Сила удару: хет тихий, як його й грають, — пальцями між долями. */
const CAJON_FORCE: Record<CajonHit, number> = { B: 1, T: 0.8, H: 0.4, M: 0.75 };

/** Семпли за MIDI-нотою: гітара — за висотою, кахон — `CAJON_NOTE` і варіант. */
export type Samples = { guitar: Record<number, AudioBuffer>; cajon: Record<number, AudioBuffer> };
let samples: Promise<Samples> | null = null;

const loadSet = (urls: Record<string, string>, noteOf: (name: string) => number) =>
  Promise.all(
    Object.entries(urls).map(async ([path, url]) => [noteOf(/(\w+)\.mp3$/.exec(path)![1]), trimLead(await Tone.ToneAudioBuffer.fromUrl(url))] as const),
  ).then((entries) => Object.fromEntries(entries) as Record<number, AudioBuffer>);

/** Семпли вантажаться раз на запуск застосунку; перший ▶ чекає на них. */
export const loadSamples = () =>
  (samples ??= Promise.all([
    loadSet(GUITAR_URLS, (name) => Midi.toMidi(name.replace("s", "#"))!), // Fs2 → F#2
    loadSet(CAJON_URLS, (name) => CAJON_NOTE[name[0] as CajonHit] + Number(name.slice(1)) - 1), // B2 → другий варіант басу
  ]).then(
    ([guitar, cajon]) => ({ guitar, cajon }),
    (error) => {
      samples = null; // наступний ▶ спробує ще раз
      throw error;
    },
  ));

/** Тиша перед щипком (затримка кодека mp3) запізнила б його проти долі. */
function trimLead(buffer: Tone.ToneAudioBuffer) {
  const first = buffer.getChannelData(0).findIndex((v) => Math.abs(v) > 0.01);
  return (first > 0 ? buffer.slice(first / buffer.sampleRate) : buffer).get()!;
}

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

/** `samples` — з `loadSamples`; без них таби й кахон мовчать. */
export function createKit(samples: Samples | null): Kit {
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

  // Гітара (2026-10-31: синтезований щипок звучав противно — Герман попросив семпли).
  // Струни → трохи овердрайву → «кабінет» (без зрізу верхів овердрайв дзижчить) → кімната.
  const level = add(new Tone.Volume(-1).connect(out));
  const room = add(new Tone.Reverb({ decay: 1.5, preDelay: 0.01, wet: 0.1 }).connect(level));
  const cabinet = add(new Tone.Filter({ type: "lowpass", frequency: 4000, rolloff: -24 }).connect(room));
  const drive = add(new Tone.Distortion({ distortion: 0.1, oversample: "4x" }).connect(cabinet));
  const strings = samples ? OPEN.map(() => add(new Tone.Sampler({ urls: samples.guitar, release: 0.08 }).connect(drive))) : [];
  const muteFilter = add(new Tone.Filter({ type: "bandpass", frequency: 1400, Q: 1.2 }).connect(out));
  const mute = add(new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 }, volume: -10 }).connect(muteFilter));

  // Кахон: удари одного виду чергують два варіанти — без «кулемета» на швидких хетах.
  const cajon = samples && add(new Tone.Sampler({ urls: samples.cajon, volume: 1 }).connect(out));
  const turn: Partial<Record<CajonHit, number>> = {};
  // Під кожним семплом — синтезований шар, тихіший за нього (колишні звуки кахона): щільніше.
  // Висоти мембран підібрані так, щоб шар складався з семплом, а не гасив його (на 52 Гц бочка тихшала).
  const bass = add(new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 3, envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 }, volume: -6 }).connect(out));
  const slapFilter = add(new Tone.Filter({ type: "bandpass", frequency: 2600, Q: 0.9 }).connect(out));
  const slap = add(new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.11, sustain: 0 }, volume: -7 }).connect(slapFilter));
  const slapBody = add(new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 1.5, envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }, volume: -11 }).connect(out));
  const hatFilter = add(new Tone.Filter({ type: "highpass", frequency: 3200 }).connect(out));
  const hat = add(new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 }, volume: -11 }).connect(hatFilter));
  const tom = add(new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 2, envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.08 }, volume: -10 }).connect(out));
  const layer: Record<CajonHit, (time: number) => void> = {
    B: (time) => bass.triggerAttackRelease(75, 0.2, at(bass, time)),
    T: (time) => {
      slap.triggerAttackRelease(0.1, at(slap, time));
      slapBody.triggerAttackRelease(190, 0.06, at(slapBody, time));
    },
    H: (time) => hat.triggerAttackRelease(0.03, at(hat, time)),
    M: (time) => tom.triggerAttackRelease(120, 0.15, at(tom, time)),
  };

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
        s.releaseAll(time);
        s.triggerAttack(hz(OPEN[string - 1] + fret), time);
      }),
    cajon: (hit, time) =>
      safely(() => {
        layer[hit](time);
        if (!cajon) return;
        turn[hit] = (turn[hit] ?? 0) ^ 1;
        cajon.triggerAttack(hz(CAJON_NOTE[hit] + turn[hit]), time, CAJON_FORCE[hit]);
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
