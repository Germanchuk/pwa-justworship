/**
 * Черга сегментів і правило «що доливати наступним».
 *
 * Теж чистий шар: приймає стан і позицію голки, повертає новий стан і список
 * проходів, які треба долити. Жодного Tone — тож поведінку рулону (коли
 * доливаємо, коли виходимо з лупа, коли закінчились) можна перевірити
 * таблицею, а не вухом.
 */

import type { PlaybackSegment } from "./model";
import { progressionBeats } from "./model";

export interface QueueState {
  segments: PlaybackSegment[];
  /** Індекс сегмента, який доливається зараз. */
  index: number;
  /** Абсолютний імпульс, з якого почнеться наступний долитий прохід. */
  cursorBeats: number;
  /** Прийшло «далі» — поточний луп доганяє свій прохід і поступається. */
  exitRequested: boolean;
  /** Черга вичерпана: доливати більше нічого. */
  finished: boolean;
}

export interface PendingPass {
  segment: PlaybackSegment;
  startBeats: number;
}

export const createQueueState = (
  segments: PlaybackSegment[],
  startBeats = 0,
): QueueState => ({
  segments,
  index: 0,
  cursorBeats: startBeats,
  exitRequested: false,
  finished: segments.length === 0,
});

/**
 * Скільки проходів долити, щоб рулон був заповнений на `horizonBeats` уперед
 * від голки.
 *
 * ЧОМУ ГОРИЗОНТ ВЗАГАЛІ ПОТРІБЕН: доливати треба РАНО (звук планується
 * наперед), а «далі» приходить ПІЗНО (натиснули на іншому пристрої, дорога по
 * вебсокету). Горизонт — це і буфер від затинань, і водночас затримка виходу з
 * лупа. Тримати його малим і є вся інженерія.
 *
 * ⚠️ Вихід із лупа зараз **на межі проходу**: попросили — доливаємо решту
 * поточного проходу й наступним іде вихід. Дрібніша межа (такт) вимагає
 * знімати вже долиті події з `Tone.Part`; це свідомо лишено на потім, коли
 * з'явиться справжній програш, на якому це можна почути.
 */
export function pullPasses(
  state: QueueState,
  playheadBeats: number,
  horizonBeats: number,
): { state: QueueState; passes: PendingPass[] } {
  const passes: PendingPass[] = [];
  let { index, cursorBeats, exitRequested, finished } = state;

  const target = playheadBeats + horizonBeats;

  while (!finished && cursorBeats < target) {
    const segment = state.segments[index];

    if (!segment) {
      finished = true;
      break;
    }

    const lengthBeats = progressionBeats(segment.progression);

    // Порожній сегмент проковтнув би планувальник у нескінченний цикл: він не
    // рухає курсор, а `while` дивиться саме на курсор. Тому просто пропускаємо.
    if (lengthBeats <= 0) {
      index += 1;
      exitRequested = false;
      continue;
    }

    if (segment.kind === "loop" && exitRequested) {
      index += 1;
      exitRequested = false;
      continue;
    }

    passes.push({ segment, startBeats: cursorBeats });
    cursorBeats += lengthBeats;

    if (segment.kind === "once") {
      index += 1;
    }
  }

  // Курсор міг дійти до горизонту рівно тоді, коли сегменти скінчились. Без
  // цієї перевірки стан казав би «ще не все», хоча доливати вже нема чого, — і
  // кінець призначався б лише на наступному доливанні.
  if (index >= state.segments.length) {
    finished = true;
  }

  return {
    state: { ...state, index, cursorBeats, exitRequested, finished },
    passes,
  };
}

/**
 * «Далі»: поточний луп грає свій прохід до кінця й поступається наступному
 * сегменту. На не-лупі не робить нічого — виходити нема звідки.
 */
export function requestExit(state: QueueState): QueueState {
  const segment = state.segments[state.index];
  if (!segment || segment.kind !== "loop") return state;
  if (state.exitRequested) return state;
  return { ...state, exitRequested: true };
}

/** Чи стоїть черга зараз на лупі — тобто чи є з чого виходити (кнопка «далі»). */
export const isOnLoop = (state: QueueState): boolean =>
  state.segments[state.index]?.kind === "loop";
