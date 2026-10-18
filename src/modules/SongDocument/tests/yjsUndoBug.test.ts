/**
 * Вада Y.UndoManager (Yjs 13.6.30), знайдена випадковими правками прототипу
 * 2026-10-11: undo видалення вкладеного типу зрідка дає різні документи в
 * учасників або падає. Чистий Yjs, без коду прототипу; ті самі сценарії —
 * скриптами в `justworship-meta/.scratch/segments-lanes/yjs-undo/`.
 *
 * `it.fails` — тест зелений, поки вада є. Коли Yjs її виправить, він
 * почервоніє: тоді прибрати `it.fails`, захист у `laneView` і зерна
 * `YJS_UNDO_BUG` у `fuzz.test.ts`.
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

function pair() {
  const a = new Y.Doc();
  a.clientID = 1;
  const b = new Y.Doc();
  b.clientID = 2;
  const sync = () => {
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
  };
  const aArr = a.getArray<Y.Text>("a");
  const bArr = b.getArray<Y.Text>("a");
  a.transact(() => aArr.insert(0, [new Y.Text("abc"), new Y.Text("xyz")]));
  sync();
  const aUm = new Y.UndoManager(aArr, { trackedOrigins: new Set(["me"]), captureTimeout: 0 });
  const show = (d: Y.Doc) => d.getArray<Y.Text>("a").toArray().map(String);
  return { a, b, aArr, bArr, aUm, sync, show };
}

describe("вада Yjs: undo видалення вкладеного типу", () => {
  it.fails("учасники сходяться після undo (зараз — ні: «abcstu» проти «abstuc»)", () => {
    const { a, b, aArr, bArr, aUm, sync, show } = pair();
    b.transact(() => bArr.insert(2, [new Y.Text("n")]), "me");
    sync();
    // без мережі
    a.transact(() => aArr.delete(1, 2), "me");
    a.transact(() => aArr.get(0).delete(2, 1), "me");
    aUm.undo();
    b.transact(() => bArr.get(0).insert(2, "stu"), "me");
    sync();
    a.transact(() => aArr.delete(0, 1), "me");
    sync();
    aUm.undo();
    sync();
    expect(show(a)).toEqual(show(b));
  });

  it.fails("undo не падає (зараз — TypeError у redoItem; обидва весь час з мережею)", () => {
    const { a, b, aArr, bArr, aUm, sync } = pair();
    const step = (fn: () => void) => {
      fn();
      sync();
    };
    step(() => a.transact(() => aArr.get(0).delete(1, 1), "me"));
    step(() => a.transact(() => aArr.delete(0, 1), "me"));
    step(() => aUm.undo());
    step(() => a.transact(() => aArr.get(0).insert(2, "p"), "me"));
    step(() => aUm.undo());
    step(() => a.transact(() => aArr.get(1).delete(0, 1), "me"));
    step(() => b.transact(() => bArr.delete(0, 2), "me"));
    expect(() => step(() => aUm.undo())).not.toThrow();
  });
});
