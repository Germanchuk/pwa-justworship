import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

export const BackButton = () => {
  const navigate = useNavigate();
  const handleClick = () => navigate(-1);

  return (
    <button className={"btn btn-sm btn-ghost h-7 btn-square"} onClick={handleClick}>
      <ArrowLeftIcon className={"w-5 h-5"} />
    </button>
  )
}
