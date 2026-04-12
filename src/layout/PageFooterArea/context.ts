import {createContext, ReactNode} from "react";

type PageFooterContextType = {
  setFooter: (footer: ReactNode | null) => void;
  footer: ReactNode;
};

export const PageFooterContext = createContext<PageFooterContextType | null>(null);
