import {ReactNode} from "react";
import {usePageFooterArea} from "#layout/PageFooterArea/hooks";

export function ToPageFooterArea({ children }: { children: ReactNode | null }) {
  // this component exists to make Header applying explicit in page layout
  usePageFooterArea(children);
  return null;
}
