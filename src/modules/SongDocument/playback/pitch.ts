/**
 * Запис вокалу (PLAY-60…): заспіване в мікрофон → ноти piano roll. Без звуку
 * й DOM — лише числа, тож під тестами.
 *
 * 1. `pitchTrack` — висота по кадрах (YIN, de Cheveigné & Kawahara 2002) на
 *    сигналі, прорідженому до ~12 кГц: голосу вистачає, а телефон рахує
 *    хвилину запису за долі секунди. Кадр — 10 мс.
 * 2. `sungNotes` — кадри → ноти: півтон — найближчий до медіани ноти; нова
 *    нота — коли висота стабільно пішла від поточної (вібрато й легке
 *    «запливання» ноту не рвуть) або після тиші. Коротше за `MIN_NOTE` — шум.
 * 3. `placeNotes` — секунди аудіоконтексту → рядки й тіки пісні за тим, як
 *    програвач реально клав рядки в час (`Played`), з поправкою на затримку
 *    звуку й вирівнюванням до комірок масштабу людини.
 *
 * Сам звук ніде не зберігається — лише ноти, що з нього витягнуто.
 */
import { TICKS } from "../model";

/** Кадр: `time` — секунди від першого семпла, `midi` — дробова висота, `null` — тиша чи шум. */
export type PitchFrame = { time: number; midi: number | null };

const TARGET_RATE = 12000;
const FRAME_SEC = 0.01;
/** Вікно YIN: 32 мс — і найнижчий бас (~70 Гц) має в ньому два періоди. */
const WINDOW_SEC = 0.032;
const MIN_HZ = 70;
const MAX_HZ = 1100;
/** Поріг CMND: нижче — кадр «голосний» (періодичний). */
const YIN_THRESHOLD = 0.15;
const VOICED_MAX = 0.3;

/**
 * Висота по кадрах. `samples` — моно, `rate` — їхня частота дискретизації.
 * Тихі кадри (нижче порогу від гучності всього запису) — тиша.
 */
export function pitchTrack(samples: Float32Array, rate: number): PitchFrame[] {
  const factor = Math.max(1, Math.round(rate / TARGET_RATE));
  const sr = rate / factor;
  const x = new Float32Array(Math.floor(samples.length / factor));
  for (let i = 0; i < x.length; i++) {
    let sum = 0;
    for (let k = 0; k < factor; k++) sum += samples[i * factor + k];
    x[i] = sum / factor; // середнє — грубий фільтр низьких перед проріджуванням
  }
  const W = Math.round(WINDOW_SEC * sr);
  const hop = Math.round(FRAME_SEC * sr);
  const tauMin = Math.floor(sr / MAX_HZ);
  const tauMax = Math.min(Math.ceil(sr / MIN_HZ), W);
  const count = Math.max(0, Math.floor((x.length - W - tauMax) / hop) + 1);

  const rms = new Float32Array(count);
  for (let f = 0; f < count; f++) {
    let e = 0;
    for (let j = 0; j < W; j++) e += x[f * hop + j] ** 2;
    rms[f] = Math.sqrt(e / W);
  }
  // Поріг гучності — від самого запису: шум кімнати тихий, а голос гучніший у рази.
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.2)] ?? 0;
  const peak = sorted[Math.floor(sorted.length * 0.98)] ?? 0;
  // Співали без пауз — «шум» і є голос: тоді поріг — частка піку, а не втричі над ним.
  const gate = Math.max(0.002, Math.min(floor * 3, peak * 0.3), peak * 0.08);

  const d = new Float32Array(tauMax + 1);
  const frames: PitchFrame[] = [];
  for (let f = 0; f < count; f++) {
    const time = (f * hop + W / 2) / sr;
    if (rms[f] < gate) {
      frames.push({ time, midi: null });
      continue;
    }
    const at = f * hop;
    for (let tau = 1; tau <= tauMax; tau++) {
      let sum = 0;
      for (let j = 0; j < W; j++) {
        const diff = x[at + j] - x[at + j + tau];
        sum += diff * diff;
      }
      d[tau] = sum;
    }
    // Кумулятивна нормалізована різниця (CMND).
    let running = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      running += d[tau];
      d[tau] = running ? (d[tau] * tau) / running : 1;
    }
    // Перший провал нижче порогу (до дна), а без нього — найглибший.
    let best = -1;
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (d[tau] >= YIN_THRESHOLD) continue;
      while (tau < tauMax && d[tau + 1] < d[tau]) tau++;
      best = tau;
      break;
    }
    if (best < 0) for (let tau = tauMin; tau <= tauMax; tau++) if (best < 0 || d[tau] < d[best]) best = tau;
    if (best < 0 || d[best] > VOICED_MAX) {
      frames.push({ time, midi: null });
      continue;
    }
    // Параболічне уточнення провалу — висота точніша за крок у семпл.
    let tau = best;
    if (best > 1 && best < tauMax) {
      const [a, b, c] = [d[best - 1], d[best], d[best + 1]];
      const den = a - 2 * b + c;
      if (den > 0) tau = best + (a - c) / (2 * den);
    }
    frames.push({ time, midi: 69 + 12 * Math.log2(sr / tau / 440) });
  }
  return frames;
}

