import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PlusIcon, UserGroupIcon } from "@heroicons/react/24/outline";

import { fetchAPI } from "#utils/fetch-api";
import { ToPageBar } from "#layout/PageBar/ToPageBar";
import { bandPath } from "#constants/routes";
import { formatDate } from "#utils/utils";
import { useBand } from "#modules/Band/BandLayout";
import { bandApi, type BandMember } from "#modules/Band/api/band";
import { Button } from "@/components/ui/button";

/** Скільки рядків показує прев'ю секції. Далі — «усі …». */
const PREVIEW_SIZE = 4;
/** Скільки аватарів влазить у рядок на вузькому екрані; решта — «+N». */
const AVATARS_SHOWN = 6;

type ListRow = { id: number; attributes: { date: string } };
type SongRow = { id: number; attributes: { name: string } };

/**
 * Сторінка гурту — загальна інформація: хто в гурті, останні служіння,
 * останні пісні. Кожна секція показує лише прев'ю й веде на свій повний
 * екран; картки служінь з піснями всередині живуть тепер у `BandLists`.
 */
export default function BandHome() {
  const band = useBand();
  const [members, setMembers] = useState<BandMember[]>([]);
  const [lists, setLists] = useState<ListRow[] | null>(null);
  const [songs, setSongs] = useState<SongRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    bandApi
      .getMembers(band.id)
      .then(({ data }) => {
        if (!cancelled) setMembers(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });

    // Прев'ю служінь: лише дати, без пісень — деталі показує `BandLists`.
    fetchAPI(`/bands/${band.id}/lists`, {
      fields: ["date"],
      sort: { date: "desc" },
      pagination: { pageSize: PREVIEW_SIZE },
    }).then((data) => {
      if (!cancelled) setLists(data?.data ?? []);
    });

    fetchAPI(`/bands/${band.id}/songs`, {
      fields: ["name"],
      pagination: { pageSize: PREVIEW_SIZE },
    }).then((data) => {
      if (!cancelled) setSongs(data?.data ?? []);
    });

    return () => {
      cancelled = true;
    };
  }, [band.id]);

  return (
    <>
      <ToPageBar>{band.name}</ToPageBar>

      <MembersRow bandId={band.id} members={members} />

      <Section
        title="Списки пісень"
        createLabel="Створити новий список"
        createTo={bandPath.createList(band.id)}
        allLabel="Усі списки"
        allTo={bandPath.lists(band.id)}
        empty="Служінь ще немає"
        rows={lists}
        renderRow={(list) => ({
          key: list.id,
          to: bandPath.list(band.id, list.id),
          text: formatDate(list.attributes.date),
        })}
      />

      <Section
        title="Пісні"
        createLabel="Додати нову пісню"
        createTo={bandPath.createSong(band.id)}
        allLabel="Усі пісні"
        allTo={bandPath.songs(band.id)}
        empty="Поки пісень немає"
        rows={songs}
        renderRow={(song) => ({
          key: song.id,
          to: bandPath.song(band.id, song.id),
          text: song.attributes.name || "Без назви",
        })}
      />
    </>
  );
}

/** Ініціали для аватарки учасника: перші дві літери нікнейму. */
function initials(username = "") {
  return username.slice(0, 2).toUpperCase();
}

function MembersRow({
  bandId,
  members,
}: {
  bandId: number | string;
  members: BandMember[];
}) {
  const shown = members.slice(0, AVATARS_SHOWN);
  const rest = members.length - shown.length;

  return (
    <Link
      to={bandPath.members(bandId)}
      className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3 shadow-xs transition-colors hover:bg-accent/60"
    >
      {members.length === 0 ? (
        <span className="flex size-9 items-center justify-center rounded-full border border-dashed border-border text-foreground/50">
          <UserGroupIcon className="size-5" />
        </span>
      ) : (
        // -space-x-2 — аватарки заходять одна на одну, щоб рядок не ріс
        // ушир; біла обводка лишає їх різними на око.
        <span className="flex -space-x-2">
          {shown.map((member) => (
            <span
              key={member.id}
              title={member.username}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-semibold text-foreground/70"
            >
              {initials(member.username)}
            </span>
          ))}
          {rest > 0 && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-semibold text-foreground/70">
              +{rest}
            </span>
          )}
        </span>
      )}

      <span className="ml-auto shrink-0 text-sm font-semibold text-blue-900">
        Склад гурту →
      </span>
    </Link>
  );
}

type Row = { key: number; to: string; text: string | undefined };

function Section<T>({
  title,
  createLabel,
  createTo,
  allLabel,
  allTo,
  empty,
  rows,
  renderRow,
}: {
  title: string;
  createLabel: string;
  createTo: string;
  allLabel: string;
  allTo: string;
  empty: string;
  rows: T[] | null;
  renderRow: (row: T) => Row;
}) {
  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-border bg-background/60 shadow-xs">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold text-foreground/70">{title}</h2>
        <Button asChild variant="ghost" size="sm">
          <Link to={createTo}>
            <PlusIcon className="size-4" />
            {createLabel}
          </Link>
        </Button>
      </div>

      {/* `null` — ще вантажимо: краще порожнеча, ніж блимнути «немає». */}
      {rows === null ? (
        <div className="px-3 py-4 text-sm text-muted-foreground">…</div>
      ) : rows.length === 0 ? (
        <div className="px-3 py-4 text-sm text-muted-foreground">{empty}</div>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
          {rows.map((row) => {
            const { key, to, text } = renderRow(row);
            return (
              <li key={key}>
                <Link
                  to={to}
                  className="block truncate px-3 py-2.5 text-base transition-colors hover:bg-accent/60"
                >
                  {text}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        to={allTo}
        className="block border-t border-border px-3 py-2.5 text-center text-sm font-semibold text-blue-900 transition-colors hover:bg-accent/60"
      >
        {allLabel} →
      </Link>
    </section>
  );
}
