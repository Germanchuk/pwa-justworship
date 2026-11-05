/**
 * Звук клавіші, поки правлять піаніно (`usePianoEdit`), — як у FL Studio:
 * поставив, узяв чи переніс ноту на іншу клавішу — вона коротко звучить тим
 * самим звуком, що й у програванні.
 */
import * as Tone from "tone";
import { createKit, type Kit } from "./instruments";

let kit: Kit | null = null;

/** Коротко заграти клавішу `midi`; викликати з жесту людини (браузер пускає звук лише після нього). */
export function previewNote(midi: number) {
  void Tone.start().then(() => {
    kit ??= createKit(null);
    kit.note(midi, Tone.now(), 0);
  });
}
