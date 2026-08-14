import { useState } from "react";
import type { RenderElementProps } from "slate-react";
import { Node } from "slate";
import { useSlateStatic } from "slate-react";
import { useCanEditContent } from "../../../../mode";
import { extractHeader } from "../../../../services/ChordsProgressionPlayer/extractHeader";
import { setVoidText } from "../setVoidText";
import { BpmModal } from "./BpmModal";

/**
 * BPM рахує імпульси (одиниці знаменника), тож у 6/8 це вісімки — а вісімок
 * за хвилину природно виходить удвічі більше, ніж чвертей. Розмір читаємо
 * в момент відкриття: сусідній вузол мета-рядка міг змінитися після того, як
 * Slate востаннє перемалював саме цей елемент.
 */
const tempoScaleFor = (den: number) => ({
  max: den >= 8 ? 240 : 160,
  unitLabel: den >= 8 ? "вісімок/хв (BPM)" : "уд/хв (BPM)",
});

export function Bpm(props: RenderElementProps) {
  const { attributes, children, element } = props;
  const editor = useSlateStatic();
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(() => tempoScaleFor(4));
  // Мета пісні — спільний вміст: правиться лише в режимі редагування.
  const isReadonly = !useCanEditContent();
  const text = Node.string(element);
  const value = Number(text) || 0;
  const isEmpty = !text || value === 0;

  return (
    <div {...attributes} className="song-meta-line">
      <span
        contentEditable={false}
        className={`song-meta-badge ${isReadonly ? "song-meta-badge--readonly" : ""}`}
        title={isReadonly ? "Темп змінюється в режимі редагування" : undefined}
        onClick={() => {
          if (isReadonly) return;
          setScale(tempoScaleFor(extractHeader(editor.children).timeSignature[1]));
          setOpen(true);
        }}
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
        max={scale.max}
        unitLabel={scale.unitLabel}
        onSave={(n) => setVoidText(editor, element, n === 0 ? "" : String(n))}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
