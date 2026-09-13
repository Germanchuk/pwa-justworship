import {createContext, ReactNode} from "react";

type PageBarContextType = {
  /** Вміст, який сторінка ставить у верхній бар (заголовок або керування). */
  setContent: (content: ReactNode | null) => void;
  content: ReactNode;
  /**
   * Сторінка, якій бар не потрібен зовсім (пісня, `APP-24`): тоді оболонка
   * не малює його, а сторінка ставить своє керування сама.
   */
  setHidden: (hidden: boolean) => void;
  hidden: boolean;
};

export const PageBarContext = createContext<PageBarContextType | null>(null);
