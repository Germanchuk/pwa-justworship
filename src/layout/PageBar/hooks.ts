import {ReactNode, useContext, useEffect} from "react";
import {PageBarContext} from "#layout/PageBar/context";

export const usePageBar = () => {
  const ctx = useContext(PageBarContext);
  if (!ctx) throw new Error("usePageBar must be used inside PageBarProvider");
  return ctx;
}

/**
 * Поставити вміст сторінки у верхній бар. Знімається при виході зі сторінки,
 * тож чужий заголовок ніде не лишається.
 */
export const usePageBarContent = (content: ReactNode | null) => {
  const { setContent } = usePageBar();

  useEffect(() => {
    setContent(content);
    return () => setContent(null);
  }, [content, setContent]);
}

/**
 * Показати стан сторінки рамкою центральної панелі. `null` — звичайна
 * рамка. Знімається при виході зі сторінки, тож чужий колір ніде не
 * лишається.
 */
export const usePageBarStatus = (color: string | null) => {
  const { setStatusColor } = usePageBar();

  useEffect(() => {
    setStatusColor(color);
    return () => setStatusColor(null);
  }, [color, setStatusColor]);
}
