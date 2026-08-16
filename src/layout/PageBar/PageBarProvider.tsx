import {ReactNode, useCallback, useState} from "react";
import {APP_TITLE} from "#constants/app";
import { PageBarContext } from "./context";

/**
 * Скільки символів заголовка влазить у центральну панель бару (~241px на
 * 375px) шрифтом Unbounded extrabold. Довше — обрізаємо з трьома крапками.
 */
const TITLE_MAX_LENGTH = 14;

const shorten = (title: string) =>
  title.length > TITLE_MAX_LENGTH
    ? `${title.slice(0, TITLE_MAX_LENGTH).trimEnd()}…`
    : title;

// `truncate` лишається страховкою: 14 широких літер усе одно можуть не влізти,
// а висота бару фіксована — переносити рядок не можна.
const DefaultTitle = ({children}) => <h1 className="w-full truncate text-xl font-extrabold font-['Unbounded'] text-center">{children}</h1>;

/** Рядок сторінка шле як заголовок; будь-що інше — як готову розмітку. */
const normalizeContent = (content: ReactNode | null) => {
  if (typeof content === "string") {
    return <DefaultTitle>{shorten(content)}</DefaultTitle>;
  }
  return content ?? <DefaultTitle>{APP_TITLE}</DefaultTitle>;
};

export const PageBarProvider = ({ children }: { children: ReactNode }) => {
  const [content, _setContent] = useState<ReactNode>(<DefaultTitle>{APP_TITLE}</DefaultTitle>);
  const [statusColor, setStatusColor] = useState<string | null>(null);

  const setContent = useCallback((content: ReactNode | null) => {
    _setContent(normalizeContent(content));
  }, []);

  return (
    <PageBarContext.Provider value={{ content, setContent, statusColor, setStatusColor }}>
      {children}
    </PageBarContext.Provider>
  );
}
