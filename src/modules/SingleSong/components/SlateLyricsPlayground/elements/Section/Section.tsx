import type { CSSProperties } from "react";
import type { RenderElementProps } from "slate-react";

import { buildDynamicsGradient } from "../../constants/dynamicsSteps";
import type { SectionElement } from "../../types";
import { useCurrentUsername } from "../hooks";
import "./Section.css";

export const Section = ({ attributes, children, element }: RenderElementProps) => {
  const currentUsername = useCurrentUsername();
  const section = element as SectionElement;
  const collapsedFor = section.collapsedFor ?? [];
  const isCollapsed = !!currentUsername && collapsedFor.includes(currentUsername);

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
