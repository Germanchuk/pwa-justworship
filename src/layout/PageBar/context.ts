import {createContext, ReactNode} from "react";

type PageBarContextType = {
  /** Вміст, який сторінка ставить у верхній бар (заголовок або керування). */
  setContent: (content: ReactNode | null) => void;
  content: ReactNode;
  /**
   * Колір стану сторінки — ним світиться рамка центральної панелі, або
   * `null` (звичайна рамка). Тим самим каналом, що й вміст: сторінка знає
   * свій стан, панель лише показує.
   */
  setStatusColor: (color: string | null) => void;
  statusColor: string | null;
};

export const PageBarContext = createContext<PageBarContextType | null>(null);
