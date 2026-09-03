import type { RenderElementProps } from "slate-react";
import { DisplayToggles } from "../../display/DisplayToggles";
import "./SongMetaRow.css";

export function SongMetaRow({ attributes, children }: RenderElementProps) {
  return (
    <div {...attributes} className="song-meta-row">
      {children}
      <DisplayToggles />
    </div>
  );
}
