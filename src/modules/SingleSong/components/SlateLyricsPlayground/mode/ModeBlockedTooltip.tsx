import { useEffect, useState } from "react";

import { onModeBlocked } from "./modeBlock";
import "./ModeBlockedTooltip.css";

// Новий обʼєкт стану щоразу → ре-рендер і перезапуск таймера авто-зникнення,
// навіть якщо спроба була в тій самій точці.
interface Pos {
  top: number;
  left: number;
}

export function ModeBlockedTooltip() {
  const [pos, setPos] = useState<Pos | null>(null);

  useEffect(
    () =>
      onModeBlocked(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);
        const caretRect = range.getBoundingClientRect();
        if (caretRect.width > 0 || caretRect.height > 0) {
          setPos({ top: caretRect.top, left: caretRect.left });
          return;
        }

        // Згорнута каретка в порожньому рядку дає нульовий rect — беремо рядок.
        const startEl =
          range.startContainer.nodeType === Node.TEXT_NODE
            ? range.startContainer.parentElement
            : (range.startContainer as Element);
        const lineRect = startEl?.getBoundingClientRect();
        if (!lineRect) return;
        setPos({
          top: lineRect.top,
          left: lineRect.left + lineRect.width / 2,
        });
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
      className="mode-blocked-tooltip"
      style={{ top: pos.top, left: pos.left }}
      role="status"
    >
      Змінювати пісню можна лише в режимі редагування — перемкніть режим у
      панелі знизу.
    </div>
  );
}
