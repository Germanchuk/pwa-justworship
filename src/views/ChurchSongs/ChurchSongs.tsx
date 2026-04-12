import React, {useCallback, useEffect, useState} from 'react'
import {fetchAPI} from "#utils/fetch-api";
import {addNotificationWithTimeout} from "#layout/slices/notificationsSlice";
import {useDispatch, useSelector} from "react-redux";
import BandSongs from "./BandSongs/BandSongs";
import {MagnifyingGlassIcon} from "@heroicons/react/24/outline";
import debounce from "lodash.debounce";

export default function ChurchSongs() {
  const [data, setData] = useState([]);
  const dispatch = useDispatch<any>();
  const currentBandId = useSelector((state: any) => state.user?.currentBand?.id);

  const [query, setQuery] = useState("");

  const debouncedSearch = useCallback(
    debounce((searchTerm) => {
      fetchAPI("/currentChurchSongs", {
        filters: {
          name: {
            $containsi: searchTerm,
          },
          hidden: { $eq: false },
        },
      })
        .then((data) => {
          setData(data); // Update state with API results
        })
        .catch((error) => {
          console.error("Error fetching data:", error);
        });
    }, 1000), // Adjust the delay as needed (e.g., 500ms)
    [debounce]
  );

  const handleChange = (event) => {
    const value = event.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  useEffect(() => {
    fetchAPI("/currentChurchSongs", {filters: {hidden: {$eq: false}}})
      .then(data => setData(data))
      .catch(() => {
        dispatch(addNotificationWithTimeout({
          type: "error",
          message: "Не вдалось завантажити пісні",
        }))
      })
  }, []);

  const sortedBands = [
    ...data.filter(({id}) => id === currentBandId),
    ...data.filter(({id}) => id !== currentBandId)
  ];

  return (
    <>
      <h1 className="text-2xl font-bold mb-2">Всі пісні церкви</h1>
      <label className="input input-bordered flex items-center gap-2 mb-2">
        <input
          type="text"
          className="grow"
          placeholder="Шукати пісню"
          value={query}
          onChange={handleChange}
        />
        <MagnifyingGlassIcon className="w-6 h-6"/>
      </label>
      <div>
        {sortedBands.length === 0 && (<div>Пісню {query} співає 0 гуртів</div>)}
        {sortedBands?.map((item) => (
          <BandSongs name={item.name} songs={item.songs}/>
        ))}
      </div>
    </>
  )
}
