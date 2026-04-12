import React, { useEffect, useState, useCallback } from "react";
import debounce from "lodash.debounce";
import { fetchAPI } from "../../../../../utils/fetch-api";

export default function SearchResults({ searchQuery, addItem, resetInput }) {
  const [results, setResults] = useState([]);

  const handleAddingItem = (item) => {
    addItem(item);
    resetInput();
  };

  const debouncedSearch = useCallback(
    debounce((searchTerm) => {
      fetchAPI("/currentBandSongs", {
        filters: {
          name: {
            $containsi: searchTerm,
          },
        },
      })
        .then((data) => {
          console.log(data);
          setResults(data.data); // Update state with API results
        })
        .catch((error) => {
          console.error("Error fetching data:", error);
        });
    }, 500), // Adjust the delay as needed (e.g., 500ms)
    [debounce]
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery]);

  return (
    <ul className="flex flex-col gap-1 h-48 overflow-scroll">
      {results.map((song) => (
        <li
          className="rounded bg-base-200 px-2 py-1 hover:bg-base-300 cursor-pointer"
          key={song.id}
          onClick={() => handleAddingItem({ id: song.id, ...song.attributes })}
        >
          {song.attributes.name}
        </li>
      ))}
    </ul>
  );
}
