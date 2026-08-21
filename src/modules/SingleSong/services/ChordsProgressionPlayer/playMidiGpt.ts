import * as Tone from "tone";
import {getPadPresetDef, type PadPreset, type PadVoice} from "./createPad/padPresets";
import {createPiano} from "./createPiano/createPiano";
import {DEFAULT_BPM, DEFAULT_TIME_SIGNATURE} from "./songDefaults";
import type {PlannedChord, PlaybackSegment} from "./segments/model";
import {barBeats} from "./segments/model";
import {planPass} from "./segments/planPass";
import {planTempoTransition, type TempoState} from "./segments/tempoTransition";
import {
  awaitingPoint,
  createQueueState,
  isOnLoop,
  isOnPause,
  pullPasses,
  requestExit,
  type QueueState,
} from "./segments/queue";

/** Tone-ове позначення часу; ми вживаємо тільки тікову форму `"<n>i"`. */
type ToneTime = string | number;

interface NoteEvent {
  time: ToneTime;
  name: string;
  duration: ToneTime;
  velocity: number;
}

/**
 * Наскільки вперед від голки тримаємо рулон заповненим (в імпульсах).
 *
 * Це компроміс, а не константа зі стелі: більший горизонт = надійніший буфер
 * від затинань, але й довша затримка виходу з лупа, бо долите вже звучатиме.
 * Два такти 4/4 — досить, щоб пережити збірку сміття, і мало, щоб «далі»
 * лишалось живим.
 */
const DEFAULT_HORIZON_BEATS = 8;

export interface PlayOptions {
  metronome?: boolean;     // default: true
  metronomePan?: number;   // -1..1; 1 — правий
  introBars?: number;      // кількість тактів вступного кліку перед відтворенням
  padVolume?: number;      // дБ
  pianoVolume?: number;    // дБ
  padPreset?: PadPreset;   // default залежить від плеєра (defaultPlayer → "classic")
  piano?: boolean;         // грати піаніно-стаб поверх пада; default: true
  humanize?: number;       // множник гуманізації; 0 — механічно
  random?: () => number;   // джерело випадковості (тести)
  horizonBeats?: number;
  onEnded?: () => void;
  /** Підсвітка: що звучить зараз. `null` — не звучить нічого. */
  onChord?: (chord: PlannedChord | null) => void;
  /**
   * Пункт, на якому служіння чекає «продовжити», — або `null`, коли не чекає.
   *
   * Чекає воно двома способами — стоячи на примітці й крутячи луп програша, —
   * і для того, хто тисне кнопку, це одне й те саме очікування. Тому назовні
   * йде одне значення, а не два прапорці. Не «чи чекає», а «на чому»: натиск
   * їде назад тим самим пунктом і тим доводить, що продовжують саме ЦЮ
   * зупинку (`requestExit`).
   */
  onAwaitingContinue?: (point: string | null) => void;
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
  /**
   * «Продовжити»: зняти зупинку на примітці або вийти з лупа програша.
   * `from` — пункт, на якому натиснули; чужий пункт черга не бере.
   */
  next(from?: string): void;
  /** Чи є зараз із чого виходити — тобто чи показувати кнопку «далі». */
  isOnLoop(): boolean;
}

/**
 * Імпульси → тіки транспорту (про імпульс див. модель часу в `songDefaults`).
 * Імпульс лягає на чверть транспорту, бо BPM рахує саме імпульси. Плануємо все
 * в тіках, тому таймінг нот не залежить від темпу: bpm застосовується рівно
 * один раз — на транспорті, і може мінятись у польоті, нічого не ламаючи.
 */
function beatsToTicks(beats: number): ToneTime {
  return `${Math.round(beats * Tone.Transport.PPQ)}i`;
}

/**
 * На тік РАНІШЕ за вказаний імпульс — цим ставимо транспорт на примітці.
 *
 * Тік не можна зупиняти на самій межі: подія, що прийшла в тіку `T`, приходить
 * ПІД ЧАС його обробки, тобто все, що на `T` призначено, вже роздано. Матеріал,
 * долитий після «продовжити», починається рівно з `T` — і на ньому транспорт
 * уже не спинився б, а проскочив би його мовчки. Тік — це 1/192 імпульсу, тож
 * музично цієї різниці немає.
 */
function beatsToTicksBefore(beats: number): ToneTime {
  return `${Math.max(0, Math.round(beats * Tone.Transport.PPQ) - 1)}i`;
}

