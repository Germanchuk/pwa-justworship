import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import "./ChordTooltip.css";
import getChordImg from "../../../../utils/getChordImg";
import { Loader2 } from "lucide-react";

const ChordTooltip = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const triggerRef = useRef();

  return (
    <span
      ref={triggerRef}
      className="ChordTooltip__wrapper"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && <ChordContent triggerRef={triggerRef} chordName={children} />}
    </span>
  );
};

function ChordContent({ chordName, triggerRef }) {
  const [src, setSrc] = useState();
  const contentRef = useRef(null);

  useEffect(() => {
    getChordImg(chordName).then((data) => {
      setSrc(data);
    });
  }, []);

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
      const viewportHeight = window.innerHeight;
  
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
