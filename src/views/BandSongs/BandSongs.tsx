import React, { useEffect } from "react";
import { fetchAPI } from "../../utils/fetch-api";
import { Link, useNavigate } from "react-router-dom";
import { bandPath } from "../../constants/routes";
import { useBand } from "#modules/Band/BandLayout";
import { PlusCircleIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

export default function BandSongs() {
  const [songs, setSongs] = React.useState([]);
  const navigate = useNavigate();
  const band = useBand();

  useEffect(() => {
    fetchAPI(`/bands/${band.id}/songs`).then((data) => {
      setSongs(data.data);
    });
  }, [band.id]);

  return (
    <>
      <div className="flex justify-between items-center pb-4">
        <h1 className="text-3xl font-bold tracking-tight">Пісні гурту</h1>
        <Button
          variant="ghost"
          onClick={() => navigate(bandPath.createSong(band.id))}
        >
          <PlusCircleIcon className="w-5 h-5"/>
          Додати
        </Button>
      </div>
      {songs?.length === 0 && <div>Поки пісень немає</div>}
      {songs?.length ? songs.map((song) => {
        return (
          <Link
            key={song.id}
            to={bandPath.song(band.id, song.id)}
            className="bg-muted p-3 rounded block mb-2"
          >
            {song.attributes.name}
          </Link>
        );
      }) : null}
    </>
  );
}
