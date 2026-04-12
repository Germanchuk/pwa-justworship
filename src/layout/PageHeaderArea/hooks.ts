import {ReactNode, useContext, useEffect} from "react";
import {PageHeaderContext} from "#layout/PageHeaderArea/context";

export const usePageHeader = () => {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) throw new Error("usePageHeader must be used inside PageHeaderAreaProvider");
  return ctx;
}

export const usePageHeaderArea = (upcomingHeader: ReactNode | null) => {
  const { setHeader } = usePageHeader();

  useEffect(() => {
    setHeader(upcomingHeader);
    return () => setHeader(null);
  }, [upcomingHeader, setHeader]);
}
