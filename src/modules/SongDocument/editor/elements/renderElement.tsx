/** Вузол видимого дерева: рядок або доріжка в ньому. */
import { RenderElementProps } from "slate-react";
import type { LaneType } from "../../model";
import { CellLane } from "./CellLane";
import { LineElement } from "./LineElement";
import { TextLane } from "./TextLane";

export function renderElement(props: RenderElementProps) {
  const type = (props.element as unknown as { type: string }).type;
  if (type === "line") return <LineElement {...props} />;
  if (type === "cells") return <CellLane {...props} />;
  return <TextLane {...props} lane={type as LaneType} />;
}
