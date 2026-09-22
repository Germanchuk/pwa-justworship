import * as Tone from "tone";

import {padTrim} from "./padTrim";

/**
 * ДРОН — моно-пед у тональності пісні (ADR-0003).
 *
 * Звук перенесено з POC Германа (артефакт «Дрон-пед», 2026-09) майже один в
 * один; ручки POC зафіксовані на його значеннях за замовчуванням нижче, живою
 * лишилась лише гучність (`padTrim`). Акордів і темпу дрон не знає: з пісні він
 * бере тільки тональність.
 *
 * ─── ЧОМУ МОНО І ЛИШЕ ЛІВИЙ КАНАЛ ──────────────────────────────────────────
 * Пед іде на пульт, а ширину й основний реверб дає пульт. Тому все, що в стерео
 * давало б «простір», тут замінене тим, що виживає в моно: рухомий формант
 * замість ширини, передзатримка реверба замість розкиду. Правий канал вільний
 * під метроном — два окремі канали на пульті.
 *
 * ─── ЧОМУ НЕ TONE-НОДИ ─────────────────────────────────────────────────────
 * Граф будується сирими Web Audio-нодами — як у POC, щоб звук лишився тим, що
 * Герман слухав. Контекст при цьому СПІЛЬНИЙ із Tone: той самий дозвіл звуку на
 * iOS (`Tone.start`) і той самий вихід, що й у метронома.
 */

/** Скільки триває кожен наплив і кожне згасання (рішення Германа — 6 с на все). */
export const DRONE_FADE_SECONDS = 6;

// ─── Звук: значення ручок POC за замовчуванням ───────────────────────────────
const BRIGHT = 0.4;
const MOVE = 0.55;
const SHIMMER = 0.3;
const SPACE = 0.35;
const SUB = 0.45;
const VOLUME = 0.7;
/** «Квінта»: без терції — однаково чесна в мажорній і мінорній пісні. */
const CHORD = [0, 7, 12, 19];

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
/** Корені F♯2…F3: тепло, але не каламутно. */
const rootMidi = (pitchClass: number) => (pitchClass <= 5 ? 48 : 36) + pitchClass;
const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

interface Graph {
  ctx: AudioContext;
  padBus: GainNode;
  shimBus: GainNode;
  subBus: GainNode;
}

interface Voice {
  envelopes: GainNode[];
  sources: AudioScheduledSourceNode[];
}

let graph: Graph | null = null;
let voice: Voice | null = null;

/** Змусити ноду обробляти рівно один канал (стерео на вході сумується в моно). */
const mono = <T extends AudioNode>(node: T): T => {
  node.channelCount = 1;
  node.channelCountMode = "explicit";
  node.channelInterpretation = "speakers";
  return node;
};

function lfo(ctx: AudioContext, rate: number, at?: number): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.frequency.value = rate;
  osc.start(at ?? ctx.currentTime);
  return osc;
}

/** Ведемо параметр осцилятором на глибину `depth`. */
function modulate(ctx: AudioContext, source: AudioNode, param: AudioParam, depth: number) {
  const amount = ctx.createGain();
  amount.gain.value = depth;
  source.connect(amount).connect(param);
}

/** Моно-імпульс реверба: шум, що темнішає, згасаючи. */
function makeImpulse(ctx: AudioContext, seconds = 6): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  let y = 0;
  for (let i = 0; i < length; i++) {
    const p = i / length;
    const a = 0.55 * (1 - p) + 0.04;
    y += a * (Math.random() * 2 - 1 - y);
    data[i] = y * Math.pow(1 - p, 2.2) * (i < rate * 0.02 ? i / (rate * 0.02) : 1);
  }
  return buffer;
}

