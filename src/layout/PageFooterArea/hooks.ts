import {ReactNode, useContext, useEffect} from "react";
import {PageFooterContext} from "#layout/PageFooterArea/context";

export const usePageFooter = () => {
  const ctx = useContext(PageFooterContext);
  if (!ctx) throw new Error("usePageFooter must be used inside PageHeaderAreaProvider");
  return ctx;
}

export const usePageFooterArea = (upcomingFooter: ReactNode | null) => {
  const { setFooter } = usePageFooter();

  useEffect(() => {
    setFooter(upcomingFooter);
    return () => setFooter(null);
  }, [upcomingFooter, setFooter]);
}

/**
 * Показати стан сторінки рамкою центральної панелі. `null` — звичайна
 * рамка. Знімається при виході зі сторінки, тож чужий колір ніде не
 * лишається.
 */
export const usePageBarStatus = (color: string | null) => {
  const { setStatusColor } = usePageFooter();

  useEffect(() => {
    setStatusColor(color);
    return () => setStatusColor(null);
  }, [color, setStatusColor]);
}
