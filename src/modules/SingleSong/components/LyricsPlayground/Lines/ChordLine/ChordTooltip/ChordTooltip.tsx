import { useEffect, useRef, useState, useMemo, useCallback, type RefObject } from "react";
import ReactDOM from "react-dom";
import classNames from "classnames";
import "./ChordTooltip.css";
import getChordImg from "#utils/getChordImg";
import ChordsProgressionPlayer from "../../../../../services/ChordsProgressionPlayer/ChordsProgressionPlayer";
import {useChordSequenceId} from "../../../ChordSequenceContext";
import { Loader2 } from "lucide-react";

const normalizeChord = (value: string) => value.trim().toLowerCase();

interface ChordTooltipProps {
  children: string;
}

const ChordTooltip = ({ children }: ChordTooltipProps) => {
  const [visible, setVisible] = useState(false);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const chordLabel = useMemo(() => String(children ?? "").trim(), [children]);
  const normalizedChord = useMemo(() => normalizeChord(chordLabel), [chordLabel]);
  const chordId = useChordSequenceId();
  const player = useMemo(() => ChordsProgressionPlayer.getInstance(), []);

  useEffect(() => {
    if (!normalizedChord) {
      setIsActive(false);
      return undefined;
    }

    return player.onChordChange((event) => {
      if (!event || event.chord == null) {
        setIsActive(false);
        return;
      }
      if (chordId != null) {
        setIsActive(event.id === chordId);
        return;
      }
      setIsActive(normalizeChord(event.chord) === normalizedChord);
    });
  }, [chordId, normalizedChord, player]);

  useEffect(() => player.onSelectedChordChange((selectedId) => {
    if (chordId == null || selectedId == null) {
      setIsSelected(false);
      return;
    }
    setIsSelected(selectedId === chordId);
  }), [chordId, player]);

  const handleSelect = useCallback(() => {
    if (chordId == null) return;
    const nextSelection = player.getStartChordId() === chordId ? null : chordId;
    player.setStartChordId(nextSelection);
  }, [chordId, player]);

  return (
    <span
      ref={triggerRef}
      className={classNames(
        "ChordTooltip__wrapper",
        {
          "ChordTooltip__wrapper--active": isActive,
          "ChordTooltip__wrapper--selected": isSelected,
        }
      )}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={handleSelect}
    >
      {children}
      {visible && <ChordContent triggerRef={triggerRef} chordName={children} />}
    </span>
  );
};

interface ChordContentProps {
  chordName: string;
  triggerRef: RefObject<HTMLSpanElement | null>;
}

function ChordContent({ chordName, triggerRef }: ChordContentProps) {
  const [src, setSrc] = useState<string | undefined>();
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getChordImg(chordName).then((data) => {
      setSrc(data);
    });
  }, [chordName]);

  useEffect(() => {
    if (triggerRef.current && contentRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const contentRect = contentRef.current.getBoundingClientRect();
      const containerPadding = 16;

      // Tooltip dimensions
      const contentWidth = contentRect.width;
      const contentHeight = contentRect.height;

      // Trigger dimensions and position
      const triggerTop = triggerRect.top;
      const triggerLeft = triggerRect.left;
      const triggerCenter = triggerLeft + triggerRect.width / 2;

      // Desired positions
      let desiredTop = triggerTop - contentHeight; // Above the trigger
      let desiredLeft = triggerCenter - contentWidth / 2;

      // Boundary checks
      const viewportWidth = window.innerWidth;

      // Adjust horizontally if it overflows
      if (desiredLeft < containerPadding) {
        desiredLeft = containerPadding; // Snap to left boundary
      } else if (desiredLeft + contentWidth > viewportWidth - containerPadding) {
        desiredLeft = viewportWidth - contentWidth - containerPadding; // Snap to right boundary
      }

      // Adjust vertically if it overflows
      if (desiredTop < containerPadding) {
        desiredTop = triggerRect.bottom; // Place below trigger if above overflows
      }

      // Apply styles
      contentRef.current.style.top = `${desiredTop}px`;
      contentRef.current.style.left = `${desiredLeft}px`;
    }
  }, [triggerRef, contentRef]);


  return ReactDOM.createPortal(
    <div
      ref={contentRef}
      className="ChordTooltip shadow-xl bg-background rounded ring-1 ring-border"
    >
      {src ? (
        <div className="w-72">
          <img className="w-full" alt="chord" src={src} />
        </div>
      ) : (
        <div className="w-72 h-44 flex justify-center items-center">
          <Loader2 className="size-10 animate-spin" />
        </div>
      )}
    </div>,
    document.body
  );
}

export default ChordTooltip;
