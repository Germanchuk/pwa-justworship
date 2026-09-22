/**
 * Черга сегментів і правило «що доливати наступним».
 *
 * Теж чистий шар: приймає стан і позицію голки, повертає новий стан і список
 * проходів, які треба долити. Жодного Tone — тож поведінку рулону (коли
 * доливаємо, коли виходимо з лупа, коли закінчились) можна перевірити
 * таблицею, а не вухом.
 */

import type { PlaybackSegment } from "./model";
import { pointOfSegment, progressionBeats } from "./model";

export interface QueueState {
  segments: PlaybackSegment[];
  /** Індекс сегмента, який доливається зараз. */
  index: number;
  /** Абсолютний імпульс, з якого почнеться наступний долитий прохід. */
  cursorBeats: number;
  /**
   * Прийшло «продовжити». На лупі — доганяє свій прохід і поступається; на
   * паузі — знімає зупинку. Прохання ОДНЕ на обидва види, бо в гурті це один
   * і той самий натиск: «ведучий доказав, ідемо далі» (`LIST-41`).
   */
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

    // ⚠️ ПАУЗА ЙДЕ ДО ПЕРЕВІРКИ НУЛЬОВОЇ ДОВЖИНИ. Вона теж нульова — і саме
    // тому нижня перевірка проковтнула б її мовчки, разом з усією зупинкою на
    // примітці. Тут же вона зупиняє доливання: далі не наливаємо нічого й
    // лишаємось на цьому індексі, доки не прийде «продовжити». Черга при цьому
    // НЕ вичерпана — попереду ще є що грати.
    if (segment.kind === "pause") {
      if (!exitRequested) break;
      index += 1;
      exitRequested = false;
      continue;
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
 * «Продовжити»: луп грає свій прохід до кінця й поступається наступному
 * сегменту, пауза знімається. На пісні не робить нічого — там нічого не чекає.
 *
 * Прохання з'їдається тим сегментом, на якому стояла черга (`pullPasses`
 * скидає прапорець разом із переходом далі). Інакше натиск на паузі виніс би
 * заразом і програш, що йде одразу за нею.
 *
 * `from` — пункт, на якому натиснули. Кнопку тисне будь-хто з гурту (`LIST-41`),
 * тож натиснути можуть двоє й одночасно: поки їхала друга команда, служіння вже
 * зійшло з тієї примітки, і на дві примітки підряд другий натиск проковтнув би
 * другу зупинку. Тому прохання адресне: не наш пункт — не наше прохання. Без
 * `from` діє на те, де черга стоїть, — так тисне той самий пристрій, що й грає.
 *
 * Стан НЕ МІНЯЄТЬСЯ (той самий об'єкт), коли робити нема чого: і на «вже
 * попросили», і на «не той пункт». Цим викликач і відрізняє прийняте прохання
 * від зайвого.
 */
export function requestExit(state: QueueState, from?: string): QueueState {
  const segment = state.segments[state.index];
  if (!segment) return state;
  if (segment.kind !== "loop" && segment.kind !== "pause") return state;
  if (from != null && pointOfSegment(segment) !== from) return state;
  if (state.exitRequested) return state;
  return { ...state, exitRequested: true };
}

/** Чи стоїть черга зараз на лупі — тобто чи є з чого виходити (кнопка «далі»). */
export const isOnLoop = (state: QueueState): boolean =>
  state.segments[state.index]?.kind === "loop";

/**
 * Чи стала черга на примітці. Курсор при цьому показує рівно межу зупинки:
 * пауза не має довжини, тож нічого після неї ще не долито.
 */
export const isOnPause = (state: QueueState): boolean =>
  state.segments[state.index]?.kind === "pause";

/**
 * Пункт, на якому черга чекає «продовжити», — або `null`, коли не чекає.
 *
 * Прохання, яке вже прийняте, знімає очікування одразу, хоч луп і доспівує свій
 * прохід: інакше кнопка висіла б до самого виходу (а це до двох кіл, `LIST-42`)
 * і збирала б повторні натиски, кожен з яких їхав би далі по черзі.
 */
export const awaitingPoint = (state: QueueState): string | null => {
  const segment = state.segments[state.index];
  if (!segment || state.exitRequested) return null;
  if (segment.kind !== "loop" && segment.kind !== "pause") return null;
  return pointOfSegment(segment);
};
