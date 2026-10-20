/**
 * Доріжки пісні (ADR-0008) — список, як треки в DAW. Доріжка, додана в пісню,
 * є в кожному рядку: її слот лежить на маркері рядка під її id.
 *
 *   lanes: Y.Map  id → Y.Map { kind, name, order, removed? }
 *
 * Слова (`words`) і акорди (`chords`) — завжди, рівно по одній, правляться в
 * Slate. Решта — клітинкові (`cells: Y.Map`), по скільки завгодно; їхня
 * механіка — згодом. Пісня без запису про `words`/`chords` бере типовий.
 */
import * as Y from "yjs";
import type { LaneType, Line, Song } from "./song";

export type LaneKind = LaneType | "blocks" | "tab" | "cajon";
export type CellKind = Exclude<LaneKind, LaneType>;
export type LaneDef = { id: string; kind: LaneKind; name: string; order: number; removed: boolean };

/** Види, які можна додати в пісню (слова й акорди є завжди). */
export const CELL_KINDS: readonly CellKind[] = ["blocks", "tab", "cajon"];
export const KIND_NAMES: Record<LaneKind, string> = {
  words: "Слова",
  chords: "Акорди",
  blocks: "Прямокутники",
  tab: "Таби",
  cajon: "Кахон",
};
export const isTextKind = (kind: LaneKind): kind is LaneType => kind === "words" || kind === "chords";

const BUILTIN: readonly LaneDef[] = [
  { id: "chords", kind: "chords", name: KIND_NAMES.chords, order: 1, removed: false },
  { id: "words", kind: "words", name: KIND_NAMES.words, order: 2, removed: false },
];

const lanesMap = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>("lanes");

const defOf = (id: string, rec: Y.Map<unknown> | undefined, base?: LaneDef): LaneDef => ({
  id,
  kind: (rec?.get("kind") as LaneKind) ?? base!.kind,
  name: (rec?.get("name") as string) ?? base?.name ?? "",
  order: (rec?.get("order") as number) ?? base?.order ?? 0,
  removed: rec?.get("removed") === true,
});

const byOrder = (a: LaneDef, b: LaneDef) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Усі доріжки пісні, і прибрані теж (їхні слоти живуть у рядках), — у порядку пісні. */
export function allLanes(doc: Y.Doc): LaneDef[] {
  const map = lanesMap(doc);
  const out = BUILTIN.map((b) => defOf(b.id, map.get(b.id), b));
  map.forEach((rec, id) => {
    if (id !== "words" && id !== "chords") out.push(defOf(id, rec));
  });
  return out.sort(byOrder);
}

/** Доріжки пісні, які зараз у ній є (без прибраних), — у порядку пісні. */
export const songLanes = (doc: Y.Doc) => allLanes(doc).filter((l) => !l.removed);

/** Порядок текстових доріжок — у ньому їх показує видиме дерево й читає вставка. */
export const textLaneOrder = (doc: Y.Doc): LaneType[] =>
  allLanes(doc).flatMap((l) => (isTextKind(l.kind) ? [l.kind] : []));

/** Слот доріжки виду `kind` для рядка (`chords` — текст акордів; до вставки в документ Y.Map свого вмісту не віддає). */
export function newSlot(kind: LaneKind, chords = ""): Y.Map<unknown> {
  const slot = new Y.Map<unknown>();
  if (kind === "chords") slot.set("text", new Y.Text(chords));
  else if (kind !== "words") slot.set("cells", new Y.Map());
  slot.set("notes", new Y.Map());
  return slot;
}

/** Клітинки доріжки `id` рядка; `undefined` — слота ще немає (див. `ensureSlots`). */
export const cellsOf = (line: Line, id: string) => (line.get(id) as Y.Map<unknown> | undefined)?.get("cells") as Y.Map<unknown> | undefined;

/** Чи є щось у клітинкових доріжках рядка. */
export function hasCells(line: Line) {
  for (const value of line.values()) {
    const cells = value instanceof Y.Map ? value.get("cells") : undefined;
    if (cells instanceof Y.Map && cells.size > 0) return true;
  }
  return false;
}

/** Слоти рядка, яких бракує, — для рядків, що народились одночасно з доріжкою. */
export const missingSlots = (song: Song, lines: readonly Line[]) =>
  allLanes(song.doc).flatMap((lane) => lines.filter((line) => !line.has(lane.id)).map((line) => ({ line, lane })));

/** Дописати рядкам слоти, яких бракує (ADR-0008, «одночасність»). Викликати в транзакції. */
export function ensureSlots(song: Song, lines: readonly Line[]) {
  missingSlots(song, lines).forEach(({ line, lane }) => line.set(lane.id, newSlot(lane.kind)));
}

const newId = () => `l-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Додати доріжку виду `kind` — внизу списку, з порожнім слотом у кожному
 * рядку. Назва за замовчуванням — вид з номером («Таби 2»). Повертає id.
 * Викликати в транзакції.
 */
export function addLane(song: Song, kind: CellKind, lines: readonly Line[], name?: string): string {
  const all = allLanes(song.doc);
  const id = newId();
  const same = all.filter((l) => l.kind === kind).length;
  const rec = new Y.Map<unknown>();
  rec.set("kind", kind);
  rec.set("name", name ?? (same ? `${KIND_NAMES[kind]} ${same + 1}` : KIND_NAMES[kind]));
  rec.set("order", Math.max(0, ...all.map((l) => l.order)) + 1);
  lanesMap(song.doc).set(id, rec);
  lines.forEach((line) => line.set(id, newSlot(kind)));
  return id;
}

/** Запис доріжки в `lanes`; для слів і акордів створюється, коли їх уперше змінюють. */
function recordOf(doc: Y.Doc, id: string): Y.Map<unknown> {
  const map = lanesMap(doc);
  const rec = map.get(id);
  if (rec) return rec;
  const base = BUILTIN.find((b) => b.id === id);
  if (!base) throw new Error(`lanes: доріжки ${id} немає`);
  const fresh = new Y.Map<unknown>();
  fresh.set("kind", base.kind);
  fresh.set("order", base.order);
  map.set(id, fresh);
  return fresh;
}

/**
 * Перетягнути доріжку на місце `to` у списку доріжок пісні (без прибраних):
 * `order` стає серединою між новими сусідами. Викликати в транзакції.
 */
export function moveLane(doc: Y.Doc, id: string, to: number) {
  const rest = songLanes(doc).filter((l) => l.id !== id);
  const at = Math.max(0, Math.min(to, rest.length));
  const before = rest[at - 1]?.order;
  const after = rest[at]?.order;
  const order =
    before === undefined && after === undefined ? 1 : before === undefined ? after! - 1 : after === undefined ? before + 1 : (before + after) / 2;
  recordOf(doc, id).set("order", order);
}

export const renameLane = (doc: Y.Doc, id: string, name: string) => recordOf(doc, id).set("name", name);

/** Прибрати доріжку з пісні: вміст у рядках лишається, її можна повернути. Слова й акорди — ні. */
export function removeLane(doc: Y.Doc, id: string) {
  if (id === "words" || id === "chords") throw new Error("lanes: слова й акорди не прибираються");
  recordOf(doc, id).set("removed", true);
}

export const restoreLane = (doc: Y.Doc, id: string) => recordOf(doc, id).delete("removed");
