import type { RenderElementProps } from "slate-react";
import { DisplayToggles } from "../../display/DisplayToggles";
import { useSongMetaHidden } from "../../display/useSongMeta";
import "./SongMetaRow.css";

export function SongMetaRow({ attributes, children }: RenderElementProps) {
  // Разом із рядком ховаються і перемикачі показу, що в ньому живуть —
  // повернути шапку можна кнопкою в панелі пісні, яка не ховається.
  const hidden = useSongMetaHidden();

  return (
    <div
      {...attributes}
      className={`song-meta-row${hidden ? " song-row--hidden" : ""}`}
    >
      {children}
      <DisplayToggles />
    </div>
  );
}
