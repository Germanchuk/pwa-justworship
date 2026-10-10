/**
 * PROTOTYPE — стенд: два учасники (дві копії документа Yjs, у кожного повне
 * дерево Slate + @slate-yjs) і «мережа» між ними, яку можна вимкнути.
 * Для тестів і сторінки прототипу; у справжній код не переїжджає.
 */
import { createEditor, Editor, Node, Transforms } from "slate";
import * as Y from "yjs";
import { withYjs, YjsEditor } from "@slate-yjs/core";

export type Peer = { doc: Y.Doc; root: Y.XmlText; editor: Editor & YjsEditor };

export type PairOptions = {
  /** Базовий редактор до `withYjs`. */
  base?: () => Editor;
  /** Плагіни поверх `withYjs` (до підключення). */
  extend?: (peer: Peer) => void;
};

/** Два підключені редактори з однаковим документом; `unlink()`/`link()` — мережа. */
export function makePair(seed: Node[], opts: PairOptions = {}) {
  const a = new Y.Doc();
  const b = new Y.Doc();
  let online = true;
  const queueAB: Uint8Array[] = [];
  const queueBA: Uint8Array[] = [];
  a.on("update", (u: Uint8Array, origin: unknown) => {
    if (origin === "net") return;
    if (online) Y.applyUpdate(b, u, "net");
    else queueAB.push(u);
  });
  b.on("update", (u: Uint8Array, origin: unknown) => {
    if (origin === "net") return;
    if (online) Y.applyUpdate(a, u, "net");
    else queueBA.push(u);
  });

  const peer = (doc: Y.Doc): Peer => {
    const root = doc.get("content", Y.XmlText) as Y.XmlText;
    const editor = withYjs((opts.base ?? createEditor)(), root) as Editor & YjsEditor;
    const p = { doc, root, editor };
    opts.extend?.(p);
    YjsEditor.connect(editor);
    return p;
  };

  // Засів — як у проді: через підключений редактор, а не напряму в Yjs.
  const A = peer(a);
  const B = peer(b);
  Transforms.insertNodes(A.editor, seed, { at: [0] });
  YjsEditor.flushLocalChanges(A.editor);
  [A, B].forEach((p) => (p.editor as unknown as { undoManager?: Y.UndoManager }).undoManager?.clear());

  return {
    A,
    B,
    get online() {
      return online;
    },
    get queued() {
      return queueAB.length + queueBA.length;
    },
    unlink() {
      online = false;
    },
    link() {
      online = true;
      queueAB.splice(0).forEach((u) => Y.applyUpdate(b, u, "net"));
      queueBA.splice(0).forEach((u) => Y.applyUpdate(a, u, "net"));
    },
  };
}

export type Pair = ReturnType<typeof makePair>;

/** Slate віддає операції в Yjs лише в `onChange` (мікрозадача); у тесті — одразу. */
export function flush(p: Peer) {
  YjsEditor.flushLocalChanges(p.editor);
}

export function removeLine(p: Peer, ln: number) {
  Transforms.removeNodes(p.editor, { at: [ln] });
  flush(p);
}

export function setLineProps(p: Peer, ln: number, props: Record<string, unknown>) {
  Transforms.setNodes(p.editor, props as Partial<Node>, { at: [ln] });
  flush(p);
}
