import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useState } from "react";
import debounce from "lodash.debounce";
import { fetchAPI } from "../../utils/fetch-api";
import { Link } from "react-router-dom";
import { Routes } from "../../constants/routes";
import { Button } from "@/components/ui/button";

export default function JoinBand() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const debouncedSearch = useCallback(
    debounce((searchTerm) => {
      if (searchTerm) {
        fetchAPI("/bands", {
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
      } else {
        setResults([]); // Clear results if searchTerm is empty
      }
    }, 500), // Adjust the delay as needed (e.g., 500ms)
    [debounce]
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleChange = (event) => {
    const value = event.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Приєднатись до гурту</h1>
      <label className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs flex items-center gap-2">
        <input
          type="text"
          className="grow"
          placeholder="Шукати"
          value={query}
          onChange={handleChange}
        />
        <MagnifyingGlassIcon className="w-6 h-6" />
      </label>
      <div className="py-10 px-2">
        {!!query &&
          results?.length > 0 &&
          results.map((band, index) => (
            <Button asChild key={index} className="w-full">
              <Link to={`${Routes.JoinBand}/${band?.id}`}>
                {band?.attributes?.name}
              </Link>
            </Button>
          ))}

        {!!query && results?.length === 0 && (
          <p className="text-lg text-center">
            Гурт "{query}" не знайдено, ви можете його{" "}
            <Link to={Routes.CreateBand} className="underline font-semibold">
              зареєструвати
            </Link>{" "}
            .
          </p>
        )}

        {!query && results?.length === 0 && (
          <p className="text-lg text-center">
            Спробуйте знайти або{" "}
            <Link to={Routes.CreateBand} className="underline font-semibold">
              зареєстуйте
            </Link>{" "}
            свій гурт.
          </p>
        )}
      </div>
    </div>
  );
}
