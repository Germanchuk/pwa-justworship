import type { CSSProperties } from "react";
import type { RenderElementProps } from "slate-react";

import { useCollapseApplies } from "../../../../mode";
import { buildDynamicsGradient } from "../../constants/dynamicsSteps";
import type { SectionElement } from "../../types";
import { useCurrentUsername } from "../hooks";
import "./Section.css";

export const Section = ({ attributes, children, element }: RenderElementProps) => {
  const currentUsername = useCurrentUsername();
  // Згортання діє лише в читанні (таблиця в `mode.tsx`): правити чи чіпляти
  // примітки до згорнутої секції неможливо. Значення `collapsedFor` при цьому
  // лишається в документі й повертається при виході в читання.
  const collapseApplies = useCollapseApplies();
  const section = element as SectionElement;
  const collapsedFor = section.collapsedFor ?? [];
  const isCollapsed =
    collapseApplies && !!currentUsername && collapsedFor.includes(currentUsername);

  const stripe = buildDynamicsGradient(section.dynamicsSteps);
  const style = stripe
    ? ({ "--section-stripe": stripe } as CSSProperties)
    : undefined;

  return (
    <div
      className={`song-section ${isCollapsed ? "song-section--collapsed" : ""}`}
      style={style}
      {...attributes}
    >
      {children}
    </div>
  );
};
