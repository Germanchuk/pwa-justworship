import { Link } from "react-router-dom";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import { formatDate } from "../../utils/utils";
import { Routes } from "../../constants/routes";

type SongsListProps = {
  list: any;
  clickable?: boolean;
};

export function SongsList({ list, clickable = true }: SongsListProps) {
  const formattedDate = formatDate(list?.attributes?.date);
  const bandName = list?.attributes?.band?.data?.attributes?.name;

  if (!clickable) {
    return (
      <div
        className="rounded-lg p-3 bg-muted shadow-sm w-full ring-1 ring-border opacity-60 grayscale cursor-not-allowed select-none"
        aria-disabled="true"
        title="Перемкніть гурт, щоб відкрити цей список"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xl font-semibold text-neutral-content">
            {formattedDate}
          </span>
          <LockClosedIcon className="w-5 h-5 text-neutral-content" />
        </div>
        <p className="text-neutral-content mb-2">{bandName}</p>
        <ul className="list-inside space-y-2">
          {list.attributes.songs.data.map((song) => (
            <li
              key={song.id}
              className="flex justify-between bg-background p-2 rounded text-neutral-content"
            >
              <span>{song.attributes.name}</span>
              <span>
                {song.attributes.key?.replace(/sharp/g, "#") ?? "-"} /{" "}
                {song.attributes.bpm ?? "-"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-3 bg-card-orange shadow-sm w-full ring-1 ring-card-orange-border">
      <Link
        to={`${Routes.BandShedule}/${list.id}`}
        className="text-xl font-semibold underline"
      >
        {formattedDate}
      </Link>
      <p className="text-neutral-content mb-2">{bandName}</p>
      <ul className="list-inside space-y-2">
        {list.attributes.songs.data.map((song) => (
          <Link
            key={song.id}
            className="block bg-background p-2 rounded"
            to={`${Routes.PublicSongs}/${song.id}`}
          >
            <li className="flex justify-between">
              <span>{song.attributes.name}</span>
              <span>
                {song.attributes.key?.replace(/sharp/g, "#") ?? "-"} /{" "}
                {song.attributes.bpm ?? "-"}
              </span>
            </li>
          </Link>
        ))}
      </ul>
    </div>
  );
}

export default SongsList;
