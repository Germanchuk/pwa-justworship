/** PROTOTYPE — мокова пісня й пара учасників для сторінки прототипу. */
import { createEditor, Node } from "slate";
import { withYHistory } from "@slate-yjs/core";
import { makePair } from "./harness";
import { line, withTextLanes } from "./lanes/textLanes";

export const MOCK_SONG = [
  line("/Куплет 1"),
  // Пробіли підібрано під шрифт редактора (Manrope), як вирівнює людина на око.
  line("Ти святий, Господь", "Am F               C       G", { "cajon:1.1": "B", "cajon:1.5": "t" }),
  line("Твоє світло серед ночі", "F          C             G            Am"),
  line(""),
  line("/Приспів"),
  line("Алилуя, алилуя", "F                 G", {
    "cajon:1.1": "B",
    "cajon:1.3": "t",
    "cajon:1.5": "B",
    "cajon:1.6": "B",
    "cajon:1.7": "t",
  }),
  line("Слава Тобі навіки (x2)", "Am        F        C      G"),
] as unknown as Node[];

/** Два учасники з повними деревами (без React — видимі створює кожна панель). */
export const makeSongPair = () =>
  makePair(MOCK_SONG, {
    base: createEditor,
    extend: (p) => {
      withTextLanes(p.editor);
      withYHistory(p.editor as never);
    },
  });
