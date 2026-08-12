import { Midi } from "@tonejs/midi";
import * as Chord from "@tonaljs/chord";
import * as Note from "@tonaljs/note";
import { toMidi } from "@tonaljs/midi";
import { voiceChord } from "./voiceChord";

export interface ChordEvent {
  id?: number;
  tokenKey?: string | null;
  chord: string | null; // null/REST/N.C. = пауза
  duration: number;     // у долях (beats)
  /** 0..1 — рівень динаміки секції в рядку цього акорду; undefined = кроків немає. */
  intensity?: number;
  /** Перший звучний акорд секції — дістає акцент. */
  sectionStart?: boolean;
}

// ==== Гуманізація: людина не грає рівно ====
// База velocity — з динаміки секції; поверх неї кожна ОКРЕМА нота дістає свій
// джитер гучності й мікрозсув у часі.
const VELOCITY_RANGE: [number, number] = [0.5, 1.0]; // calm → climax
const NEUTRAL_VELOCITY = 0.8;  // секція без кроків динаміки — як грали досі
const SECTION_ACCENT = 0.08;   // перший акорд секції — впевненіший
const VELOCITY_JITTER = 0.04;  // ± на ноту
// Зсув часу — в мілісекундах, не в долях: людська неточність (~10 мс) не
// залежить від темпу, а частка долі на повільній пісні дала б завеликий розкид.
const TIMING_JITTER_MS = 12;   // ± на ноту

export function isRest(ch: string | null | undefined): boolean {
  if (ch == null) return true;
  const s = ch.trim().toLowerCase();
  // підтримка різних нотацій відсутності акорду
  return s === "" || s === "rest" || s === "r" || s === "n.c." || s === "nc" || s === "-";
}

/** Імена нот (без октави) → pitch class-и 0–11; невалідні мовчки відкидаємо. */
function toPcs(names: string[]): number[] {
  const out: number[] = [];
  for (const name of names) {
    const midi = toMidi(`${name}4`);
    if (midi != null) out.push(((midi % 12) + 12) % 12);
  }
  return out;
}

export interface MidiRenderOptions {
  /** Джерело випадковості — параметр заради детермінованих тестів. */
  random?: () => number;
  /** Множник гуманізації: 0 — механічно, 1 — природно (див. HUMANIZE_LEVELS). */
  humanize?: number;
}

export function createMidiFromProgression(
  progression: ChordEvent[],
  bpm = 70,
  timeSignature: [number, number] = [4, 4],
  transposition = 0,
  options: MidiRenderOptions = {},
): Midi {
  const random = options.random ?? Math.random;
  const humanize = options.humanize ?? 1;
  const midi = new Midi();
  // Темп і розмір тут — метадані для експорту (`downloadMidiFile`), щоб файл був
  // валідним самостійно. Відтворення їх НЕ читає: плеєр бере bpm/розмір з опцій,
  // а ноти — з тіків. Не роби цей хедер джерелом правди для звуку.
  midi.header.setTempo(bpm);
  midi.header.timeSignatures = [{ ticks: 0, timeSignature }];

  const track = midi.addTrack();
  const ppq = midi.header.ppq;

  let currentTick = 0; // завжди цілий
  // Верхні голоси попереднього акорду — якір голосоведення. Паузи його
  // навмисно не скидають: акорд після паузи продовжує рух, а не стрибає.
  let prevUpper: number[] | null = null;

  for (const evt of progression) {
    const beats = Math.max(0, evt.duration || 0);
    const ticks = Math.round(beats * ppq); // приводимо до цілого значення

    // Пауза / відсутність акорду
    if (isRest(evt.chord)) {
      currentTick += ticks;
      continue;
    }

    const raw = evt.chord!.trim();

    // Розбираємо слеш-акорд заздалегідь
    const [sym, bassSym] = raw.split("/");

    // 1) Спробувати як акорд (Cmaj7, Dm, G7, Asus4, ...)
    const parsed = Chord.get(sym);
    let pcs: number[] = [];
    let isChord = false;

    if (parsed.notes.length > 0) {
      pcs = toPcs(parsed.notes);
      isChord = true;
    } else {
      // 2) Якщо це не акорд — можливо це одиночна нота (наприклад, "C#", "Eb")
      const n = Note.get(sym);
      if (!n.empty) pcs = toPcs([n.name]);
      // якщо і це не нота — розцінюємо як паузу
    }

    if (pcs.length > 0 && ticks > 0) {
      const bassNote = bassSym ? Note.get(bassSym) : null;
      const hasSlashBass = bassNote != null && bassNote.empty === false;
      const bassPc = (hasSlashBass ? toPcs([bassNote.name])[0] : undefined) ?? pcs[0];

      const voiced = voiceChord({chordPcs: pcs, bassPc, prevUpper});
      prevUpper = voiced.upper;

      // Одиночній ноті без слеш-баса бас не додаємо: написали одну ноту — грає одна.
      const withBass = isChord || hasSlashBass;
      const midiNotes = withBass ? [voiced.bass, ...voiced.upper] : voiced.upper;

      // База velocity акорду: з динаміки рядка + акцент початку секції.
      const base = evt.intensity != null
        ? VELOCITY_RANGE[0] + evt.intensity * (VELOCITY_RANGE[1] - VELOCITY_RANGE[0])
        : NEUTRAL_VELOCITY;
      const accented = evt.sectionStart ? base + SECTION_ACCENT : base;

      // мс → тіки при цьому bpm (доля = 60/bpm секунд); рівень гуманізації
      // масштабує обидва джитери. Акцент секції не масштабуємо свідомо —
      // він частина динаміки, а не «людської неточності».
      const jitterTicks = (TIMING_JITTER_MS / 1000) * (bpm / 60) * ppq * humanize;
      const velocityJitter = VELOCITY_JITTER * humanize;

      for (const m of midiNotes) {
        const midiNote = Math.max(0, Math.min(127, m + transposition));
        // Кожна нота — свій кидок: гучність і момент дотику трохи різні.
        const velocity = Math.min(1, Math.max(0.2, accented + (random() * 2 - 1) * velocityJitter));
        const offset = Math.round((random() * 2 - 1) * jitterTicks);

        track.addNote({
          midi: midiNote,
          ticks: Math.max(0, currentTick + offset),
          durationTicks: ticks, // уже цілий
          velocity,
        });
      }
    }

    currentTick += ticks;
  }

  return midi;
}

/**
 * Завантажує MIDI-файл у браузері
 */
export function downloadMidiFile(midi: Midi, fileName = "progression.mid") {
  const blob = new Blob([midi.toArray()], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

