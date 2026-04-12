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
