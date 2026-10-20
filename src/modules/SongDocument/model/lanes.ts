/**
 * Доріжки пісні (ADR-0008) — список, як треки в DAW. Доріжка, додана в пісню,
 * є в кожному рядку: її слот лежить на маркері рядка під її id.
 *
 *   lanes: Y.Map  id → Y.Map { kind, name, order, removed? }
 *
 * Слова (`words`) і акорди (`chords`) — завжди, рівно по одній, правляться в
 * Slate, і місце в них стале: слова — найнижча доріжка, акорди — над ними.
 * У `lanes` їх немає. Решта — клітинкові (`cells: Y.Map`), по скільки
 * завгодно, над акордами в порядку `order`; їхня механіка — згодом.
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

/** Слова й акорди — під усіма доданими: акорди другі знизу, слова найнижчі. */
const BUILTIN: readonly LaneDef[] = [
  { id: "chords", kind: "chords", name: KIND_NAMES.chords, order: Infinity, removed: false },
  { id: "words", kind: "words", name: KIND_NAMES.words, order: Infinity, removed: false },
];

const lanesMap = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>("lanes");

const byOrder = (a: LaneDef, b: LaneDef) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Додані доріжки, і прибрані теж (їхні слоти живуть у рядках), — у порядку пісні. */
function addedLanes(doc: Y.Doc): LaneDef[] {
  const out: LaneDef[] = [];
  lanesMap(doc).forEach((rec, id) => {
    const kind = rec.get("kind") as LaneKind;
    if (isTextKind(kind)) return; // слова й акорди мають стале місце
    out.push({ id, kind, name: (rec.get("name") as string) ?? "", order: (rec.get("order") as number) ?? 0, removed: rec.get("removed") === true });
  });
  return out.sort(byOrder);
}

/** Усі доріжки пісні згори донизу, і прибрані теж. */
export const allLanes = (doc: Y.Doc): LaneDef[] => [...addedLanes(doc), ...BUILTIN];

/** Доріжки пісні, які зараз у ній є (без прибраних), — згори донизу. */
export const songLanes = (doc: Y.Doc) => allLanes(doc).filter((l) => !l.removed);

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
 * Додати доріжку виду `kind` — найнижчою з доданих (одразу над акордами), з
 * порожнім слотом у кожному рядку. Назва за замовчуванням — вид з номером («Таби 2»). Повертає id.
 * Викликати в транзакції.
 */
export function addLane(song: Song, kind: CellKind, lines: readonly Line[], name?: string): string {
  const added = addedLanes(song.doc);
  const id = newId();
  const same = added.filter((l) => l.kind === kind).length;
  const rec = new Y.Map<unknown>();
  rec.set("kind", kind);
  rec.set("name", name ?? (same ? `${KIND_NAMES[kind]} ${same + 1}` : KIND_NAMES[kind]));
  rec.set("order", Math.max(0, ...added.map((l) => l.order)) + 1);
  lanesMap(song.doc).set(id, rec);
  lines.forEach((line) => line.set(id, newSlot(kind)));
  return id;
}

/** Запис доданої доріжки; слова й акорди не змінюються. */
function recordOf(doc: Y.Doc, id: string): Y.Map<unknown> {
  const rec = lanesMap(doc).get(id);
  if (!rec || isTextKind(rec.get("kind") as LaneKind)) throw new Error(`lanes: доріжки ${id} немає серед доданих`);
  return rec;
}

/**
 * Перетягнути додану доріжку на місце `to` серед доданих (без прибраних):
 * `order` стає серединою між новими сусідами. Викликати в транзакції.
 */
export function moveLane(doc: Y.Doc, id: string, to: number) {
  const rest = addedLanes(doc).filter((l) => !l.removed && l.id !== id);
  const at = Math.max(0, Math.min(to, rest.length));
  const before = rest[at - 1]?.order;
  const after = rest[at]?.order;
  const order =
    before === undefined && after === undefined ? 1 : before === undefined ? after! - 1 : after === undefined ? before + 1 : (before + after) / 2;
  recordOf(doc, id).set("order", order);
}

export const renameLane = (doc: Y.Doc, id: string, name: string) => recordOf(doc, id).set("name", name);

/** Прибрати додану доріжку з пісні: вміст у рядках лишається, її можна повернути. */
export const removeLane = (doc: Y.Doc, id: string) => recordOf(doc, id).set("removed", true);

export const restoreLane = (doc: Y.Doc, id: string) => recordOf(doc, id).delete("removed");
