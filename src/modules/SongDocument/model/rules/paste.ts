/** Вставка простого тексту з буфера — зі свого редактора чи ззовні (сайт з акордами). */
import { isChordsLine } from "#utils/keyUtils";
import { textLaneOrder } from "../lanes";
import { chordsOf, lineAt } from "../read";
import { LANES, type LaneType, type Pos, type Song } from "../song";
import { splitLine } from "./enter";
import { insertText } from "./slash";

type Pasted = { chords: string; words: string };

/** Яка доріжка в цього рядка тексту (той самий розпізнавач акордів, що в бойовому редакторі). */
const laneOfText = (line: string): LaneType => (isChordsLine(line) ? "chords" : "words");

/**
 * Рядки тексту → рядки пісні (ADR-0008). Кожен рядок тексту — у свою доріжку;
 * сусідні збираються в один рядок пісні за порядком доріжок `order`: рядок,
 * що в порядку не нижче за вже зібране, починає новий рядок пісні. Тож за
 * звичайного порядку акорди лягають над словами під ними, а якщо в пісні
 * слова над акордами — акорди беруться до слів над ними. Порожній рядок —
 * роздільник: окремий порожній рядок пісні.
 */
export function groupLines(lines: string[], order: readonly LaneType[] = LANES): Pasted[] {
  const out: Pasted[] = [];
  let cur: Pasted | null = null;
  let last = -1;
  const flush = () => {
    if (cur) out.push(cur);
    cur = null;
    last = -1;
  };
  for (const line of lines) {
    if (!line.trim()) {
      flush();
      out.push({ chords: "", words: line });
      continue;
    }
    const lane = laneOfText(line);
    const at = order.indexOf(lane);
    if (at <= last) flush();
    cur = { ...(cur ?? { chords: "", words: "" }), [lane]: line };
    last = at;
  }
  flush();
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
  return groupLines(parts, textLaneOrder(song.doc)).reduce<Pos>((pos, { chords, words }, i) => {
    const here = i > 0 ? splitLine(song, pos) ?? pos : pos;
    if (chords) {
      const lane = chordsOf(lineAt(song, here.line).line);
      lane.insert(lane.length, (lane.length ? " " : "") + chords);
    }
    return words ? insertText(song, here, words) ?? here : here;
  }, at);
}
