/**
 * Запис вокалу в доріжку піаніно (PLAY-60…): ▶ з мікрофоном. Програвач грає
 * пісню як завжди (відлік, доріжки), лише доріжка, у яку пишемо, мовчить; мікрофон
 * слухає на тому самому аудіоконтексті, тож час кожного семпла — той самий
 * годинник, що й у нот. Після ■ запис розбирається на ноти (`pitch.ts`) і стає
 * **чернеткою**: її видно поверх доріжки, її можна зсунути на затримку
 * навушників, зберегти чи переписати. Сам звук ніде не лишається — лише ноти.
 *
 * Зберегти = як punch-in у DAW: на проміжку дубля (від старту до ■) записане в
 * доріжці замінюється заспіваним.
 *
 * Синглтон, як і програвач: мікрофон і звук — один на пристрій.
 */
import * as Tone from "tone";
import * as Y from "yjs";
import { readMeta, Song, writeSung, type Line } from "../model";
import { lanePlayer } from "./player";
import { pitchTrack, placeNotes, sungNotes, zoomCellTicks, type PlacedNote, type PlayedSpan, type Sung } from "./pitch";
import type { Span } from "./timeline";

export type RecState = "idle" | "opening" | "recording" | "analyzing" | "review";

type Begin = {
  song: Song;
  /** Доріжка піаніно, у яку пишемо. */
  lane: string;
  from: Span;
  hidden: () => readonly string[];
  percent: () => number;
  /** Масштаб людини — до його комірок вирівнюються ноти. */
  zoom: number;
};

/** Чернетка: ноти дубля і проміжки рядків, які він замінить. */
export type Draft = { lane: string; spans: { line: number; from: number; to: number }[]; notes: PlacedNote[]; shift: number };

/** Зсув на затримку, підібраний людиною, — налаштування пристрою (навушники в кожного свої). */
const SHIFT_KEY = "jw.vocal.shift";
const readExtra = () => {
  try {
    return Number(localStorage.getItem(SHIFT_KEY)) || 0;
  } catch {
    return 0;
  }
};
const saveExtra = (v: number) => {
  try {
    localStorage.setItem(SHIFT_KEY, String(v));
  } catch {
    /* приватне вікно — без пам'яті */
  }
};

/** Затримка, коли браузер про неї мовчить (Safari): вихід + вхід на дротових навушниках. */
const FALLBACK_LATENCY = 0.04;

/** Обробник у потоці аудіо: збирає семпли мікрофона пачками з номером першого кадру. */
const WORKLET = `
class Capture extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(4096); this.n = 0; this.start = 0; this.on = true;
    this.port.onmessage = () => { this.flush(); this.on = false; this.port.postMessage({ done: true }); }; }
  flush() { if (this.n) this.port.postMessage({ frame: this.start, data: this.buf.slice(0, this.n) }); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!this.on) return false;
    if (!ch) return true;
    if (!this.n) this.start = currentFrame;
    if (this.n + ch.length > this.buf.length) { this.flush(); this.start = currentFrame; }
    this.buf.set(ch, this.n); this.n += ch.length;
    return true;
  }
}
registerProcessor("jw-capture", Capture);
`;
let workletLoaded: Promise<void> | null = null;

class VocalRecorder {
  private state: RecState = "idle";
  private listeners = new Set<() => void>();
  private begin: Begin | null = null;
  private mic: { stream: MediaStream; source: AudioNode; node: AudioWorkletNode; sink: GainNode; chunks: { frame: number; data: Float32Array }[]; rate: number } | null = null;
  private spans: (PlayedSpan & { ref: Line })[] = [];
  private take: { sung: Sung[]; t0: number; auto: number } | null = null;
  private draft: Draft | null = null;
  private offPlayer: (() => void) | null = null;
  private error: string | null = null;

  getState = () => this.state;
  getDraft = () => this.draft;
  getError = () => this.error;
  /** Доріжка, у яку пишемо зараз (чи чия чернетка), — вона мовчить. */
  lane = () => (this.state === "idle" ? null : (this.begin?.lane ?? null));