/** Заспівана нота: `start`, `end` — секунди від першого семпла, `midi` — півтон. */
export type Sung = { start: number; end: number; midi: number };

/** Коротше — шум, приголосна чи ковзання між нотами. */
const MIN_NOTE = 0.07;
/** Відхід висоти від поточної ноти, з якого починається нова (півтонів), і скільки кадрів він має протриматись. */
const SPLIT_SEMITONES = 0.7;
const SPLIT_FRAMES = 5;
/** Провал «голосу» на стільки кадрів (тремтіння детектора посеред голосної) — не тиша. */
const BRIDGE_FRAMES = 2;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/** Кадри висоти → ноти. */
export function sungNotes(frames: readonly PitchFrame[]): Sung[] {
  const out: Sung[] = [];
  const step = frames.length > 1 ? frames[1].time - frames[0].time : FRAME_SEC;
  // Згладити медіаною з 5 кадрів (поодинокі промахи на октаву).
  const midi = frames.map((f, i) => {
    if (f.midi === null) return null;
    const around = frames.slice(Math.max(0, i - 2), i + 3).flatMap((g) => (g.midi === null ? [] : [g.midi]));
    return median(around);
  });
  let note: { from: number; to: number; pitches: number[] } | null = null;
  let gap = 0;
  let away: number[] = [];
  const close = () => {
    if (note && (note.to - note.from + 1) * step >= MIN_NOTE)
      out.push({ start: frames[note.from].time - step / 2, end: frames[note.to].time + step / 2, midi: Math.round(median(note.pitches)) });
    note = null;
    away = [];
  };
  midi.forEach((m, i) => {
    if (m === null) {
      if (note && ++gap > BRIDGE_FRAMES) close();
      return;
    }
    gap = 0;
    if (!note) return void (note = { from: i, to: i, pitches: [m] });
    const current = median(note.pitches.slice(-30));
    if (Math.abs(m - current) > SPLIT_SEMITONES) {
      away.push(i);
      if (away.length >= SPLIT_FRAMES) {
        const first = away[0];
        const pitches = away.map((j) => midi[j]!);
        note.to = first - 1;
        close();
        note = { from: first, to: i, pitches };
      }
      return;
    }
    away.forEach((j) => note!.pitches.push(midi[j]!));
    away = [];
    note.to = i;
    note.pitches.push(m);
  });
  close();
  return out;
}

/** Як програвач клав рядок у час: `at`…`end` — секунди аудіоконтексту, `from` — тік рядка в `at`, `spt` — секунд у тіку. */
export type PlayedSpan = { line: number; from: number; to: number; at: number; end: number; spt: number };

/** Нота, покладена в пісню: рядок і тіки від його початку. */
export type PlacedNote = { line: number; time: number; length: number; midi: number };

/**
 * Ноти (секунди від `t0` — моменту першого семпла запису в часі аудіоконтексту)
 * → рядки й тіки. `shift` — поправка на затримку (секунди, віднімається:
 * заспіване чути пізніше, ніж співали в такт). Початок і кінець — до комірки
 * `cellTicks`; нота хоч на комірку; нота через межу рядка рветься на дві;
 * сусідні ноти не налазять одна на одну (голос один). Що поза зіграним — геть.
 */
export function placeNotes(notes: readonly Sung[], spans: readonly PlayedSpan[], t0: number, shift: number, cellTicks: number): PlacedNote[] {
  const snap = (t: number) => Math.round(t / cellTicks) * cellTicks;
  const out: PlacedNote[] = [];
  notes.forEach((n) => {
    const [a, b] = [t0 + n.start - shift, t0 + n.end - shift];
    spans.forEach((s) => {
      if (b <= s.at || a >= s.end) return;
      const from = Math.max(s.from, snap(s.from + (Math.max(a, s.at) - s.at) / s.spt));
      const to = Math.min(s.to, snap(s.from + (Math.min(b, s.end) - s.at) / s.spt));
      // Нота, що лише зачепила рядок, у ньому не звучить; закоротка — на комірку.
      const covered = (Math.min(b, s.end) - Math.max(a, s.at)) / s.spt;
      if (covered < cellTicks / 2 || from >= s.to) return;
      out.push({ line: s.line, time: from, length: Math.max(cellTicks, to - from), midi: n.midi });
    });
  });
  // Голос один: попередня нота закінчується, де почалась наступна; на ту саму комірку — лишається пізніша.
  const sorted = out.sort((x, y) => x.line - y.line || x.time - y.time);
  return sorted.filter((n, i) => {
    const next = sorted[i + 1];
    if (next && next.line === n.line && next.time < n.time + n.length) n.length = next.time - n.time;
    return n.length > 0;
  });
}

/** Тіків у комірці масштабу `zoom` (комірок у цілій ноті). */
export const zoomCellTicks = (zoom: number) => Math.max(1, Math.round(TICKS / zoom));
