import {ReactNode, useCallback, useState} from "react";
import {APP_TITLE} from "#constants/app";
import { PageHeaderContext } from "./context";

const DefaultHeader = ({children}) => <h1 className="text-xl font-semibold">{children}</h1>;

const normalizeHeader = (header: ReactNode | null) => {
  if (typeof header === "string") {
    return <DefaultHeader>{header}</DefaultHeader>;
  }
  return header ?? <DefaultHeader>{APP_TITLE}</DefaultHeader>;
};

export const PageHeaderProvider = ({ children }: { children: ReactNode }) => {
  const [header, _setHeader] = useState<ReactNode>(<DefaultHeader>{APP_TITLE}</DefaultHeader>);

  const setHeader = useCallback((header: ReactNode | null) => {
    const normalized = normalizeHeader(header);
    _setHeader(normalized);
  }, []);

  return (
    <PageHeaderContext.Provider value={{ header, setHeader }}>
      {children}
    </PageHeaderContext.Provider>
  );
}
