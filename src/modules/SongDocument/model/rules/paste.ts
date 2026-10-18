/** Вставка простого тексту з буфера — зі свого редактора чи ззовні (сайт з акордами). */
import { isChordsLine } from "#utils/keyUtils";
import { chordsOf, lineAt } from "../read";
import type { Pos, Song } from "../song";
import { splitLine } from "./enter";
import { insertText } from "./slash";

type Pasted = { chords: string; words: string };

/**
 * Рядки тексту → рядки пісні. Рядок акордів (той самий розпізнавач, що в
 * бойовому редакторі) лягає в акорди рядка слів під ним; без слів під собою
 * (далі акорди, порожній рядок або кінець) — це рядок самих акордів.
 */
export function pairChords(lines: string[]): Pasted[] {
  // Порожній рядок — роздільник, а не слова під акордами.
  const isWords = (line?: string) => !!line?.trim() && !isChordsLine(line);
  const out: Pasted[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isChordsLine(lines[i])) out.push({ chords: "", words: lines[i] });
    else if (isWords(lines[i + 1])) out.push({ chords: lines[i], words: lines[++i] });
    else out.push({ chords: lines[i], words: "" });
  }
  return out;
}

/**
 * У словах рядки стають рядками (як Enter), акорди — в акорди свого рядка
 * (дописуються в кінець, якщо там уже щось є). В акордах усе — одним рядком
 * через пробіл.
 */
export function insertPlainText(song: Song, at: Pos, pasted: string): Pos {
  const parts = pasted.split(/\r?\n/);
  if (at.lane === "chords") return insertText(song, at, parts.join(" ")) ?? at;
  return pairChords(parts).reduce<Pos>((pos, { chords, words }, i) => {
    const here = i > 0 ? splitLine(song, pos) ?? pos : pos;
    if (chords) {
      const lane = chordsOf(lineAt(song, here.line).line);
      lane.insert(lane.length, (lane.length ? " " : "") + chords);
    }
    return words ? insertText(song, here, words) ?? here : here;
  }, at);
}
