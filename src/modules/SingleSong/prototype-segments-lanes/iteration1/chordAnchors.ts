/**
 * PROTOTYPE — докази ітерації 1 (ADR-0006): акорди, прив'язані до букв слів.
 * Відкинуто Германом 2026-10-09; лишається, щоб спостереження в
 * `splitMerge.test.ts` можна було відтворити.
 *
 * Відрізок — елемент `{ type: "segment", children: [{ text: слова }] }`.
 * Два способи прив'язати акорд до символу слів:
 *  A. ключ `chord:<id>` на відрізку: `{ name, at: Y.RelativePosition (JSON) }`;
 *  B. «stored position» @slate-yjs (`YjsEditor.storePosition`) — атрибут на
 *     корені документа, який бібліотека переносить при split/merge;
 *     назва акорду — окремий Y.Map `chordNames`.
 */
import { Editor, Element, Node, Transforms } from "slate";
import * as Y from "yjs";
import { slatePointToRelativePosition, YjsEditor } from "@slate-yjs/core";
import { flush, Peer, setLineProps } from "../harness";

export type Segment = { type: "segment"; children: { text: string }[]; [k: string]: unknown };

export const segments = (lines: (string | Segment)[]) =>
  lines.map((s) => (typeof s === "string" ? { type: "segment", children: [{ text: s }] } : s)) as Segment[];

export const setSegmentProps = setLineProps;

// ── дії «як користувач» ────────────────────────────────────────────────────

/** Enter у словах відрізка `seg` після `offset` символів. */
export function pressEnter(p: Peer, seg: number, offset: number) {
  Transforms.select(p.editor, { path: [seg, 0], offset });
  Editor.insertBreak(p.editor);
  flush(p);
}

/** Backspace на початку слів відрізка `seg` (злиття з попереднім). */
export function backspaceAtStart(p: Peer, seg: number) {
  Transforms.select(p.editor, { path: [seg, 0], offset: 0 });
  Editor.deleteBackward(p.editor, { unit: "character" });
  flush(p);
}

export function typeAt(p: Peer, seg: number, offset: number, text: string) {
  Transforms.insertText(p.editor, text, { at: { path: [seg, 0], offset } });
  flush(p);
}

export function deleteRange(p: Peer, seg: number, from: number, to: number) {
  Transforms.delete(p.editor, {
    at: { anchor: { path: [seg, 0], offset: from }, focus: { path: [seg, 0], offset: to } },
  });
  flush(p);
}

// ── спосіб A: ключ chord:<id> на відрізку ──────────────────────────────────

export function addChordOnSegment(p: Peer, seg: number, offset: number, id: string, name: string) {
  const rel = slatePointToRelativePosition(p.root, p.editor, { path: [seg, 0], offset });
  Transforms.setNodes(
    p.editor,
    { [`chord:${id}`]: { name, at: Y.relativePositionToJSON(rel) } } as Partial<Node>,
    { at: [seg] },
  );
  flush(p);
}

// ── спосіб B: stored position @slate-yjs ───────────────────────────────────

export function addChordStored(p: Peer, seg: number, offset: number, id: string, name: string) {
  YjsEditor.storePosition(p.editor, `chord:${id}`, { path: [seg, 0], offset });
  p.doc.getMap<string>("chordNames").set(id, name);
}

/**
 * Злиття з власним переносом позицій — обхід бага `mergeNode` у @slate-yjs
 * 1.0.2 (фільтрує позиції цілі з офсетом попереднього відрізка, тож
 * переносить лише ті, що стоять далі за довжину попереднього). Окремою
 * транзакцією — для прототипу досить.
 */
