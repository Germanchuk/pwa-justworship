import {ReactNode} from "react";
import {usePageBarContent} from "#layout/PageBar/hooks";

/**
 * Поставити заголовок або керування сторінки у верхній бар. Окремий компонент,
 * а не голий хук, — щоб у розмітці сторінки було видно, що вона туди пише.
 */
export function ToPageBar({ children }: { children: ReactNode | null }) {
  usePageBarContent(children);
  return null;
}
