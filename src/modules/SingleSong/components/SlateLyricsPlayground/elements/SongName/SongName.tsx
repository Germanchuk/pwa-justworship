import type { RenderElementProps } from "slate-react";
import { Node } from "slate";

export function SongName({ attributes, children, element }: RenderElementProps) {
  const isEmpty = Node.string(element).length === 0;

  return (
    <h1
      {...attributes}
      className="song-name relative text-2xl font-bold text-[#1e3a8a] outline-none mb-1 min-h-[1.5em] pl-4"
    >
      {isEmpty && (
        <span
          contentEditable={false}
          className="absolute left-4 top-0 text-gray-400 font-bold pointer-events-none select-none"
        >
          Назва пісні
        </span>
      )}
      {children}
    </h1>
  );
}
