import { useConnectionStatus } from "../../redux/selectors";

const COLOR: Record<string, string> = {
  connecting: "bg-yellow-500",
  connected: "bg-green-500",
  disconnected: "bg-red-500",
  error: "bg-red-600",
};

const LABEL: Record<string, string> = {
  connecting: "Підключення…",
  connected: "Live",
  disconnected: "Офлайн",
  error: "Немає доступу",
};

export function ConnectionStatus() {
  const key = useConnectionStatus();

  return (
    <div
      className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-dashed border-input bg-background text-muted-foreground"
      role="status"
      aria-label={LABEL[key] ?? key}
      title={LABEL[key] ?? key}
    >
      <span
        className={`w-2 h-2 rounded-full ${COLOR[key] ?? "bg-gray-400"}`}
        aria-hidden
      />
    </div>
  );
}
