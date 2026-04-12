import {ReactNode} from "react";
import {usePageHeaderArea} from "#layout/PageHeaderArea/hooks";

export function ToPageHeaderArea({ children }: { children: ReactNode | null }) {
  // this component exists to make Header applying explicit in page layout
  usePageHeaderArea(children);
  return null;
}