function setupTransport(num: number, bpm: number) {
  const Transport = Tone.Transport;
  Transport.cancel();
  Transport.stop();
  Transport.position = 0;
  // Розмір віддаємо одним числом — це «стільки чвертей у такті». Пара
  // `[num, den]` тут була б хибною: Tone порахував би такт 6/8 як три чверті,
  // тоді як у нашій моделі це шість імпульсів, тобто шість чвертей транспорту.
  Transport.timeSignature = num;
  Transport.bpm.cancelScheduledValues(0);
  Transport.bpm.value = bpm;
  return Transport;
}

function createPart(players: { pad?: PadVoice; piano?: Tone.Sampler }) {
  // Порожній на старті: матеріал дописується в польоті через `part.add`.
  const part = new Tone.Part<NoteEvent>((time, e) => {
    players.pad?.triggerAttackRelease(e.name, e.duration, time, e.velocity);
    players.piano?.triggerAttackRelease(e.name, e.duration, time, e.velocity);
  }, [] as NoteEvent[]);
  part.loop = false;
  return part;
}

/**
 * Клацає на кожен імпульс, тож інтервал завжди `"4n"` — імпульс і є чверть
 * транспорту. Темп може мінятись у польоті: цикл прив'язаний до транспорту,
 * тож клік їде за темпом сам.
 *
 * Усі кліки однакові — без сильної долі (рішення Германа 2026-08-13). Акценти
 * пробували двома способами, обидва звучали чужорідно: інша висота читається
 * як нота в тональності пісні (MembraneSynth виражено тональний), а сама ідея
 * сильної долі вимагає знати, де такт починається — чого метроном не знає,
 * бо рахує фіксований цикл, а не тактові риски пісні.
 */
const TICK_PITCH = "C4";
const TICK_VELOCITY = 0.7;

function createMetronome({ pan = 1 }: { pan?: number }): MetronomeCtrl {
  const tick = new Tone.MembraneSynth({
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
    volume: 8,
  });
  const panner = new Tone.Panner(pan).toDestination();
  tick.connect(panner);

  const loop = new Tone.Loop((time) => {
    tick.triggerAttackRelease(TICK_PITCH, "16n", time, TICK_VELOCITY);
  }, "4n");

  return {
    start(at: ToneTime = 0) { loop.start(at); },
    stop() { loop.stop(); },
    dispose() { loop.dispose(); tick.dispose(); panner.dispose(); },
  };
}

function setDestinationVolumeImmediately(volume: number) {
  const destination = Tone.Destination;
  destination.volume.cancelAndHoldAtTime(destination.context.currentTime);
  destination.volume.value = volume;
}

// =================== КЛАС ===================

/**
 * РУЛОННИЙ плеєр: транспорт, пад, піаніно й `Tone.Part` живуть наскрізь, а
 * матеріал **дописується перед голкою** по мірі програвання.
 *
 * Чим це відрізняється від того, що було: раніше `play()` будував увесь MIDI
 * наперед і грав його одним шматком, тож будь-яка зміна означала знести все й
 * відбудувати — з паузою на завантаження семплів і скиданням транспорту в нуль.
 * Тепер `play()` викликається один раз на все служіння, а пісні, програші й
 * зміни темпу під'їжджають у чергу.
 *
 * Що лишилось незмінним і чому це важливо: усе планується в ТІКАХ. Саме тому
 * темп можна вести плавно (`rampTempo`) або міняти стрибком на межі сегмента,
 * і жодна вже запланована нота від цього не з'їжджає.
 */
export class MidiPlayer {
  private part: Tone.Part<NoteEvent> | null = null;
  private metro: MetronomeCtrl | null = null;
  private pad: PadVoice | null = null;
  private piano: Tone.Sampler | null = null;
  private state: MidiPlayerState = "idle";
  private fadeTimerId: number | null = null;

  private queue: QueueState | null = null;
  private opts: PlayOptions = {};
  /** Id усіх подій, які ми поклали на транспорт (підсвітка, темп, кінець). */
  private scheduledIds: number[] = [];
  private topUpId: number | null = null;
  private endId: number | null = null;
  /** Сегмент, для якого вже застосовані темп і розмір. */
  private appliedSegmentId: string | null = null;
  /** Темп і розмір, у які транспорт уже переведений. `null` — ще нічого. */
  private tempo: TempoState | null = null;
  /** Голка стоїть на примітці: транспорт справді зупинений (`LIST-37`). */
  private stoppedAtPause = false;
  /** Імпульс, на якому вже призначена зупинка. `null` — не призначена. */
  private pauseArmedAt: number | null = null;
  /** Останнє, що ми сказали назовні про очікування, — щоб не повторюватись. */
  private awaitingAt: string | null = null;

