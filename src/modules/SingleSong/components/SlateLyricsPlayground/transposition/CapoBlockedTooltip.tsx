import { useEffect, useState } from "react";

import { onCapoBlocked } from "./capoBlock";
import "./CapoBlockedTooltip.css";

// Новий обʼєкт стану щоразу → ре-рендер і перезапуск таймера авто-зникнення,
// навіть якщо спроба була в тій самій точці.
interface Pos {
  top: number;
  left: number;
}

export function CapoBlockedTooltip() {
  const [pos, setPos] = useState<Pos | null>(null);

  useEffect(
    () =>
      onCapoBlocked(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);
        const startEl =
          range.startContainer.nodeType === Node.TEXT_NODE
            ? range.startContainer.parentElement
            : (range.startContainer as Element);
        const chordEl = startEl?.closest?.(".chord-line") as HTMLElement | null;
        if (!chordEl) return;

        const lineRect = chordEl.getBoundingClientRect();
        const caretRect = range.getBoundingClientRect();
        const hasCaret = caretRect.width > 0 || caretRect.height > 0;
        const left = hasCaret ? caretRect.left : lineRect.left + lineRect.width / 2;

        setPos({ top: lineRect.top, left });
      }),
    [],
  );

  useEffect(() => {
    if (!pos) return;
    const t = setTimeout(() => setPos(null), 2400);
    return () => clearTimeout(t);
  }, [pos]);

  if (!pos) return null;

  return (
    <div
      className="capo-blocked-tooltip"
      style={{ top: pos.top, left: pos.left }}
      role="status"
    >
      Капо ввімкнено — акорди показані у вашій тональності й заблоковані. Щоб
      редагувати, вимкніть капо кнопкою ⏻ біля «Капо».
    </div>
  );
}
