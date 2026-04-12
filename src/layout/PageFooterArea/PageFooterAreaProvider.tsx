import {ReactNode, useCallback, useState} from "react";
import {APP_TITLE} from "#constants/app";
import { PageFooterContext } from "./context";

const DefaultFooter = ({children}) => <h1 className="text-xl font-semibold">{children}</h1>;

const normalizeFooter = (footer: ReactNode | null) => {
  if (typeof footer === "string") {
    return <DefaultFooter>{footer}</DefaultFooter>;
  }
  return footer ?? <DefaultFooter>{APP_TITLE}</DefaultFooter>;
};

export const PageFooterProvider = ({ children }: { children: ReactNode }) => {
  const [footer, _setFooter] = useState<ReactNode>(<DefaultFooter>{APP_TITLE}</DefaultFooter>);

  const setFooter = useCallback((footer: ReactNode | null) => {
    const normalized = normalizeFooter(footer);
    _setFooter(normalized);
  }, []);

  return (
    <PageFooterContext.Provider value={{ footer, setFooter }}>
      {children}
    </PageFooterContext.Provider>
  );
}
