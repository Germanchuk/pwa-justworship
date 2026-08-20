import { Link } from "react-router-dom";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import { formatDate } from "../../utils/utils";
import { bandPath } from "../../constants/routes";
import { fromApi, songPointsOf, type SongPoint } from "#models/listPoint";

type SongsListProps = {
  list: any;
  /** Гурт, у контексті якого відкривати список і пісні. */
  bandId?: number | string;
};

/** Тональність і темп рядком — так, як їх показує картка. */
const meta = (point: SongPoint) =>
  `${point.songKey?.replace(/sharp/g, "#") ?? "-"} / ${point.bpm ?? "-"}`;

export function SongsList({ list, bandId }: SongsListProps) {
  // Без гурту нема куди вести — картка лишається, але лише як прев'ю.
  const clickable = bandId != null;
  const formattedDate = formatDate(list?.attributes?.date);
  const bandName = list?.attributes?.band?.data?.attributes?.name;

  // Картка показує саме ПІСНІ: примітки й програші лишаються всередині списку
  // (`LIST-12`) — у переліку служінь від них користі нема, а місце вони їдять.
  const songs = songPointsOf(fromApi(list?.attributes?.points));

  if (!clickable) {
    return (
      <div
        className="rounded-lg p-3 bg-muted shadow-sm w-full ring-1 ring-border opacity-60 grayscale cursor-not-allowed select-none"
        aria-disabled="true"
        title="Відкрийте цей список зі сторінки його гурту"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xl font-semibold text-neutral-content">
            {formattedDate}
          </span>
          <LockClosedIcon className="w-5 h-5 text-neutral-content" />
        </div>
        <p className="text-neutral-content mb-2">{bandName}</p>
        <ul className="list-inside space-y-2">
          {songs.map((point) => (
            <li
              key={point.key}
              className="flex justify-between bg-background p-2 rounded text-neutral-content"
            >
              <span>{point.name}</span>
              <span>{meta(point)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-3 bg-card-orange shadow-sm w-full ring-1 ring-card-orange-border">
      <Link
        to={bandPath.list(bandId, list.id)}
        className="text-xl font-semibold underline"
      >
        {formattedDate}
      </Link>
      <p className="text-neutral-content mb-2">{bandName}</p>
      <ul className="list-inside space-y-2">
        {songs.map((point) => (
          <Link
            key={point.key}
            className="block bg-background p-2 rounded"
            to={bandPath.song(bandId, point.songId)}
          >
            <li className="flex justify-between">
              <span>{point.name}</span>
              <span>{meta(point)}</span>
            </li>
          </Link>
        ))}
      </ul>
    </div>
  );
}

export default SongsList;