function buildGraph(): Graph {
  const ctx = Tone.getContext().rawContext as unknown as AudioContext;

  // Вихід: моно-сигнал лише в ЛІВИЙ вхід мерджера; правий лишається тишею.
  const merger = ctx.createChannelMerger(2);
  Tone.connect(merger, Tone.getDestination());
  const trim = ctx.createGain();
  trim.connect(merger, 0, 0);
  padTrim.bind(trim, (db) => trim.gain.setTargetAtTime(Tone.dbToGain(db), ctx.currentTime, 0.05));

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.05;
  compressor.release.value = 0.4;
  const master = mono(ctx.createGain());
  master.gain.value = VOLUME * VOLUME * 0.9;
  master.connect(compressor).connect(trim);

  // Пед: highpass (місце для суба) → lowpass → рухомий формант → западина у
  // вокальному діапазоні.
  const padBus = mono(ctx.createGain());
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 110;
  highpass.Q.value = 0.6;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.Q.value = 0.9;
  const cutoff = 180 * Math.pow(2, BRIGHT * 6);
  lowpass.frequency.value = cutoff;
  const formant = ctx.createBiquadFilter();
  formant.type = "peaking";
  formant.frequency.value = 800;
  formant.Q.value = 2.2;
  formant.gain.value = 7 * MOVE;
  const dip = ctx.createBiquadFilter();
  dip.type = "peaking";
  dip.frequency.value = 2200;
  dip.Q.value = 0.8;
  dip.gain.value = -3;
  padBus.connect(highpass).connect(lowpass).connect(formant).connect(dip);

  // Формант повільно ходить «а-о-у» — рух, що виживає в моно, замість ширини.
  modulate(ctx, lfo(ctx, 0.037), formant.frequency, 420 * MOVE);
  modulate(ctx, lfo(ctx, 0.013), formant.frequency, 220 * MOVE);

  // Реверб із передзатримкою: сухий пед спереду, хвіст позаду — глибина замість ширини.
  const dry = ctx.createGain();
  dry.gain.value = 1 - SPACE * 0.5;
  const wet = ctx.createGain();
  wet.gain.value = SPACE * 1.3;
  const preDelay = ctx.createDelay(0.2);
  preDelay.delayTime.value = 0.07;
  const convolver = mono(ctx.createConvolver());
  convolver.buffer = makeImpulse(ctx);
  const wetHighpass = ctx.createBiquadFilter();
  wetHighpass.type = "highpass";
  wetHighpass.frequency.value = 180;
  dip.connect(dry).connect(master);
  dip.connect(preDelay);
  preDelay.connect(convolver).connect(wetHighpass).connect(wet).connect(master);

  // Мерехтіння живе переважно в ревербі.
  const shimBus = mono(ctx.createGain());
  shimBus.gain.value = SHIMMER * 1.4;
  const shimDry = ctx.createGain();
  shimDry.gain.value = 0.25;
  shimBus.connect(shimDry).connect(master);
  shimBus.connect(preDelay);

  // Суб лишається сухим, щоб низ був щільним.
  const subBus = mono(ctx.createGain());
  subBus.gain.value = SUB * 0.9;
  const subLowpass = ctx.createBiquadFilter();
  subLowpass.type = "lowpass";
  subLowpass.frequency.value = 180;
  subBus.connect(subLowpass).connect(master);

  // Фільтр дихає двома осциляторами непов'язаних частот — малюнок не
  // повторюється точно…
  modulate(ctx, lfo(ctx, 0.06), lowpass.frequency, cutoff * 0.3 * MOVE);
  modulate(ctx, lfo(ctx, 0.023), lowpass.frequency, cutoff * 0.25 * MOVE);

  // …і раз на кілька секунд дрейфує до нової випадкової цілі.
  const wander = ctx.createConstantSource();
  wander.offset.value = 0;
  wander.start();
  modulate(ctx, wander, lowpass.frequency, cutoff * 0.35 * MOVE);
  const drift = () => {
    if (voice) wander.offset.setTargetAtTime(Math.random() * 2 - 1, ctx.currentTime, 2.5);
    setTimeout(drift, 4000 + Math.random() * 6000);
  };
  drift();

  return {ctx, padBus, shimBus, subBus};
}

