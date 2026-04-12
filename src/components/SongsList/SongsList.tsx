import { Link } from "react-router-dom";
import { formatDate } from "../../utils/utils";
import { Routes } from "../../constants/routes";

export function SongsList({ list }) {
  return (
    <div className="rounded-lg p-3 bg-card-orange shadow-sm w-full ring-1 ring-card-orange-border">
      <Link
        to={Routes.BandShedule + "/" + list.id}
        className="text-xl font-semibold underline"
      >
        {formatDate(list?.attributes?.date)}
      </Link>
      <p className="text-neutral-content mb-2">
        {list?.attributes?.band?.data?.attributes?.name}
      </p>
      <ul className="list-inside space-y-2">
        {list.attributes.songs.data.map((song) => (
          <Link
            className="block bg-base-100 p-2 rounded"
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
