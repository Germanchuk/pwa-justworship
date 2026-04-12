import AnimateHeight from "react-animate-height";
import { useState } from "react";

export function Collapsible({Trigger, children, openByDefault = false}) {
  const [isOpen, setIsOpen] = useState(openByDefault);
  return (
    <div>
      <Trigger isOpen clickHandler={() => setIsOpen(v => !v)} />
      <AnimateHeight height={isOpen ? "auto" : 0}>
        {children}
      </AnimateHeight>
    </div>
  )
}