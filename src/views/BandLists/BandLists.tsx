import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlusCircleIcon } from "@heroicons/react/24/outline";

import { fetchAPI } from "#utils/fetch-api";
import { SongsList } from "#components";
import { ToPageBar } from "#layout/PageBar/ToPageBar";
import { bandPath } from "#constants/routes";
import { useBand } from "#modules/Band/BandLayout";
import { Button } from "@/components/ui/button";

/**
 * Усі служіння гурту — картками з піснями всередині. Раніше цей екран був
 * сторінкою гурту; звідти його прибрали, бо картки з'їдали весь екран, і на
 * загальну інформацію про гурт місця не лишалось.
 */
export default function BandLists() {
  const navigate = useNavigate();
  const band = useBand();
  const [lists, setLists] = useState<any[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAPI(`/bands/${band.id}/lists`, {
      populate: { points: { populate: "*" }, band: true },
      sort: { date: "desc" },
    }).then((data) => {
      if (!cancelled) setLists(data?.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [band.id]);

  return (
    <>
      <ToPageBar>{band.name}</ToPageBar>

      <div className="flex justify-between items-center pb-4">
        <h1 className="text-3xl font-bold tracking-tight">Списки пісень</h1>
        <Button
          variant="ghost"
          onClick={() => navigate(bandPath.createList(band.id))}
        >
          <PlusCircleIcon className="w-5 h-5" />
          Створити
        </Button>
      </div>

      {lists?.length === 0 && (
        <div className="text-sm text-muted-foreground">Служінь ще немає</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {lists?.map((list: any) => (
          <SongsList key={list.id} list={list} bandId={band.id} />
        ))}
      </div>
    </>
  );
}
