import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { fetchAPI } from "#utils/fetch-api";
import { ActionCard, SongsList } from "#components";
import { SubHeaderArea } from "#layout/SubHeaderArea/SubHeaderArea";
import { ToPageHeaderArea } from "#layout/PageHeaderArea/ToPageHeaderArea";
import { bandPath } from "#constants/routes";
import { useBand } from "#modules/Band/BandLayout";

export default function BandHome() {
  const navigate = useNavigate();
  const band = useBand();
  const [lists, setLists] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchAPI(`/bands/${band.id}/lists`, {
      populate: ["songs", "band"],
      sort: { date: "desc" },
    }).then((data) => {
      if (cancelled) return;
      setLists(data?.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [band.id]);

  return (
    <>
      <ToPageHeaderArea>{`Панель керування "${band.name}"`}</ToPageHeaderArea>
      <SubHeaderArea>
        <div className="col-span-2 grid grid-cols-2 gap-2">
          <ActionCard
            label="Створити новий список"
            onClick={() => navigate(bandPath.createList(band.id))}
          />
          <ActionCard
            label="Додати нову пісню"
            onClick={() => navigate(bandPath.createSong(band.id))}
          />
        </div>
      </SubHeaderArea>
      <div className="mt-6 mb-3 flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-2xl font-bold">Списки пісень</h2>
        <Link
          to={bandPath.members(band.id)}
          className="text-sm font-semibold text-blue-900 hover:underline"
        >
          Склад гурту →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {lists?.length
          ? lists.map((list: any) => (
              <SongsList key={list.id} list={list} bandId={band.id} />
            ))
          : null}
      </div>
    </>
  );
}
