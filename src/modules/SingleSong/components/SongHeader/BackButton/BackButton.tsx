import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const BackButton = () => {
  const navigate = useNavigate();
  const handleClick = () => navigate(-1);

  return (
    <Button variant="ghost" size="sm" className="h-7 size-7 p-0" onClick={handleClick}>
      <ArrowLeftIcon className={"w-5 h-5"} />
    </Button>
  )
}
