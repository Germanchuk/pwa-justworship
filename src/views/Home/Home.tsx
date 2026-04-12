import React, { useEffect } from "react";
import { fetchAPI } from "../../utils/fetch-api";
import Card from "../../components/SongsList/SongsList";
import { useSelector } from "react-redux";

export default function Home() {
  const [lists, setLists] = React.useState([]);
  const user = useSelector((state: any) => state.user);
  useEffect(() => {
    fetchAPI("/myLists", { populate: ["songs", "band"] }).then((data) => {
      setLists(data.data);
    });
  }, []);
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight pb-4">
        Привіт, @{user?.username}
      </h1>
      {/* <ChurchSelector church={user?.church} />
      <BandSelector bands={user?.bands} currentBand={user?.currentBand} /> */}
      {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {lists.length && lists?.map((list) => <Card list={list} />)}
      </div> */}
      Дашборд - мотивація для юзера: пропозиції, рекомендації, додатись в
      церкву, додатись в гурт, статистика, поради по роботі в сервісі, обʼяви
    </>
  );
}
