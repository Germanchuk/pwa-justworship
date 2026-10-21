/** Вузол видимого дерева: рядок або доріжка в ньому. */
import { RenderElementProps } from "slate-react";
import { CellLane } from "./CellLane";
import { LineElement } from "./LineElement";
import { TextLane } from "./TextLane";

export function renderElement(props: RenderElementProps) {
  const type = (props.element as unknown as { type: string }).type;
  if (type === "line") return <LineElement {...props} />;
  if (type === "cells") return <CellLane {...props} />;
  // Додана текстова доріжка (вигуки) — вузол `text` з id доріжки; слова й акорди — `type` = id.
  const lane = (props.element as unknown as { lane?: string }).lane ?? type;
  return <TextLane {...props} lane={lane} />;
}
