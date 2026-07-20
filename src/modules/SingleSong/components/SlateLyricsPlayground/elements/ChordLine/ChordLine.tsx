import { useCallback, useMemo } from "react";
import type { MouseEvent } from "react";
import type { RenderElementProps } from "slate-react";
import { useSlateStatic } from "slate-react";

import ChordsProgressionPlayer from "../../../../services/ChordsProgressionPlayer/ChordsProgressionPlayer";
import { useCurrentUsername, useFirstInSectionInfo } from "../hooks";
import { resolveTransposition } from "../../transposition/operations";
import { SectionControls } from "../SectionControls/SectionControls";
import "./ChordLine.css";

export const ChordLine = ({ attributes, children, element }: RenderElementProps) => {
  const { isFirst } = useFirstInSectionInfo(element);
  const player = useMemo(() => ChordsProgressionPlayer.getInstance(), []);
  const editor = useSlateStatic();
  const username = useCurrentUsername();
  // Капо активне → акорди показані у моїй тональності, а редагування заблоковане
  // (`withCapoGuard`). Даємо візуальний cue, щоб не дивувало "чому не друкується".
  const capoLocked = resolveTransposition(editor, username).myCapo > 0;

  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const target = (e.target as HTMLElement | null)?.closest?.(
        "[data-chord-token-key]",
      ) as HTMLElement | null;
      if (!target) return;
      const key = target.dataset.chordTokenKey;
      if (!key) return;
      e.preventDefault();
      e.stopPropagation();
      const current = player.getStartChordTokenKey();
      player.setStartChordTokenKey(current === key ? null : key);
    },
    [player],
  );

  return (
    <div
      className={`chord-line ${capoLocked ? "chord-line--capo-locked" : ""}`}
      {...attributes}
      onMouseDown={handleMouseDown}
      title={
        capoLocked
          ? "Капо застосовано — зніміть його, щоб редагувати акорди"
          : undefined
      }
    >
      {children}
      {isFirst && <SectionControls lineElement={element} />}
    </div>
  );
};
