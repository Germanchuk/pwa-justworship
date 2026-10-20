/**
 * Що копіюється в буфер як простий текст: видимі доріжки виділеного, кожна —
 * окремим рядком (акорди над словами), як їх читає вставка (`rules/paste.ts`).
 * Без цього slate-react бере текст із DOM, де рядок — блок у блоці, і між
 * акордами й словами з'являється зайвий порожній рядок.
 */
import { Editor, Node, Range } from "slate";
import type { ViewState } from "./state";

type WithFragment = { setFragmentData?: (data: DataTransfer, origin?: string) => void };

/** Текст виділеного: доріжка за доріжкою, через перенос. */
export function selectedText(view: Editor): string | null {
  const sel = view.selection;
  if (!sel || Range.isCollapsed(sel)) return null;
  // Клітинкові доріжки тексту ще не мають — у буфер потраплять разом зі своєю механікою (ADR-0008).
  const textLane = (n: Node, path: number[]) => path.length === 2 && (n as unknown as { type: string }).type !== "cells";
  return Array.from(Editor.nodes(view, { at: sel, match: textLane }), ([, path]) => {
    const piece = Range.intersection(sel, Editor.range(view, path));
    if (!piece) return "";
    const [start, end] = Range.edges(piece);
    return Node.string(Node.get(view, path)).slice(start.offset, end.offset);
  }).join("\n");
}

/** Простий текст копіювання — з видимого дерева; решту (HTML, фрагмент Slate) лишає slate-react. */
export function installCopy(s: ViewState) {
  const view = s.view as typeof s.view & WithFragment;
  const { setFragmentData } = view;
  if (!setFragmentData) return; // редактор без slate-react (тести) — копіювати нікуди
  view.setFragmentData = (data, origin) => {
    setFragmentData(data, origin);
    const text = selectedText(view);
    if (text !== null) data.setData("text/plain", text);
  };
}
