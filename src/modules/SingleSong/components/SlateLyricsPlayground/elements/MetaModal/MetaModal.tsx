import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export function MetaModal({ title, children, onClose }: Props) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg p-4 max-w-xs w-full"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-medium mb-3">{title}</div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
