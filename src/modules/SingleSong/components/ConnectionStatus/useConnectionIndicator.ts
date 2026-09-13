import { useConnectionStatus } from "../../redux/selectors";

/**
 * Стан звʼязку з документом показує рамка кнопки меню пісні (`COLLAB-5`) —
 * єдиної, що на очах і при закритому меню. Індикатор, який 99% часу каже
 * «все добре», найдорожчий, коли займає окрему кнопку, не будучи кнопкою.
 * Рамка не займає нічого й читається бічним зором — саме так, як цей стан і
 * дивляться: не вчитуючись, під час гри.
 *
 * Самі барви — у токенах теми (`index.css`), поруч з рештою паперової
 * палітри: теплі й приглушені, бо стан звʼязку супроводжує роботу, а не
 * кричить про себе. Чим гірший стан, тим колір темніший і щільніший.
 */
const COLOR: Record<string, string> = {
  connected: "var(--color-status-live)",
  connecting: "var(--color-status-pending)",
  disconnected: "var(--color-status-off)",
  error: "var(--color-status-error)",
};

const LABEL: Record<string, string> = {
  connecting: "Підключення…",
  connected: "Live",
  disconnected: "Офлайн",
  error: "Немає доступу",
};

/**
 * Колір — для ока, підпис — для читалок: без нього стан для них просто
 * зник би.
 */
export function useConnectionIndicator() {
  const key = useConnectionStatus();
  return { color: COLOR[key] ?? null, label: LABEL[key] ?? key };
}
