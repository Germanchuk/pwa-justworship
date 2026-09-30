import {createContext} from "react";

/** Підпис поточного пункту, прив'язаний до адреси, з якої його поставили. */
export type PageTitle = { path: string; title: string };

type PageBarContextType = {
  /**
   * Підпис поточного екрана в шляху нижнього бару — коли з адреси його не
   * вивести (дата списку). Решту підписів бар знає сам (`BottomBar/path.ts`).
   */
  setTitle: (title: PageTitle | null) => void;
  title: PageTitle | null;
  /**
   * Сторінка, якій бар не потрібен зовсім (пісня, зібрання, `APP-5`): тоді
   * оболонка не малює його, а сторінка ставить своє керування сама.
   */
  setHidden: (hidden: boolean) => void;
  hidden: boolean;
};

export const PageBarContext = createContext<PageBarContextType | null>(null);
