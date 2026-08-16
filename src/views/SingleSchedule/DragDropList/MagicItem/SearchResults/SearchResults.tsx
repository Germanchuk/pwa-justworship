import { useEffect, useState, useCallback } from "react";
import debounce from "lodash.debounce";
import { fetchAPI } from "../../../../../utils/fetch-api";
import { useBandId } from "#modules/Band/BandLayout";

export default function SearchResults({ searchQuery, addItem, resetInput }) {
  const [results, setResults] = useState([]);
  const bandId = useBandId();

  const handleAddingItem = (item) => {
    addItem(item);
    resetInput();
  };

  const debouncedSearch = useCallback(
    debounce((searchTerm) => {
      fetchAPI(`/bands/${bandId}/songs`, {
        filters: {
          name: {
            $containsi: searchTerm,
          },
        },
      })
        .then((data) => {
          setResults(data.data); // Update state with API results
        })
        .catch((error) => {
          console.error("Error fetching data:", error);
        });
    }, 500), // Adjust the delay as needed (e.g., 500ms)
    [debounce, bandId]
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery]);

  if (results.length === 0) {
    return (
      <div className="px-3 py-2.5 text-sm text-muted-foreground">
        Нічого не знайшли
      </div>
    );
  }

  return (
    // Без flex-контейнера свідомо: у flex-колонці з `max-h` рядки стискаються
    // (`flex-shrink` за замовчуванням) і текст ріжеться по висоті.
    <ul className="m-0 max-h-64 list-none overflow-y-auto p-0">
      {results.map((song) => (
        <li
          className="cursor-pointer truncate rounded-lg px-3 py-2.5 text-base transition-colors hover:bg-accent/60"
          key={song.id}
          onClick={() => handleAddingItem({ id: song.id, ...song.attributes })}
        >
          {song.attributes.name}
        </li>
      ))}
    </ul>
  );
}
