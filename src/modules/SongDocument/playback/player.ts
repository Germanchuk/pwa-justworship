/**
 * Програвач доріжок (ADR-0009): особиста репетиція, лише на цьому пристрої.
 *
 * Планує наперед, рядок за рядком: коли до початку наступного рядка лишається
 * `LOOKAHEAD`, бере його план зі свіжої пісні (`linePlan`) і ставить усі його
 * події на точний час аудіоконтексту. Тож правка рядка, до якого голка ще не
 * дійшла, уже звучить, а рядок, що грає, доїжджає як був. Рядок на повторі
 * перечитується на кожному колі. Темп і сховані доріжки теж читаються
 * порядково: зміна діє з наступного рядка.
 *
 * Перед стартом — відлік в один такт. Програвання глушить мій локальний дрон
 * (у навушниках був би другий клік); хоста звуку не чіпає.
 *
 * Синглтон: звук один на пристрій, а кнопки й голка живуть у різних місцях.
 */
import * as Tone from "tone";
import DronePlayer from "#modules/SingleSong/services/DronePlayer/DronePlayer";
import { DEFAULT_BPM } from "#modules/SingleSong/services/songChords/songDefaults";
import { barTicks, readMeta, Song, TICKS } from "../model";
import { createKit, type Kit } from "./instruments";
import { linePlan, nextLine, Span, tickSeconds } from "./timeline";

export type PlayState = "idle" | "count" | "playing";
/** Де зараз голка: рядок і тік від його початку. */
export type Needle = { line: number; tick: number };

type Start = {
  song: Song;
  from: Span;
  /** Сховані людиною доріжки — не звучать (читається порядково). */
  hidden: () => readonly string[];
  /** Особистий темп у відсотках (читається порядково). */
  percent: () => number;
};

/** Скільки секунд наперед планувати. */
const LOOKAHEAD = 0.25;
const TICK_MS = 25;

type Played = { span: Span; at: number; end: number; spt: number };

class LanePlayer {
  private state: PlayState = "idle";
  private listeners = new Set<() => void>();
  private session: {
    start: Start;
    kit: Kit;
    timer: ReturnType<typeof setInterval>;
    /** Коли починається ще не запланований рядок. */
    cursor: number;
    next: Span | null;
    played: Played[];
    /** Коли закінчується відлік. */
    countEnd: number;
    beat: number;
    beats: number;
  } | null = null;
  private loopSpan: Span | null = null;
  private generation = 0;

  getState = () => this.state;
  loop = () => this.loopSpan;

  listen = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };

  start = async (start: Start) => {
    this.stop();
    const generation = ++this.generation;
    await Tone.start();
    if (generation !== this.generation) return;
    DronePlayer.getInstance().stop();

    const ctx = Tone.getContext();
    const { timeSignature } = readMeta(start.song.doc);
    const spt = this.spt(start);
    const unitTicks = TICKS / (Number(timeSignature.split("/")[1]) || 4);
    const beats = Math.max(1, Math.round(barTicks(timeSignature) / unitTicks));
    const t0 = ctx.currentTime + 0.12;
    const kit = createKit();
    for (let i = 0; i < beats; i++) kit.click(t0 + i * unitTicks * spt);
    const countEnd = t0 + beats * unitTicks * spt;
    this.session = {
      start,
      kit,
      timer: setInterval(() => this.schedule(), TICK_MS),
      cursor: countEnd,
      next: start.from,
      played: [],
      countEnd,
      beat: unitTicks * spt,
      beats,
    };
    this.setState("count");
    this.schedule();
  };

  stop = () => {
    this.generation += 1;
    const s = this.session;
    if (!s) return;
    clearInterval(s.timer);
    s.kit.dispose();
    this.session = null;
    this.loopSpan = null; // повтор — лише поки грає
    this.setState("idle");
  };

  /** Повтор проміжку (`null` — без повтору), лише поки грає: діє з кінця рядка, що грає. */
  setLoop = (span: Span | null) => {
    const s = this.session;
    if (!s) return;
    this.loopSpan = span;
    // Ще не запланований наступний рядок — уже повтор.
    if (span) s.next = span;
    else {
      const last = s.played[s.played.length - 1];
      s.next = last ? nextLine(s.start.song, last.span.line, s.start.hidden()) : s.next;
    }
    this.notify();
  };

  /** Голка зараз; `null` — не грає або йде відлік. */
  needle = (): Needle | null => {
    const s = this.session;
    if (!s) return null;
    const now = Tone.getContext().currentTime;
    const p = s.played.find((x) => x.at <= now && now < x.end);
    return p ? { line: p.span.line, tick: p.span.from + (now - p.at) / p.spt } : null;
  };

  /** Скільки долей відліку лишилось (4, 3, 2, 1); `null` — відліку немає. */
  countLeft = (): number | null => {
    const s = this.session;
    if (!s) return null;
    const left = s.countEnd - Tone.getContext().currentTime;
    return left > 0 ? Math.min(s.beats, Math.ceil(left / s.beat)) : null;
  };

  private spt(start: Start) {
    const { bpm, timeSignature } = readMeta(start.song.doc);
    return tickSeconds(bpm > 0 ? bpm : DEFAULT_BPM, timeSignature, Math.max(10, start.percent()));
  }

  private schedule() {
    const s = this.session;
    if (!s) return;
    const now = Tone.getContext().currentTime;
    if (this.state === "count" && now >= s.countEnd) this.setState("playing");
    while (s.next && s.cursor < now + LOOKAHEAD) {
      const span = s.next;
      const plan = linePlan(s.start.song, span.line, s.start.hidden());
      const to = plan ? Math.min(span.to, plan.length) : 0;
      if (!plan || to <= span.from) {
        // Рядок зник чи вкоротився під ногами — далі, а повтор без часу — кінець.
        s.next = this.loopSpan ? null : nextLine(s.start.song, span.line, s.start.hidden());
        continue;
      }
      const spt = this.spt(s.start);
      plan.hits.forEach((hit) => {
        if (hit.tick < span.from || hit.tick >= to) return;
        const time = s.cursor + (hit.tick - span.from) * spt;
        if (hit.kind === "tab") s.kit.tab(hit.string, hit.fret, time);
        else if (hit.kind === "cajon") s.kit.cajon(hit.hit, time);
        else s.kit.chord(hit.name, Math.min(hit.length, to - hit.tick) * spt, time);
      });
      const end = s.cursor + (to - span.from) * spt;
      s.played.push({ span: { ...span, to }, at: s.cursor, end, spt });
      s.played = s.played.filter((p) => p.end > now - 1);
      s.cursor = end;
      s.next = this.loopSpan ?? nextLine(s.start.song, span.line, s.start.hidden());
    }
    if (!s.next && now >= s.cursor) this.stop(); // пісня скінчилась
  }

  private setState(state: PlayState) {
    if (this.state === state) return;
    this.state = state;
    this.notify();
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }
}

export const lanePlayer = new LanePlayer();
