import { useState } from "react";
import type { RenderElementProps } from "slate-react";
import { Node } from "slate";
import { ReactEditor, useSlateStatic } from "slate-react";
import { setVoidText } from "../setVoidText";
import { BpmModal } from "./BpmModal";

export function Bpm(props: RenderElementProps) {
  const { attributes, children, element } = props;
  const editor = useSlateStatic();
  const [open, setOpen] = useState(false);
  const isReadonly = ReactEditor.isReadOnly(editor);
  const text = Node.string(element);
  const value = Number(text) || 0;
  const isEmpty = !text || value === 0;

  return (
    <div {...attributes} className="song-meta-line">
      <span
        contentEditable={false}
        className={`song-meta-badge ${isReadonly ? "song-meta-badge--readonly" : ""}`}
        onClick={() => !isReadonly && setOpen(true)}
      >
        <span className="song-meta-badge__label">Темп:</span>
        <span
          className={`song-meta-badge__value ${
            isEmpty ? "song-meta-badge__value--placeholder" : ""
          }`}
        >
          {value || 0}
        </span>
      </span>
      {children}
      <BpmModal
        open={open}
        current={value}
        onSave={(n) => setVoidText(editor, element, n === 0 ? "" : String(n))}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
