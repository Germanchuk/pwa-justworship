import {ReactNode, useContext, useEffect, useLayoutEffect} from "react";
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
 * Прибрати верхній бар, поки сторінка відкрита. Layout-ефект, а не звичайний:
 * бар ховається до першого малювання, тож не блимає при відкритті сторінки.
 */
export const useHidePageBar = () => {
  const { setHidden } = usePageBar();

  useLayoutEffect(() => {
    setHidden(true);
    return () => setHidden(false);
  }, [setHidden]);
}
