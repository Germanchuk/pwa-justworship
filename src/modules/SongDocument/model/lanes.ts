/**
 * Доріжки пісні (ADR-0008) — список, як треки в DAW. Доріжка, додана в пісню,
 * є в кожному рядку: її слот лежить на маркері рядка під її id.
 *
 *   lanes: Y.Map  id → Y.Map { kind, name, order, removed? }
 *
 * Слова (`words`) і акорди (`chords`) — завжди, рівно по одній, правляться в
 * Slate; не прибираються й не перейменовуються. Їхній запис у `lanes` (id =
 * вид, лише `kind` і `order`) з'являється, коли їх уперше перетягнули; без
 * запису — внизу: акорди, під ними слова. Решта — додані, по скільки
 * завгодно; порядок усіх — `order` (з 2026-10-22 перетягується будь-яка).
 */
import * as Y from "yjs";
import type { Line, Song } from "./song";
import { GRID, staleCajon, staleGrid, upgradeCajon, upgradeGrid } from "./cells";

/** `text` — додана текстова доріжка (вигуки, бек-вокал): правиться як акорди, текстом у Slate. */
export type LaneKind = "words" | "chords" | "text" | "blocks" | "tab" | "cajon";
export type CellKind = "blocks" | "tab" | "cajon";
export type LaneDef = { id: string; kind: LaneKind; name: string; order: number; removed: boolean };

/** Види, які можна додати в пісню (слова й акорди є завжди). */
export const CELL_KINDS: readonly CellKind[] = ["blocks", "tab", "cajon"];
export const KIND_NAMES: Record<LaneKind, string> = {
  words: "Слова",
  chords: "Акорди",
  text: "Вигуки",
  blocks: "Прямокутники",
  tab: "Таби",
  cajon: "Кахон",
};
/** Текстові доріжки правляться в Slate: слова, акорди й додані `text`. */
export const isTextKind = (kind: LaneKind) => kind === "words" || kind === "chords" || kind === "text";
/** Слова й акорди — є завжди, не прибираються й не перейменовуються. */
export const isBuiltinKind = (kind: LaneKind) => kind === "words" || kind === "chords";

/** Місце слів і акордів, поки їх не перетягували: під усіма доданими, акорди над словами. */
const BUILTIN_ORDER = { chords: 1e9, words: 1e9 + 1 } as const;

const lanesMap = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>("lanes");

const byOrder = (a: LaneDef, b: LaneDef) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Додані доріжки, і прибрані теж (їхні слоти живуть у рядках), — у порядку пісні. */
function addedLanes(doc: Y.Doc): LaneDef[] {
  const out: LaneDef[] = [];
  lanesMap(doc).forEach((rec, id) => {
    const kind = rec.get("kind") as LaneKind;
    if (isBuiltinKind(kind)) return; // запис слів чи акордів — лише їхнє місце
    out.push({ id, kind, name: (rec.get("name") as string) ?? "", order: (rec.get("order") as number) ?? 0, removed: rec.get("removed") === true });
  });
  return out.sort(byOrder);
}

/** Слова й акорди з їхнім місцем. */
const builtinLanes = (doc: Y.Doc): LaneDef[] =>
  (["chords", "words"] as const).map((id) => ({
    id,
    kind: id,
    name: KIND_NAMES[id],
    order: (lanesMap(doc).get(id)?.get("order") as number | undefined) ?? BUILTIN_ORDER[id],
    removed: false,
  }));

/** Усі доріжки пісні згори донизу, і прибрані теж. */
export const allLanes = (doc: Y.Doc): LaneDef[] => [...addedLanes(doc), ...builtinLanes(doc)].sort(byOrder);

/** Доріжки пісні, які зараз у ній є (без прибраних), — згори донизу. */
export const songLanes = (doc: Y.Doc) => allLanes(doc).filter((l) => !l.removed);

/** Слот доріжки виду `kind` для рядка (`chords` — текст акордів; до вставки в документ Y.Map свого вмісту не віддає). */
export function newSlot(kind: LaneKind, chords = ""): Y.Map<unknown> {
  const slot = new Y.Map<unknown>();
  if (kind === "chords" || kind === "text") slot.set("text", new Y.Text(chords));
  else if (kind !== "words") {
    slot.set("cells", new Y.Map());
    slot.set("grid", GRID);
  }
  slot.set("notes", new Y.Map());
  return slot;
}

/** Клітинки доріжки `id` рядка; `undefined` — слота ще немає (див. `ensureSlots`). */
export const cellsOf = (line: Line, id: string) => (line.get(id) as Y.Map<unknown> | undefined)?.get("cells") as Y.Map<unknown> | undefined;

/** id клітинкових доріжок рядка, у яких щось є. */
export function filledCells(line: Line): string[] {
  const out: string[] = [];
  line.forEach((value, id) => {
    const cells = value instanceof Y.Map ? value.get("cells") : undefined;
    if (cells instanceof Y.Map && cells.size > 0) out.push(id);
  });
  return out;
}

