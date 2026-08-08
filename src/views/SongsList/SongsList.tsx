import React, { useEffect } from "react";
import { fetchAPI } from "../../utils/fetch-api";
import {useNavigate} from "react-router-dom";
import { Routes } from "../../constants/routes";
import {PlusCircleIcon} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

/**
 * УВАГА: в'юшка більше не підключена до роутера — її замінив
 * `views/BandSongs`, який працює в контексті гурту з URL. Лишена як мертвий
 * код до рішення про видалення; ендпоінта, який вона смикає, вже немає.
 */
export default function SongsList() {
  const [songs, setSongs] = React.useState([]);
  const navigate = useNavigate();
  useEffect(() => {
    fetchAPI("/myBands").then((data) => {
      setSongs(data.data);
    });
  }, []);

  if (songs.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex justify-between items-center pb-4">
        <h1 className="text-3xl font-bold tracking-tight">Всі пісні</h1>
        <Button
          variant="ghost"
          onClick={() => navigate(Routes.Root)}
        >
          <PlusCircleIcon className="w-5 h-5"/>
          Додати
        </Button>
      </div>
      {songs.map((song) => {
        return (
          <div key={song.id} className="bg-muted p-3 rounded block mb-2">
          {song.attributes.name}
          </div>
        );
      })}
    </>
  );
}

function AddIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="size-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}
