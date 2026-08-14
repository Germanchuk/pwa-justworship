import {createContext, ReactNode} from "react";

type PageFooterContextType = {
  setFooter: (footer: ReactNode | null) => void;
  footer: ReactNode;
  /**
   * Колір стану сторінки — ним світиться рамка центральної панелі, або
   * `null` (звичайна рамка). Тим самим каналом, що й вміст: сторінка знає
   * свій стан, панель лише показує.
   */
  setStatusColor: (color: string | null) => void;
  statusColor: string | null;
};

export const PageFooterContext = createContext<PageFooterContextType | null>(null);
