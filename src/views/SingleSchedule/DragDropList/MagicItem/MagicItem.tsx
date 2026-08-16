import { PlusIcon } from "@heroicons/react/24/outline";
import { useCallback, useRef, useState } from "react";
import SearchResults from "./SearchResults/SearchResults";

/**
 * Останній рядок списку — додавання пісні. Виглядає як рядок «Створити новий
 * гурт» на головному екрані: пунктирний кружечок і поле замість назви.
 *
 * Окремої кнопки «додати» немає свідомо: пісня додається лише кліком по
 * знайденому результату — вводом з клавіатури пісню не створиш.
 */
export default function MagicItem({ addItem }) {
  const [isFocused, setIsFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef(null);

  const handleBlur = (e) => {
    // Check if the blur event happens because of a click inside the dropdown
    if (dropdownRef.current && dropdownRef.current.contains(e.relatedTarget)) {
      e.preventDefault();
      return;
    }
    setIsFocused(false);
  };

  const resetInput = useCallback(() => {
    setSearchQuery("");
  }, [setSearchQuery]);

  return (
    <li className="relative flex w-full items-center gap-3 rounded-b-xl border-t border-border p-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-foreground/50">
        <PlusIcon className="size-5" />
      </span>

      <input
        type="text"
        placeholder="Додати пісню"
        className="min-w-0 grow appearance-none bg-transparent text-base outline-0 placeholder:text-muted-foreground"
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {isFocused && (
        <div
          ref={dropdownRef}
          // z-20 і власне тло: без них випадайка просвічувала наскрізь і
          // ховалася під кнопкою видалення списку.
          className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-border bg-background p-1 shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          <SearchResults
            searchQuery={searchQuery}
            resetInput={resetInput}
            addItem={addItem}
          />
        </div>
      )}
    </li>
  );
}
