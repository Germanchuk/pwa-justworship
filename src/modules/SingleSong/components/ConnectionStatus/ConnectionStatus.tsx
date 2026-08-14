import { usePageBarStatus } from "#layout/PageFooterArea/hooks";
import { useConnectionStatus } from "../../redux/selectors";

/**
 * Стан звʼязку з документом показує САМА панель — рамка тієї центральної
 * плитки, у якій живуть елементи пісні. Місця в шапці обмаль (режими, плеєр,
 * примітки), а індикатор, який 99% часу каже «все добре», найдорожчий на
 * цьому місці: він займає кнопку, не будучи кнопкою. Рамка не займає нічого
 * й читається бічним зором — саме так, як цей стан і дивляться: не
 * вчитуючись, під час гри.
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

export function ConnectionStatus() {
  const key = useConnectionStatus();
  usePageBarStatus(COLOR[key] ?? null);

  // Колір — єдиний носій стану для ока, тож текст лишається для читалок:
  // місця він не займає, а без нього стан для них просто зник би.
  return (
    <span className="sr-only" role="status">
      {LABEL[key] ?? key}
    </span>
  );
}