function makeVoice({ctx, padBus, shimBus, subBus}: Graph, pitchClass: number): Voice {
  const t = ctx.currentTime;
  const root = rootMidi(pitchClass);
  const sources: AudioScheduledSourceNode[] = [];
  const envelopes = [padBus, shimBus, subBus].map((bus) => {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(bus);
    return g;
  });
  const [padEnv, shimEnv, subEnv] = envelopes;

  const voiceLfo = (rate: number) => {
    const osc = lfo(ctx, rate, t);
    sources.push(osc);
    return osc;
  };

  // Пед: по 5 пил на тон акорду, розстроєних тісно (±6 центів) — у моно широка
  // розстройка б'ється різко.
  const perSaw = 0.9 / (CHORD.length * 5);
  for (const interval of CHORD) {
    const level = interval >= 12 ? 0.7 : 1;
    // Кожен тон набухає й відступає сам по собі — голосоведення весь час зсувається.
    const toneGain = ctx.createGain();
    toneGain.gain.value = level;
    toneGain.connect(padEnv);
    modulate(ctx, voiceLfo(between(0.015, 0.06)), toneGain.gain, level * 0.45 * MOVE);
    // Два дрейфи на тон; крайні пили розходяться в протилежні боки, тож биття
    // то пришвидшується, то відпускає.
    const drifts = [voiceLfo(between(0.04, 0.2)), voiceLfo(between(0.04, 0.2))];
    [-6, -3, 0, 3, 6].forEach((detune, j) => {
      const saw = ctx.createOscillator();
      saw.type = "sawtooth";
      saw.frequency.value = hz(root + interval);
      saw.detune.value = detune + (Math.random() - 0.5) * 2;
      const g = ctx.createGain();
      g.gain.value = perSaw;
      saw.connect(g).connect(toneGain);
      if (detune !== 0) modulate(ctx, drifts[j % 2], saw.detune, (detune > 0 ? 5 : -5) * MOVE);
      saw.start(t);
      sources.push(saw);
    });
  }

  // Мерехтіння: октави над коренем і квінтою, з повільним тремоло.
  [24, 31, 36].forEach((interval, i) => {
    const osc = ctx.createOscillator();
    osc.type = i === 2 ? "sine" : "triangle";
    osc.frequency.value = hz(root + interval);
    const g = ctx.createGain();
    g.gain.value = 0.05;
    modulate(ctx, voiceLfo(between(0.1, 0.35)), g.gain, 0.045 * MOVE);
    osc.connect(g).connect(shimEnv);
    modulate(ctx, voiceLfo(between(0.05, 0.2)), osc.detune, 5 * MOVE);
    osc.start(t);
    sources.push(osc);
  });

  // Суб: синус на октаву нижче кореня.
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.value = hz(root - 12);
  const subGain = ctx.createGain();
  subGain.gain.value = 0.35;
  sub.connect(subGain).connect(subEnv);
  sub.start(t);
  sources.push(sub);

  return {envelopes, sources};
}

function fadeIn(v: Voice, ctx: AudioContext) {
  const t = ctx.currentTime;
  for (const g of v.envelopes) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + DRONE_FADE_SECONDS);
  }
}

function fadeOut(v: Voice, ctx: AudioContext) {
  const t = ctx.currentTime;
  for (const g of v.envelopes) {
    const p = g.gain;
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
    else {
      const current = p.value;
      p.cancelScheduledValues(t);
      p.setValueAtTime(current, t);
    }
    p.linearRampToValueAtTime(0, t + DRONE_FADE_SECONDS);
  }
  const end = t + DRONE_FADE_SECONDS + 0.2;
  for (const s of v.sources) {
    try {
      s.stop(end);
    } catch {
      // уже зупинений
    }
  }
  setTimeout(() => v.envelopes.forEach((g) => g.disconnect()), (DRONE_FADE_SECONDS + 0.5) * 1000);
}

/**
 * Дрон у тональності `pitchClass` (0 = C … 11 = B) набирає гучність за
 * `DRONE_FADE_SECONDS`. Якщо дрон уже звучить, старий згасає за той самий час —
 * тиші між ними немає. Контекст мусить бути вже розблокований (`Tone.start`).
 */
export function startDrone(pitchClass: number) {
  graph ??= buildGraph();
  const previous = voice;
  voice = makeVoice(graph, pitchClass);
  fadeIn(voice, graph.ctx);
  if (previous) fadeOut(previous, graph.ctx);
}

/** Дрон згасає за `DRONE_FADE_SECONDS`. */
export function stopDrone() {
  if (!graph || !voice) return;
  fadeOut(voice, graph.ctx);
  voice = null;
}
