import {CheckCircleIcon, ClockIcon, ExclamationCircleIcon} from "@heroicons/react/24/outline";
import React from "react";
import { Loader2 } from "lucide-react";

export const Status = ({status}) => {
  let icon: React.ReactNode = null;
  switch (status) {
    case "error":
      icon = <ExclamationCircleIcon className="w-4 h-4 text-destructive animate__bounceIn" />;
      break;
    case "saved":
      icon = <CheckCircleIcon className="w-4 h-4 text-green-700 animate__bounceIn" />;
      break;
    case "saving":
      icon = <Loader2 className="w-3.5 h-3.5 animate-spin animate__bounceIn" />;
      break;
    case "pending":
      icon = <ClockIcon className="w-4 h-4 text-muted-foreground animate__bounceIn" />;
      break;
  }
  return <span className="inline-flex items-center justify-center w-4 h-4 shrink-0">{icon}</span>;
}
