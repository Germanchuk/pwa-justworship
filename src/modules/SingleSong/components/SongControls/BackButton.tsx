import {ArrowLeftIcon} from "@heroicons/react/24/outline";
import {Loader2} from "lucide-react";
import {useSelector} from "react-redux";
import {useNavigate} from "react-router-dom";

import {Button} from "@/components/ui/button";
import {MENU_TILE} from "./tile";

/**
 * Плаваюче «назад» екранів без нижнього бару — пісні й зібрання (`APP-25`,
 * `APP-38`). Веде туди, звідки прийшли. `idx` — лічильник записів історії,
 * який веде сам роутер: 0 означає, що екран — перший у сесії (посилання,
 * старт застосунку), і крок назад вивів би із застосунку. Тоді — `fallback`,
 * рівень вище за ієрархією. Режими пісні історії не додають (`MODE-26`), тож
 * і `idx` вони не зсувають.
 */
export const BackButton = ({ fallback }: { fallback: string }) => {
  const navigate = useNavigate();
  const isLoading = useSelector((state: any) => state.viewConfig.globalLoader);

  const goBack = () => {
    if ((window.history.state?.idx ?? 0) > 0) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={MENU_TILE}
      onClick={goBack}
      aria-label="Назад"
      title="Назад"
    >
      {isLoading ? (
        <Loader2 className="size-7 animate-spin" />
      ) : (
        <ArrowLeftIcon className="size-7" />
      )}
    </Button>
  );
};
