import React, { useState, useRef, useEffect, CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DropdownProps {
  trigger: (isOpen: boolean) => ReactNode;
  children: ReactNode;
  position?: "bottom" | "top";
  align?: "start" | "end";
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  children,
  position = "bottom",
  align = "end",
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => setIsOpen((prev) => !prev);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const style: CSSProperties = {
    position: "absolute",
    zIndex: 50,
    [align === "end" ? "right" : "left"]: 0,
    top: position === "bottom" ? "calc(100% + 4px)" : undefined,
    bottom: position === "top" ? "calc(100% + 4px)" : undefined,
  };

  return (
    <div ref={dropdownRef} className="relative inline-block">
      <div onClick={handleToggle} className="cursor-pointer">
        {trigger(isOpen)}
      </div>
      {isOpen && (
        <div
          role="menu"
          style={style}
          className={cn(
            "min-w-44 rounded-md border bg-popover text-popover-foreground shadow-md p-1",
            "animate-in fade-in-0 zoom-in-95",
            position === "bottom" ? "slide-in-from-top-1" : "slide-in-from-bottom-1",
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
};
