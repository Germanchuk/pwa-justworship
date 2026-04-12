import {CheckCircleIcon, ClockIcon, ExclamationCircleIcon} from "@heroicons/react/24/outline";
import React from "react";

export const Status = ({status}) => {
  switch (status) {
    case "error":
      return <ExclamationCircleIcon className="w-5 h-5 text-error-content animate__bounceIn" />
    case "saved":
      return <CheckCircleIcon className="w-5 h-5 text-success-content animate__bounceIn" />
    case "saving":
      return <span className="loading loading-ring animate__bounceIn" />
    case "pending":
      return <ClockIcon className="w-5 h-5 text-neutral animate__bounceIn" />
  }
}
