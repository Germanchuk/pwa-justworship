import {
  BuildingLibraryIcon,
  PlusCircleIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { Routes } from "#constants/routes";

export default function ChurchSelector({ church }) {
  const navigate = useNavigate();
  return (
    <div className="flex justify-between gap-2 py-1 pr-1 hover:bg-base-200">
      <div className="flex items-center">
        <BuildingLibraryIcon className="h-5 w-5 mr-2" />
        Церква:
      </div>
      <div>
        {church ? (
          <button
            className="btn btn-ghost btn-sm w-44 bg-base-300"
            // onClick={() => navigate(`${Routes.JoinChurch}/${church.id}`)}
          >
            {church?.name}
          </button>
        ) : (
          <button
            className="btn btn-sm btn-outline btn-base-200 w-44"
            onClick={() => navigate(Routes.JoinChurch)}
          >
            <PlusCircleIcon className="w-5 h-5" />
            Приєднатись
          </button>
        )}
      </div>
    </div>
  );
}
