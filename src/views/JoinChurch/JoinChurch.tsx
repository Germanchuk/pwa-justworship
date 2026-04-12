import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useState } from "react";
import debounce from "lodash.debounce";
import { fetchAPI } from "../../utils/fetch-api";
import { Link } from "react-router-dom";
import { Routes } from "../../constants/routes";

export default function JoinChurch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const debouncedSearch = useCallback(
    debounce((searchTerm) => {
      if (searchTerm) {
        fetchAPI("/churches", {
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
      <h1 className="text-2xl font-bold mb-2">Приєднатись до церкви</h1>
      <label className="input input-bordered flex items-center gap-2">
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
          results.map((church, index) => (
            <Link to={`${Routes.JoinChurch}/${church?.id}`} key={index} className="btn w-full">
              {church?.attributes?.name}
            </Link>
          ))}

        {!!query && results?.length === 0 && (
          <p className="text-lg text-center">
            Церкву "{query}" не знайдено, ви можете{" "}
            <Link to={Routes.CreateChurch} className="underline font-semibold">
              зареєструвати
            </Link>{" "}
            її.
          </p>
        )}

        {!query && results?.length === 0 && (
          <p className="text-lg text-center">
            Спробуйте знайти або{" "}
            <Link to={Routes.CreateChurch} className="underline font-semibold">
              зареєстуйте
            </Link>{" "}
            свою церкву.
          </p>
        )}
      </div>
    </div>
  );
}
