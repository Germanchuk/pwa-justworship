import { PlusSmallIcon } from "@heroicons/react/24/outline";
import { useCallback, useRef, useState } from "react";
import SearchResults from "./SearchResults/SearchResults";

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
    <li className="flex gap-4 items-center py-1 border-b border-base-300 relative">
      <div className="w-10 h-8" />
      <form className="flex grow gap-2" onSubmit={(e) => e.preventDefault()}>
        <input
          type="text"
          placeholder="Новий пункт"
          className="outline-0 grow appearance-none"
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button className="btn btn-sm btn-square" type="submit">
          <PlusSmallIcon className="w-5 h-5" />
        </button>
        {/* <button className="btn btn-sm btn-square">
          <SparklesIcon className="w-5 h-5" />
        </button> */}
      </form>
      {isFocused && (
        <div
          ref={dropdownRef}
          className="absolute -bottom-1 right-0 left-0 translate-y-full p-2 rounded shadow-lg ring-1 ring-base-200"
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
