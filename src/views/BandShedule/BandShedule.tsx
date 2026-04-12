import React, { useEffect } from "react";
import { useSelector } from "react-redux";
import { fetchAPI } from "#utils/fetch-api";
import {SongsList} from "#components";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import {SubHeaderArea} from "#layout/SubHeaderArea/SubHeaderArea";
import {ToPageHeaderArea} from "#layout/PageHeaderArea/ToPageHeaderArea";
import {Routes} from "#constants/routes";

export default function BandShedule() {
  const navigate = useNavigate();
  const [lists, setLists] = React.useState([]);
  const user = useSelector((state: any) => state.user);
  useEffect(() => {
    fetchAPI("/currentBandLists", {
      populate: ["songs", "band"],
      sort: { date: "desc" },
    }).then((data) => {
      setLists(data.data);
    });
  }, []);

  const headerText = `Панель керування "${user?.currentBand?.name}"`;

  return (
    <>
      <ToPageHeaderArea>{headerText}</ToPageHeaderArea>
      {/*<div className="flex justify-between items-center gap-2 mb-3">*/}
      {/*  <h1 className="tracking-tight">*/}
      {/*    <span className="text-2xl font-bold">Дати служінь</span>*/}
      {/*  </h1>*/}
      {/*  <button*/}
      {/*    className="btn btb-ghost bg-create"*/}
      {/*    onClick={() => navigate(Routes.CreateBandShedule)}*/}
      {/*  >*/}
      {/*    <PlusCircleIcon className="w-5 h-5"/>*/}
      {/*    Додати*/}
      {/*  </button>*/}
      {/*</div>*/}
      <SubHeaderArea>
        <button
          onClick={() => navigate(Routes.CreateBandShedule)}
          className={"bg-gradient-to-tl from-gray-200 to-bg-gray-100 transition-all hover:bg-gray-300 cursor-pointer border border-gray-200 p-2 text-start text-gray-600 rounded-lg flex flex-col gap-1"}
        >
          <div>
            <PlusIcon className="w-7 h-7"/>
          </div>
          <div className={""}>
            Створити новий список
          </div>
        </button>
      </SubHeaderArea>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {lists?.length && lists?.map((list) => <SongsList list={list}/>)}
      </div>
    </>
  );
}
