import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { fetchAPI } from "#utils/fetch-api";
import { ActionCard, SongsList } from "#components";
import { useNavigate } from "react-router-dom";
import { SubHeaderArea } from "#layout/SubHeaderArea/SubHeaderArea";
import { ToPageHeaderArea } from "#layout/PageHeaderArea/ToPageHeaderArea";
import { Routes } from "#constants/routes";
import BandSelector from "#layout/Navigation/Sidebar/BandSelector/BandSelector";
import ChurchSelector from "#layout/Navigation/Sidebar/ChurchSelector/ChurchSelector";
import ListsScopeSelector, { type ListsScope } from "./ListsScopeSelector";

const SCOPE_TO_ENDPOINT: Record<ListsScope, string> = {
  currentBand: "/currentBandLists",
  myBands: "/myLists",
  church: "/currentChurchLists",
};

export default function BandShedule() {
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [scope, setScope] = useState<ListsScope>("currentBand");
  const user = useSelector((state: any) => state.user);

  useEffect(() => {
    let cancelled = false;
    fetchAPI(SCOPE_TO_ENDPOINT[scope], {
      populate: ["songs", "band"],
      sort: { date: "desc" },
    }).then((data) => {
      if (cancelled) return;
      setLists(data?.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const headerText = `Панель керування "${user?.currentBand?.name}"`;
  const currentBandId = user?.currentBand?.id;

  return (
    <>
      <ToPageHeaderArea>{headerText}</ToPageHeaderArea>
      <SubHeaderArea>
        <ChurchSelector variant="hero" church={user?.church} />
        <BandSelector
          variant="hero"
          bands={user?.bands}
          currentBand={user?.currentBand}
        />
        <div className="col-span-2 grid grid-cols-2 gap-2">
          <ActionCard
            label="Створити новий список"
            onClick={() => navigate(Routes.CreateBandShedule)}
          />
          <ActionCard
            label="Додати нову пісню"
            onClick={() => navigate(Routes.CreateSong)}
          />
        </div>
      </SubHeaderArea>
      <div className="mt-6 mb-3 flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-2xl font-bold">Списки пісень</h2>
        <ListsScopeSelector
          value={scope}
          onChange={setScope}
          userBandsCount={user?.bands?.length ?? 0}
          hasChurch={!!user?.church}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {lists?.length
          ? lists.map((list: any) => {
              const listBandId = list?.attributes?.band?.data?.id;
              const clickable =
                scope === "currentBand" || listBandId === currentBandId;
              return (
                <SongsList key={list.id} list={list} clickable={clickable} />
              );
            })
          : null}
      </div>
    </>
  );
}
