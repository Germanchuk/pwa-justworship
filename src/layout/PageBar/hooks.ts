import {useContext, useEffect, useLayoutEffect} from "react";
import {useLocation} from "react-router-dom";
import {PageBarContext} from "#layout/PageBar/context";

export const usePageBar = () => {
  const ctx = useContext(PageBarContext);
  if (!ctx) throw new Error("usePageBar must be used inside PageBarProvider");
  return ctx;
}

/**
 * Поставити підпис поточного екрана в бар. Підпис прив'язаний до адреси: бар
 * малює нову сторінку раніше, ніж стара встигає прибрати свій, і без цього
 * на кадр показав би чужу дату.
 */
export const usePageBarTitle = (title: string | null) => {
  const { setTitle } = usePageBar();
  const { pathname } = useLocation();

  useEffect(() => {
    setTitle(title ? { path: pathname, title } : null);
    return () => setTitle(null);
  }, [title, pathname, setTitle]);
}

/**
 * Прибрати бар, поки сторінка відкрита. Layout-ефект, а не звичайний:
 * бар ховається до першого малювання, тож не блимає при відкритті сторінки.
 */
export const useHidePageBar = () => {
  const { setHidden } = usePageBar();

  useLayoutEffect(() => {
    setHidden(true);
    return () => setHidden(false);
  }, [setHidden]);
}
