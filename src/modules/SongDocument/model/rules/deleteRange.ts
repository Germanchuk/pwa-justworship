/** Видалення виділеного — через кілька доріжок і рядків. */
import { laneString, lineAt } from "../read";
import { hasCells, textLaneOrder } from "../lanes";
import { CanEdit, LaneType, Pos, Song } from "../song";
import { eraseIn, removeLine } from "../write";
import { mergeLine } from "./merge";


/**
 * Стерти діапазон — як у звичайному тексті, у порядку документа: стирається
 * все між кінцями, рядки між ними зникають, а якщо обидва кінці в словах —
 * останній рядок вливається в перший. Чого учасник не бачить, те не
 * стирається; рядок зі схованим вмістом (чи з клітинками) не зникає й не склеюється.
 */
export function deleteRange(song: Song, a: Pos, b: Pos, canEdit: CanEdit): Pos {
  // Порядок доріжок у рядку — порядок пісні (слова можуть стояти й над акордами).
  const LANES = textLaneOrder(song.doc);
  const order = (x: Pos, y: Pos) => x.line - y.line || LANES.indexOf(x.lane) - LANES.indexOf(y.lane) || x.offset - y.offset;
  const [start, end] = order(a, b) <= 0 ? [a, b] : [b, a];
  const length = (ln: number, lane: LaneType) => laneString(song, ln, lane).length;
  const erase = (ln: number, lane: LaneType, from: number, to: number) => {
    if (to > from && canEdit(ln, lane)) eraseIn(song, ln, lane, from, to);
  };
  const eraseLane = (ln: number, lane: LaneType) => erase(ln, lane, 0, length(ln, lane));
  const between = (from: number, to: number) => LANES.slice(from, to);
  const lanePos = (lane: LaneType) => LANES.indexOf(lane);

  if (start.line === end.line && start.lane === end.lane) {
    erase(start.line, start.lane, start.offset, end.offset);
    return start;
  }
  let merge =
    start.line !== end.line && start.lane === "words" && end.lane === "words" &&
    canEdit(start.line, "words") && canEdit(end.line, "words");

  // Від кінця до початку, щоб номери ще не стертого лишались чинними.
  erase(end.line, end.lane, 0, end.offset);
  between(start.line === end.line ? lanePos(start.lane) + 1 : 0, lanePos(end.lane)).forEach((l) => eraseLane(end.line, l));
  for (let ln = end.line - 1; ln > start.line; ln--) {
    // Клітинкових доріжок у виділенні Slate немає — рядок із ними не зникає.
    if (LANES.some((l) => !canEdit(ln, l) && length(ln, l)) || hasCells(lineAt(song, ln).line)) {
      LANES.forEach((l) => eraseLane(ln, l));
      merge = false;
    } else removeLine(song, ln);
  }
  if (start.line !== end.line) between(lanePos(start.lane) + 1, LANES.length).forEach((l) => eraseLane(start.line, l));
  erase(start.line, start.lane, start.offset, length(start.line, start.lane));

  return merge ? mergeLine(song, start.line + 1) : start;
}
