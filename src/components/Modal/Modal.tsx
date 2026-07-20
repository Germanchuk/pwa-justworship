import React, {useEffect} from "react";
import { Button } from "@/components/ui/button";

export function Modal({ trigger = null, content, title, hideCloseButton = false }: any) {
  const ref = React.useRef(null);
  useEffect(() => {
    if (ref?.current && !trigger) {
      ref.current?.showModal();
    }
  });
  return (
    <>
      {trigger && React.cloneElement(trigger, {
        onClick: (e) => {
          if (trigger.props.onClick) {
            trigger.props.onClick(e);
          }

          ref.current?.showModal();
        },
      })}

      <dialog ref={ref} className="modal z-10">
        <div className="modal-box">
          <form method="dialog" className="flex justify-between items-center">
            {/* if there is a button in form, it will close the modal */}
            {title && (<h4 className="text-lg">{title}</h4>)}
            {!hideCloseButton && <Button variant="ghost" size="icon" className="size-8 rounded-full">
              <CloseIcon />
            </Button>}
          </form>
          <div className="pt-4">
            {content}
          </div>
        </div>
      </dialog>
    </>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="size-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18 18 6M6 6l12 12"
      />
    </svg>
  );
}
