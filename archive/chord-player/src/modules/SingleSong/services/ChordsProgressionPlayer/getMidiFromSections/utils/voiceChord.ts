/**
 * «Натуральна апплікатура»: розкладаємо акорд, як піаніст.
 *
 * Три правила замість «всі тони в 4-й октаві»:
 * 1. Бас окремо внизу (тоніка або слеш-бас).
 * 2. Верхні голоси — компактне обернення біля середини клавіатури.
 * 3. Між сусідніми акордами обираємо обернення з мінімальним сумарним рухом
 *    голосів (голосоведення) — саме це прибирає «стрибучість» root position.
 */

export interface VoiceChordInput {
  /** Pitch class-и акорду (0–11); перший — тоніка. */
  chordPcs: number[];
  /** Pitch class басової ноти: тоніка або слеш-бас. */
  bassPc: number;
  /** Верхні голоси попереднього акорду — якір для голосоведення. */
  prevUpper?: number[] | null;
}

export interface VoicedChord {
  /** MIDI-номер басової ноти. */
  bass: number;
  /** MIDI-номери верхніх голосів, за зростанням. */
  upper: number[];
}

// Бас живе в A2..G#3. Нижче не спускаємось: піаніно — один семпл C4, і на
// дві октави вниз розтягнутий семпл звучить брудно.
const BASS_LOW = 45;
// Нижній верхній голос стартує в A3..G#4 — район середини клавіатури.
const UPPER_LOW = 57;
// М'яка стеля: верхівка вище E5 починає дзвеніти над вокалом.
const UPPER_SOFT_TOP = 76;
// Куди тяжіє перший акорд, коли попереднього ще нема (≈ E4).
const UPPER_CENTER = 64;

const mod12 = (v: number) => ((v % 12) + 12) % 12;

/** Єдине розміщення pitch class-а у 12-напівтоновому вікні, що починається з low. */
const placeFrom = (pc: number, low: number) => low + mod12(pc - low);

/**
 * Закрите обернення: стартуємо з cycle[startIndex] у вікні верхніх голосів,
 * кожен наступний тон кладемо на найближчу висоту строго вище попереднього.
 */
const stackFrom = (cycle: number[], startIndex: number): number[] => {
  const out = [placeFrom(cycle[startIndex], UPPER_LOW)];
  for (let i = 1; i < cycle.length; i++) {
    const pc = cycle[(startIndex + i) % cycle.length];
    const prev = out[out.length - 1];
    out.push(prev + 1 + mod12(pc - prev - 1));
  }
  return out;
};

const sumNearest = (from: number[], to: number[]) =>
  from.reduce((acc, n) => acc + Math.min(...to.map((p) => Math.abs(n - p))), 0);

/**
 * Менше — краще. З попереднім акордом міряємо сумарний рух голосів (симетрично,
 * бо кількість голосів може відрізнятись); без нього — тяжіння до центру.
 */
const scoreCandidate = (candidate: number[], prevUpper?: number[] | null): number => {
  const top = candidate[candidate.length - 1];
  const topPenalty = Math.max(0, top - UPPER_SOFT_TOP) * 2;
  if (!prevUpper || prevUpper.length === 0) {
    const mean = candidate.reduce((a, b) => a + b, 0) / candidate.length;
    return Math.abs(mean - UPPER_CENTER) + topPenalty;
  }
  return sumNearest(candidate, prevUpper) + sumNearest(prevUpper, candidate) + topPenalty;
};

export function voiceChord({chordPcs, bassPc, prevUpper}: VoiceChordInput): VoicedChord {
  const bass = placeFrom(mod12(bassPc), BASS_LOW);

  const uniquePcs = [...new Set(chordPcs.map(mod12))];
  // У септакордах і ширше басовий тон зверху не дублюємо — його веде бас.
  // Тріаду лишаємо повною: без тоніки зверху зостануться дві ноти, буде тонко.
  const withoutBassPc = uniquePcs.filter((pc) => pc !== mod12(bassPc));
  const upperPcs = uniquePcs.length >= 4 && withoutBassPc.length > 0 ? withoutBassPc : uniquePcs;

  const cycle = [...upperPcs].sort((a, b) => a - b);
  let best: number[] = [];
  let bestScore = Infinity;
  for (let k = 0; k < cycle.length; k++) {
    const candidate = stackFrom(cycle, k);
    const score = scoreCandidate(candidate, prevUpper);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return {bass, upper: best};
}
