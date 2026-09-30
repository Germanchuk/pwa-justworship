import {usePageBarTitle} from "#layout/PageBar/hooks";

/**
 * Поставити підпис поточного екрана в шлях нижнього бару. Окремий компонент,
 * а не голий хук, — щоб у розмітці сторінки було видно, що вона туди пише.
 */
export function ToPageBar({ children }: { children: string | null | undefined }) {
  usePageBarTitle(children ?? null);
  return null;
}