  constructor(private defaults: PlayOptions = {}) {}

  getState(): MidiPlayerState {
    return this.state;
  }

  isOnLoop(): boolean {
    return this.queue != null && isOnLoop(this.queue);
  }

  /**
   * Пункт, на якому служіння чекає «продовжити», — або `null`, коли не чекає.
   * Два різні очікування, одна відповідь: на примітці стоїть транспорт, у лупі
   * програша крутиться прохід — а для того, хто дивиться на кнопку, це
   * однаково «далі буде, коли ми скажемо».
   *
   * ⚠️ У ЛУПІ це рахується від того, що ЗАЛИВАЄТЬСЯ, а не від того, що звучить:
   * черга йде попереду голки на горизонт (до двох тактів), тож кнопка
   * з'являється трохи раніше, ніж чути луп (`LIST-42`).
   *
   * На ПРИМІТЦІ такої вільності немає навмисно: чекаємо лише тоді, коли
   * транспорт справді став. Кнопка, показана до тиші, повела б служіння повз
   * саму зупинку — тобто рівно повз те, заради чого примітка й існує.
   */
  awaitingContinueAt(): string | null {
    if (!this.queue) return null;
    const point = awaitingPoint(this.queue);
    if (point == null) return null;
    if (isOnPause(this.queue) && !this.stoppedAtPause) return null;
    return point;
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

  private clearScheduled() {
    this.scheduledIds.forEach((id) => Tone.Transport.clear(id));
    this.scheduledIds = [];
    this.pauseArmedAt = null;
    if (this.topUpId != null) {
      Tone.Transport.clear(this.topUpId);
      this.topUpId = null;
    }
    this.endId = null;
  }

  /**
   * @param segments черга на відтворення. Пісня — це черга з одного `once`.
   */
  async play(segments: PlaybackSegment[], opts: PlayOptions = {}): Promise<MidiPlaybackControls> {
    this.setState("loading");
    await Tone.start();
    // Чистий старт. `dispose` знімає і транспортні події, і синти, тож окремої
    // перевірки «а чи ми грали» не треба — вона однаково була б хибною після
    // переходу в `loading` вище.
    this.dispose();

    this.opts = { ...this.defaults, ...opts };

    const first = segments[0];
    const bpm = first?.bpm ?? DEFAULT_BPM;
    const timeSignature = first?.timeSignature ?? DEFAULT_TIME_SIGNATURE;
    const Transport = setupTransport(timeSignature[0], bpm);

    const introBars = Math.max(0, this.opts.introBars ?? 1);
    // Такт вступу рахуємо в імпульсах, а не через Tone-ове `"1m"`: воно міряє
    // такт відносно знаменника, і на розмірах на кшталт 6/8 розійшлося б із
    // тим, як такт розуміє лексер акордів.
    const introBeats = introBars * barBeats(timeSignature);

    const preset = this.opts.padPreset ?? "classic";
    this.pad = getPadPresetDef(preset).create();
    if (typeof this.opts.padVolume === "number") {
      this.pad.volume.value = this.opts.padVolume;
    }

    // Піаніно — додатковий "стаб" поверх пада. Якщо вимкнено (`piano: false`),
    // пед лишається основним (і єдиним) звуком.
    const wantPiano = this.opts.piano !== false;
    this.piano = wantPiano ? createPiano() : null;
    if (this.piano && typeof this.opts.pianoVolume === "number") {
      this.piano.volume.value = this.opts.pianoVolume;
    }

    await Tone.loaded();

    this.part = createPart({ pad: this.pad, piano: this.piano ?? undefined });
    this.part.start(0);

    this.queue = createQueueState(segments, introBeats);
    this.appliedSegmentId = null;
    this.tempo = null;
    this.stoppedAtPause = false;
    this.pauseArmedAt = null;
    this.awaitingAt = null;

    if (this.opts.metronome !== false) {
      this.metro = createMetronome({ pan: this.opts.metronomePan ?? 1 });
      this.metro.start(0);
    }

    // Перше заповнення — до старту транспорту, щоб перший такт уже мав ноти.
    this.topUp();
    // Далі доливаємо щоімпульсу. Виклик дешевий: коли доливати нічого, черга
    // одразу віддає порожній список.
    this.topUpId = Transport.scheduleRepeat(() => this.topUp(), "4n");

    this.clearFadeTimer();
    setDestinationVolumeImmediately(0);

    Transport.start();
    this.setState("playing");
    // Служіння, що починається з примітки, стане на ній саме: зупинка вже
    // призначена першим заповненням, і з такту вступного кліку вона знімає
    // рівно цей такт.
    this.emitAwaiting();

    return {
      stop: (options) => this.stop(options),
      pause: () => this.pause(),
      resume: () => this.resume(),
      dispose: () => this.dispose(),
      getState: () => this.getState(),
      next: (from) => this.next(from),
      isOnLoop: () => this.isOnLoop(),
    };
  }

  /**
   * «Продовжити» (`LIST-41`). На лупі — прохання вийти наприкінці проходу; на
   * примітці — зняти зупинку й пустити транспорт далі просто зараз.
   */
  next(from?: string) {
    if (!this.queue) return;
    const asked = requestExit(this.queue, from);
    // Черга не взяла прохання: або вже попросили, або тиснули на іншій
    // зупинці й команда спізнилась. Рушати транспорт на такому натиску
    // означало б проїхати зупинку, якої той, хто тиснув, і не бачив.
    if (asked === this.queue) return;
    this.queue = asked;
    if (this.stoppedAtPause) this.leavePause();
    this.emitAwaiting();
  }

  /**
   * Зійти з примітки: долити наступне й аж потім пустити транспорт.
   *
   * Порядок саме такий, бо доливає нас транспорт (`scheduleRepeat`), а він
   * стоїть: пустити його порожнім означало б віддати перші імпульси наступної
   * пісні в тишу.
   */
  private leavePause() {
    this.stoppedAtPause = false;
    this.topUp({ afterContinue: true });
    // Друга примітка підряд — це друга зупинка, а не пропущена (`LIST-37`):
    // `topUp` знову стане на ній, і заводити транспорт знову нема для чого.
    if (this.stoppedAtPause) return;
    Tone.Transport.start();
    this.setState("playing");
  }

  /**
   * Стати на примітці. Це СПРАВЖНЯ зупинка транспорту, а не тиша в темп:
   * поки ведучий говорить, час не йде взагалі, тож накопичене очікування не
   * тягнеться в наступну пісню (`LIST-37`).
   *
   * @param time коли саме зупинитись; без нього — просто зараз. Транспортна
   * подія приходить із випередженням (`lookAhead`), тому час із неї треба
   * передати далі, інакше зупинка з'їла б хвіст попередньої пісні.
   */
  private stopAtPause(time?: number) {
    this.pauseArmedAt = null;
    if (this.stoppedAtPause) return;
    this.stoppedAtPause = true;
    if (Tone.Transport.state === "started") Tone.Transport.pause(time);
    this.setState("paused");
    this.opts.onChord?.(null);
    this.emitAwaiting();
  }

  /** Призначити зупинку на межі примітки — до неї ще грає попередній пункт. */
  private armPauseStop(atBeats: number) {
    if (this.pauseArmedAt != null) return;
    this.pauseArmedAt = atBeats;
    const id = Tone.Transport.scheduleOnce(
      (time) => this.stopAtPause(time),
      beatsToTicksBefore(atBeats),
    );
    this.scheduledIds.push(id);
  }

  private emitAwaiting() {
    const point = this.awaitingContinueAt();
    if (point === this.awaitingAt) return;
    this.awaitingAt = point;
    this.opts.onAwaitingContinue?.(point);
  }

  /**
   * Долити матеріал так, щоб попереду голки лишався заповнений горизонт.
   *
   * Викликається щоімпульсу з транспорту. Уся логіка «що саме доливати» живе в
   * чистій черзі (`pullPasses`) — тут лише побічні ефекти Tone.
   */
  private topUp({ afterContinue = false }: { afterContinue?: boolean } = {}) {
    if (!this.queue || !this.part) return;

    const playheadBeats = Tone.Transport.ticks / Tone.Transport.PPQ;
    const horizon = this.opts.horizonBeats ?? DEFAULT_HORIZON_BEATS;

    const { state, passes } = pullPasses(this.queue, playheadBeats, horizon);
    this.queue = state;

    for (const pending of passes) {
      this.applySegmentTransition(pending.segment, pending.startBeats);

      const pass = planPass(pending.segment, pending.startBeats, {
        humanize: this.opts.humanize,
        random: this.opts.random,
      });

      for (const note of pass.notes) {
        this.part.add({
          time: beatsToTicks(note.beats),
          name: Tone.Frequency(note.midi, "midi").toNote(),
          duration: beatsToTicks(note.durationBeats),
          velocity: note.velocity,
        });
      }

      for (const chord of pass.chords) {
        const id = Tone.Transport.scheduleOnce(() => {
          this.opts.onChord?.(chord);
        }, beatsToTicks(chord.beats));
        this.scheduledIds.push(id);
      }
    }

    // Черга стала на примітці. Пауза не має довжини, тож її межа — рівно
    // курсор: усе до неї вже долито, після неї ще нічого немає.
    if (isOnPause(this.queue)) {
      // `afterContinue` — нас покликало «продовжити», тобто ми стоїмо рівно на
      // цій межі, а за нею одразу друга примітка. Призначати нема на коли:
      // другу зупинку робимо просто зараз, транспорт і так ще не пущено.
      if (afterContinue) this.stopAtPause();
      else this.armPauseStop(this.queue.cursorBeats);
    }
    this.emitAwaiting();

    // Черга вичерпалась — призначаємо кінець там, де закінчиться долите.
    if (this.queue.finished && this.endId == null) {
      const id = Tone.Transport.scheduleOnce(() => {
        this.endId = null;
        this.stop({ hard: true });
        this.opts.onChord?.(null);
        this.opts.onEnded?.();
      }, beatsToTicks(this.queue.cursorBeats));
      this.endId = id;
      this.scheduledIds.push(id);
    }
  }

  /**
   * Темп і розмір нового сегмента — рівно на його межі.
   *
   * Саме рішення (вести чи різати, і скільки секунд вести) живе в чистому
   * `planTempoTransition` — тут лишились три дії Tone. Розділено навмисно: це
   * єдине місце рулону, де вирішує музика, і перевіряти його вухом означало б
   * не перевіряти взагалі.
   */
  private applySegmentTransition(segment: PlaybackSegment, startBeats: number) {
    if (this.appliedSegmentId === segment.id) return;
    this.appliedSegmentId = segment.id;

    const plan = planTempoTransition(this.tempo, segment);

    const id = Tone.Transport.scheduleOnce((time) => {
      Tone.Transport.timeSignature = plan.barBeats;
      if (plan.rampSeconds > 0) {
        // ⚠️ САМЕ `linearRampTo`, а не Tone-ове `rampTo` (воно на одиницях `bpm`
        // веде експонентою): довжину рампу `planTempoTransition` рахує по
        // лінійному веденню — там і причина.
        Tone.Transport.bpm.linearRampTo(plan.bpm, plan.rampSeconds, time);
      } else {
        Tone.Transport.bpm.setValueAtTime(plan.bpm, time);
      }
    }, beatsToTicks(startBeats));
    this.scheduledIds.push(id);

    this.tempo = { bpm: segment.bpm, timeSignature: segment.timeSignature };
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
    // Стоїмо на примітці — звідти виводить лише «продовжити» (`next`), і
    // виводить разом із чергою. Пустити транспорт тут означало б грати далі
    // порожнечу: наступний пункт ще не долитий.
    if (this.stoppedAtPause) return;
    Tone.Transport.start();
    this.setState("playing");
  }

  stop({ hard = false, fadeOut = 0 }: { hard?: boolean; fadeOut?: number } = {}) {
    const Transport = Tone.Transport;

    this.clearScheduled();
    this.clearFadeTimer();
    this.queue = null;
    this.stoppedAtPause = false;
    this.emitAwaiting();

    if (fadeOut > 0) {
      Tone.Destination.volume.rampTo(-Infinity, fadeOut);
      this.fadeTimerId = Tone.getContext().setTimeout(() => {
        setDestinationVolumeImmediately(0);
      }, fadeOut);
    }

    this.metro?.stop();
    this.part?.stop();
    this.part?.clear();

    Transport.stop();
    if (hard) {
      Transport.cancel();
      Transport.position = 0;
    }

    this.setState("idle");
  }

  dispose() {
    this.clearScheduled();
    this.clearFadeTimer();
    this.queue = null;
    this.stoppedAtPause = false;
    this.emitAwaiting();
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

export async function playSegments(segments: PlaybackSegment[], opts?: PlayOptions) {
  return defaultPlayer.play(segments, opts);
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
