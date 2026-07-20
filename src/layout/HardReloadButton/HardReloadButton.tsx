import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

/**
 * Плаваюча кнопка "hard reload" — висить у правому нижньому куті на кожній
 * сторінці застосунку (раніше була лише в Налаштуваннях). Верх зайнятий
 * sticky-баром (`.top`), тож кріпимо знизу праворуч.
 */
export default function HardReloadButton() {
  return (
    <Button
      variant="secondary"
      size="icon"
      onClick={() => window.location.reload()}
      title="Hard reload"
      aria-label="Hard reload"
      className="glass fixed bottom-20 right-4 z-50 rounded-full shadow-lg"
    >
      <ArrowPathIcon className="h-5 w-5" />
    </Button>
  );
}
