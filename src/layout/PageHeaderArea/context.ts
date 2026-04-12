import {createContext, ReactNode} from "react";

type PageHeaderContextType = {
  setHeader: (header: ReactNode | null) => void;
  header: ReactNode;
};

export const PageHeaderContext = createContext<PageHeaderContextType | null>(null);