export function backspaceAtStartRemapped(p: Peer, seg: number) {
  const tail = segmentTexts(p)[seg];
  const prevLen = Node.string(p.editor.children[seg - 1]).length;
  const PREFIX = "__slateYjsStoredPosition_";
  const moving = Object.entries(p.root.getAttributes())
    .filter(([k]) => k.startsWith(PREFIX))
    .map(([k, raw]) => {
      const abs = Y.createAbsolutePositionFromRelativePosition(
        Y.decodeRelativePosition(raw as Uint8Array),
        p.doc,
      );
      return { key: k.slice(PREFIX.length), abs };
    })
    .filter(({ abs }) => abs?.type === tail);
  backspaceAtStart(p, seg);
  moving.forEach(({ key, abs }) =>
    YjsEditor.storePosition(p.editor, key, { path: [seg - 1, 0], offset: prevLen + abs!.index }),
  );
}

/** Атрибути відрізків, крім `type`/`children`/`chord:*` — для порівняння. */
export function segmentProps(p: Peer) {
  return p.editor.children.map((n) =>
    Object.fromEntries(
      Object.entries(n).filter(([k]) => k !== "type" && k !== "children" && !k.startsWith("chord:")),
    ),
  );
}

// ── читання стану ──────────────────────────────────────────────────────────

function segmentTexts(p: Peer): Y.XmlText[] {
  return (p.root.toDelta() as { insert: unknown }[])
    .map((d) => d.insert)
    .filter((x): x is Y.XmlText => x instanceof Y.XmlText);
}

export type Resolved = {
  /** відрізок, де акорд насправді стоїть (за позицією), або null */
  seg: number | null;
  offset: number | null;
  /** символ слів під акордом ("" — кінець рядка) */
  char: string | null;
};

function resolve(p: Peer, rel: Y.RelativePosition): Resolved {
  const abs = Y.createAbsolutePositionFromRelativePosition(rel, p.doc);
  if (!abs) return { seg: null, offset: null, char: null };
  const seg = segmentTexts(p).indexOf(abs.type as Y.XmlText);
  if (seg < 0) return { seg: null, offset: abs.index, char: null };
  const text = Node.string(p.editor.children[seg]);
  return { seg, offset: abs.index, char: text[abs.index] ?? "" };
}

/** Акорди способу A: на якому відрізку записаний ключ і куди вказує позиція. */
export function chordsOnSegments(p: Peer) {
  const out: ({ id: string; name: string; storedOn: number } & Resolved)[] = [];
  p.editor.children.forEach((node, storedOn) => {
    Object.entries(node).forEach(([k, v]) => {
      if (!k.startsWith("chord:")) return;
      const { name, at } = v as { name: string; at: unknown };
      const r = resolve(p, Y.createRelativePositionFromJSON(at));
      out.push({ id: k.slice(6), name, storedOn, ...r });
    });
  });
  return out;
}

/** Акорди способу B. */
export function chordsStored(p: Peer) {
  const names = p.doc.getMap<string>("chordNames");
  // `YjsEditor.storedPositionsRelative` у 1.0.2 зламаний (декодує як JSON
  // замість бінарного) — читаємо атрибути кореня самі.
  const PREFIX = "__slateYjsStoredPosition_chord:";
  return Object.entries(p.root.getAttributes())
    .filter(([k]) => k.startsWith(PREFIX))
    .map(([k, raw]) => {
      const id = k.slice(PREFIX.length);
      const rel = Y.decodeRelativePosition(raw as Uint8Array);
      return { id, name: names.get(id) ?? "?", ...resolve(p, rel) };
    });
}

export function lyrics(p: Peer) {
  return p.editor.children.map((n) => (Element.isElement(n) ? Node.string(n) : "?"));
}

/** Рядок «Am над символом» для читання людиною: `[0] Am@'с'(3)`. */
export function fmt(chords: { name: string; seg: number | null; offset: number | null; char: string | null; storedOn?: number }[]) {
  return chords
    .map(
      (c) =>
        `${c.name}@seg${c.seg}:${c.offset}'${c.char}'` +
        (c.storedOn !== undefined && c.storedOn !== c.seg ? `(ключ на seg${c.storedOn})` : ""),
    )
    .sort();
}