  listen = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };

  /** Почати дубль з `from`. Викликати з дотику: iOS дає мікрофон і звук лише так. */
  start = async (begin: Begin) => {
    this.discard();
    this.begin = begin;
    this.error = null;
    this.setState("opening");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Сирий голос: придушення шуму й луни «з'їдає» тягнуті ноти, автогучність гойдає поріг.
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
      await Tone.start();
      const ctx = Tone.getContext();
      workletLoaded ??= ctx.addAudioWorkletModule(URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" })));
      await workletLoaded;
      if (this.begin !== begin) return void stream.getTracks().forEach((t) => t.stop());
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createAudioWorkletNode("jw-capture", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      // Обробник рахує, лише коли його вихід кудись веде: у тишу, щоб мікрофон не йшов у навушники.
      const sink = ctx.createGain();
      sink.gain.value = 0;
      source.connect(node);
      node.connect(sink);
      sink.connect(ctx.rawContext.destination);
      const chunks: { frame: number; data: Float32Array }[] = [];
      node.port.onmessage = (e) => e.data.data && chunks.push(e.data);
      this.mic = { stream, source, node, sink, chunks, rate: ctx.sampleRate };
      this.spans = [];
      this.setState("recording");
      this.offPlayer = lanePlayer.listen(() => lanePlayer.getState() === "idle" && this.state === "recording" && void this.finish());
      await lanePlayer.start({
        song: begin.song,
        from: begin.from,
        hidden: () => [...begin.hidden(), begin.lane],
        percent: begin.percent,
        onSpan: (span, ref) => this.spans.push({ ...span, ref }),
      });
    } catch (error) {
      console.error("vocal recording", error);
      this.error = error instanceof DOMException && error.name === "NotAllowedError" ? "Немає доступу до мікрофона" : "Мікрофон не вдалося ввімкнути";
      this.release();
      this.begin = null;
      this.setState("idle");
    }
  };

  /** ■ під час запису: дубль закінчився — розібрати на ноти. */
  stop = () => {
    if (this.state === "recording") void this.finish();
    else if (this.state === "opening") this.discard();
  };

  /** Більша поправка на затримку на `delta` секунд — ноти раніше (менша — пізніше); запам'ятовується на пристрої. */
  nudge = (delta: number) => {
    if (!this.take || !this.draft) return;
    saveExtra(Math.round((readExtra() + delta) * 1000) / 1000);
    this.rebuild();
  };

  /** Записати чернетку в доріжку замість того, що було на проміжку дубля. */
  save = () => {
    const b = this.begin;
    const d = this.draft;
    if (!b || !d) return;
    const { timeSignature } = readMeta(b.song.doc);
    b.song.doc.transact(() => {
      this.spans.forEach((s) => {
        const slot = s.ref.get(b.lane);
        if (slot instanceof Y.Map && slot.has("cells")) writeSung(slot, s.from, s.to, d.notes.filter((n) => n.line === s.line), timeSignature);
      });
    });
    this.discard();
  };

  /** Без запису: чернетку геть, мікрофон вимкнено. */
  discard = () => {
    if (this.state === "recording" || this.state === "opening") lanePlayer.stop();
    this.release();
    this.take = null;
    this.draft = null;
    this.spans = [];
    this.begin = null;
    this.setState("idle");
  };

  /** Ще раз з того самого місця. */
  retake = () => {
    const b = this.begin;
    if (!b) return;
    void this.start(b);
  };

  clearError = () => {
    this.error = null;
    this.notify();
  };

  private async finish() {
    const mic = this.mic;
    if (!mic || this.state !== "recording") return;
    const stopAt = Tone.getContext().currentTime;
    this.setState("analyzing");
    lanePlayer.stop();
    // Дочекатися останньої пачки з потоку аудіо.
    await new Promise<void>((resolve) => {
      const done = (e: MessageEvent) => e.data.done && resolve();
      mic.node.port.addEventListener("message", done);
      mic.node.port.start?.();
      mic.node.port.postMessage("stop");
      setTimeout(resolve, 300);
    });
    const latency = this.latency(mic.stream);
    this.release();
    // Рядки — лише до ■: що не доспівали, того не стираємо.
    this.spans = this.spans
      .filter((s) => s.at < stopAt)
      .map((s) => (s.end <= stopAt ? s : { ...s, to: s.from + Math.round((stopAt - s.at) / s.spt), end: stopAt }));
    const { chunks, rate } = mic;
    if (!chunks.length || !this.spans.length) return this.discard();
    const first = chunks[0].frame;
    const all = new Float32Array(chunks[chunks.length - 1].frame - first + chunks[chunks.length - 1].data.length);
    chunks.forEach((c) => all.set(c.data, c.frame - first));
    // Кадр, щоб показати «розбираю», і лише тоді рахувати.
    await new Promise((r) => setTimeout(r, 30));
    const sung = sungNotes(pitchTrack(all, rate));
    this.take = { sung, t0: first / rate, auto: latency };
    this.rebuild();
    this.setState("review");
  }

  private rebuild() {
    const b = this.begin;
    const t = this.take;
    if (!b || !t) return;
    const shift = t.auto + readExtra();
    this.draft = {
      lane: b.lane,
      spans: this.spans.map(({ line, from, to }) => ({ line, from, to })),
      notes: placeNotes(t.sung, this.spans, t.t0, shift, zoomCellTicks(b.zoom)),
      shift,
    };
    this.notify();
  }

  /** Скільки звук іде до вуха й назад у мікрофон — що браузер знає; решту дозсуває людина. */
  private latency(stream: MediaStream) {
    const raw = Tone.getContext().rawContext as unknown as { outputLatency?: number; baseLatency?: number };
    const input = (stream.getAudioTracks()[0]?.getSettings() as { latency?: number } | undefined)?.latency;
    const out = (raw.outputLatency || 0) + (raw.baseLatency || 0);
    return out || input ? out + (input || 0) : FALLBACK_LATENCY;
  }

  private release() {
    const mic = this.mic;
    this.offPlayer?.();
    this.offPlayer = null;
    if (!mic) return;
    this.mic = null;
    try {
      mic.source.disconnect();
      mic.node.disconnect();
      mic.sink.disconnect();
    } catch {
      /* уже від'єднано */
    }
    mic.stream.getTracks().forEach((t) => t.stop());
  }

  private setState(state: RecState) {
    if (this.state === state) return;
    this.state = state;
    this.notify();
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }
}

export const vocalRecorder = new VocalRecorder();
