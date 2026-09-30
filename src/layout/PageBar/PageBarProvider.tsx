import {ReactNode, useState} from "react";
import {PageBarContext, type PageTitle} from "./context";

export const PageBarProvider = ({ children }: { children: ReactNode }) => {
  const [title, setTitle] = useState<PageTitle | null>(null);
  const [hidden, setHidden] = useState(false);

  return (
    <PageBarContext.Provider value={{ title, setTitle, hidden, setHidden }}>
      {children}
    </PageBarContext.Provider>
  );
}
