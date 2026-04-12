import React, { useEffect } from "react";
import { fetchAPI } from "../../utils/fetch-api";
import {Link, useNavigate} from "react-router-dom";
import { Routes } from "../../constants/routes";
import {PlusCircleIcon} from "@heroicons/react/24/outline";

export default function SongsList() {
  const [songs, setSongs] = React.useState([]);
  const navigate = useNavigate();
  useEffect(() => {
    fetchAPI("/currentBandSongs").then((data) => {
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
        <button
          className="btn btb-ghost bg-create"
          onClick={() => navigate(Routes.CreateSong)}
        >
          <PlusCircleIcon className="w-5 h-5"/>
          Додати
        </button>
      </div>
      {songs.map((song) => {
        return (
          <Link
            to={`${Routes.PublicSongs}/${song.id}`}
            className="bg-base-200 p-3 rounded block mb-2"
          >
          {song.attributes.name}
          </Link>
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
