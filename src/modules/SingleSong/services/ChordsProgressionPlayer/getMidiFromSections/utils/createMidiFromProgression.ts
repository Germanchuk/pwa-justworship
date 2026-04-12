import { Midi } from "@tonejs/midi";
import * as Chord from "@tonaljs/chord";
import * as Note from "@tonaljs/note";
import { toMidi } from "@tonaljs/midi";

export interface ChordEvent {
  id?: number;
  chord: string | null; // null/REST/N.C. = пауза
  duration: number;     // у долях (beats)
}

function isRest(ch: string | null | undefined): boolean {
  if (ch == null) return true;
  const s = ch.trim().toLowerCase();
  // підтримка різних нотацій відсутності акорду
  return s === "" || s === "rest" || s === "r" || s === "n.c." || s === "nc" || s === "-";
}

export function createMidiFromProgression(
  progression: ChordEvent[],
  bpm = 70,
  timeSignature: [number, number] = [4, 4]
): Midi {
  const midi = new Midi();
  midi.header.setTempo(bpm);
  midi.header.timeSignatures = [{ ticks: 0, timeSignature }];

  const track = midi.addTrack();
  const ppq = midi.header.ppq;

  let currentTick = 0; // завжди цілий
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
    let notes: string[] = [];

    if (parsed.notes.length > 0) {
      // додамо октаву до кожного тону акорду
      notes = parsed.notes.map((n) => `${n}4`);
      // якщо є бас через слеш — замінимо бас (першу ноту) на нього
      if (bassSym && Note.get(bassSym).empty === false) {
        notes[0] = `${bassSym}3`;
      }
    } else {
      // 2) Якщо це не акорд — можливо це одиночна нота (наприклад, "C#", "Eb")
      const n = Note.get(sym);
      if (!n.empty) {
        // одиночна нота, за замовчуванням у 4-й октаві
        notes = [`${n.name}4`];
        // якщо є валідний бас — зіграємо його як ноту в 3-й октаві разом
        if (bassSym && Note.get(bassSym).empty === false) {
          notes.unshift(`${bassSym}3`);
        }
      }
      // якщо і це не нота — розцінюємо як паузу
    }

    if (notes.length > 0 && ticks > 0) {
      for (const n of notes) {
        const midiNote = toMidi(n);
        if (midiNote == null) continue;

        track.addNote({
          midi: midiNote,
          ticks: currentTick,
          durationTicks: ticks, // уже цілий
          velocity: 0.8,
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

