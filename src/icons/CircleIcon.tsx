import React from "react";

export default function CircleIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="size-6"
      {...props}
    >
      <circle
    cx="12"
    cy="12"
    r="9"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
    </svg>
  );
}