export const hasCells = (line: Line) => filledCells(line).length > 0;

/** Стерти вміст клітинкової доріжки рядка (її захопило видалення виділеного). Викликати в транзакції. */
export const clearCells = (line: Line, id: string) => cellsOf(line, id)?.clear();

/**
 * Що в слотах рядків треба полагодити: слоти, яких бракує (рядки, що
 * народились одночасно з доріжкою), клітинки на старій сітці (`upgradeGrid`) і
 * кахон однією лінією (`upgradeCajon`).
 */
export const missingSlots = (song: Song, lines: readonly Line[]) => [
  ...allLanes(song.doc).flatMap((lane) => lines.filter((line) => !line.has(lane.id)).map((line) => ({ line, lane }))),
  ...staleSlots(song, lines),
];

/** Слот на старій сітці чи (кахон) ще однією лінією. */
const stale = (kind: LaneKind, slot: Y.Map<unknown>) => staleGrid(slot) || (kind === "cajon" && staleCajon(slot));

const staleSlots = (song: Song, lines: readonly Line[]) =>
  addedLanes(song.doc).flatMap((lane) =>
    lines.filter((line) => line.get(lane.id) instanceof Y.Map && stale(lane.kind, line.get(lane.id) as Y.Map<unknown>)).map((line) => ({ line, lane })),
  );

/** Дописати рядкам слоти, яких бракує (ADR-0008, «одночасність»), і перерахувати старі сітки. Викликати в транзакції. */
export function ensureSlots(song: Song, lines: readonly Line[]) {
  missingSlots(song, lines).forEach(({ line, lane }) => {
    const slot = line.get(lane.id);
    if (slot instanceof Y.Map) {
      if (lane.kind === "cajon" && staleCajon(slot as Y.Map<unknown>)) upgradeCajon(slot as Y.Map<unknown>);
      if (staleGrid(slot as Y.Map<unknown>)) upgradeGrid(slot as Y.Map<unknown>, lane.kind as CellKind);
    }
    else line.set(lane.id, newSlot(lane.kind));
  });
}

const newId = () => `l-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Додати доріжку виду `kind` — одразу над акордами (де б вони не стояли), з
 * порожнім слотом у кожному рядку. Назва за замовчуванням — вид з номером («Таби 2»). Повертає id.
 * Викликати в транзакції.
 */
export function addLane(song: Song, kind: CellKind | "text", lines: readonly Line[], name?: string): string {
  const added = addedLanes(song.doc);
  const id = newId();
  const same = added.filter((l) => l.kind === kind).length;
  const all = allLanes(song.doc);
  const chords = all.findIndex((l) => l.id === "chords");
  const rec = new Y.Map<unknown>();
  rec.set("kind", kind);
  rec.set("name", name ?? (same ? `${KIND_NAMES[kind]} ${same + 1}` : KIND_NAMES[kind]));
  rec.set("order", between(all[chords - 1]?.order, all[chords].order));
  lanesMap(song.doc).set(id, rec);
  lines.forEach((line) => line.set(id, newSlot(kind)));
  return id;
}

/** Запис доданої доріжки; слова й акорди не перейменовуються й не прибираються. */
function recordOf(doc: Y.Doc, id: string): Y.Map<unknown> {
  const rec = lanesMap(doc).get(id);
  if (!rec || isBuiltinKind(rec.get("kind") as LaneKind)) throw new Error(`lanes: доріжки ${id} немає серед доданих`);
  return rec;
}

/** Число між сусідами (`undefined` — краю немає). */
const between = (before: number | undefined, after: number | undefined) =>
  before === undefined && after === undefined ? 1 : before === undefined ? after! - 1 : after === undefined ? before + 1 : (before + after) / 2;

/**
 * Перетягнути будь-яку доріжку — і слова з акордами — на місце `to` серед
 * доріжок пісні (без прибраних): `order` стає серединою між новими сусідами.
 * Слова й акорди отримують запис зі своїм місцем, коли їх уперше перетягнули.
 * Викликати в транзакції.
 */
export function moveLane(doc: Y.Doc, id: string, to: number) {
  const rest = songLanes(doc).filter((l) => l.id !== id);
  const at = Math.max(0, Math.min(to, rest.length));
  const order = between(rest[at - 1]?.order, rest[at]?.order);
  if (id === "words" || id === "chords") {
    let rec = lanesMap(doc).get(id);
    if (!rec) {
      rec = new Y.Map<unknown>();
      rec.set("kind", id);
      lanesMap(doc).set(id, rec);
    }
    rec.set("order", order);
  } else recordOf(doc, id).set("order", order);
}

export const renameLane = (doc: Y.Doc, id: string, name: string) => recordOf(doc, id).set("name", name);

/** Прибрати додану доріжку з пісні: вміст у рядках лишається, її можна повернути. */
export const removeLane = (doc: Y.Doc, id: string) => recordOf(doc, id).set("removed", true);

export const restoreLane = (doc: Y.Doc, id: string) => recordOf(doc, id).delete("removed");
