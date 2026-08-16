import {usePageBar} from "#layout/PageBar/hooks";

/**
 * Слот сторінки у верхньому барі: рендериться всередині `TopBar`, тобто ВИЩЕ
 * роутів. Наслідок — вміст, поставлений сюди, не бачить жодного React-контексту
 * з роутів (див. коментар у `TopBar`).
 */
export const PageBar = () => {
  const { content } = usePageBar();
  return content;
};
