import React from "react";
import { useNavigate } from "react-router-dom";
import { Routes } from "../../../constants/routes";
import {fetchAPI} from "../../../utils/fetch-api";


export default function HolychordsModalContent() {
  const [url, setUrl] = React.useState();
  const navigate = useNavigate();
  function handleClick(url) {
    fetchAPI("/parseHolychords", {}, {
      method: "POST",
      body: JSON.stringify({ data: { url } }),
    })
      .then((data) => {
        navigate(`${Routes.PublicSongs}/${data.id}`);
      })
      .catch((e) => {
        console.error(e);
      });
  }
  return (
    <>
      <div className="flex gap-4 justify-between">
        <input
          className="block flex-1 border-0 ring-1 rounded-md py-1.5 pl-1 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm sm:leading-6"
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value as any);
          }}
        />
        <button className="btn btn-primary" onClick={() => handleClick(url)}>
          Імпортувати
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Інколи на чудо треба зачекати (зачекайте )
      </p>
    </>
  );
}
