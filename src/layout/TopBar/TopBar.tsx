import { Link } from "react-router-dom";
import { ChevronDownIcon, ChevronUpIcon, HomeIcon } from "@heroicons/react/24/outline";
import { Routes } from "#constants/routes";
import { useSelector } from "react-redux";
import classNames from "classnames";
import {PageBar} from "#layout/PageBar/PageBar";
import {usePageBar} from "#layout/PageBar/hooks";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

/**
 * Верхній бар оболонки: кнопка «додому», слот сторінки (`PageBar`) і кнопка
 * згортання. Живе ВИЩЕ роутів, тому вміст, який сторінки кладуть у слот,
 * не бачить їхніх React-контекстів — band беруть через `useBandOrNull()`.
 */
type Props = {
  visible: boolean;
  onToggle: () => void;
};

export default function TopBar({ visible, onToggle }: Props) {
  const isLoading = useSelector((state: any) => state.viewConfig.globalLoader);
  // Стан сторінки світиться рамкою центральної панелі — тієї самої, у якій
  // живуть її елементи. Бічні кнопки (додому, згортання) глобальні, тож
  // лишаються нейтральними: колір стосується сторінки, а не всієї оболонки.
  const { statusColor } = usePageBar();
  return (
    <>
      {/* Схований бар зникає з потоку цілком — саме його висоту й забирає
          сторінка під себе (див. `flex-1` у Container). */}
      {visible && (
        <div className={"top"}>
          <div className="w-full p-2">
            {/* pr-12 — місце під кнопку згортання: вона висить поверх бару
                на фіксованій позиції й не має накривати панель сторінки. */}
            <div className={`flex gap-2 pr-12`}>
              <div className="glass rounded-2xl p-1">
                <Button asChild variant="ghost" size="icon" className="rounded-full">
                  <Link to={Routes.Root}>
                    {isLoading ? <GlobalLoader /> : <HomeIcon className="animate__bounceIn h-6 w-6" />}
                  </Link>
                </Button>
              </div>

              <div
                className={
                  classNames(
                    "flex-1 flex gap-2 glass rounded-2xl p-1 items-center justify-end"
                  )
                }
                // Тільки колір: товщина рамки лишається штатною (1px), інакше
                // панель починає виглядати як попередження, а не як панель.
                style={statusColor ? { borderColor: statusColor } : undefined}
              >
                <PageBar />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Єдиний елемент оболонки, що не ховається ніколи: інакше шапку не було б
          чим повернути. Тому не в потоці бару, а fixed поверх нього. */}
      <div
        className="glass fixed right-2 z-40 rounded-2xl p-1"
        style={{ top: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={onToggle}
          aria-expanded={visible}
          aria-label={visible ? "Сховати шапку" : "Показати шапку"}
          title={visible ? "Сховати шапку" : "Показати шапку"}
        >
          {visible ? (
            <ChevronUpIcon className={"h-6 w-6"} />
          ) : (
            <ChevronDownIcon className={"h-6 w-6"} />
          )}
        </Button>
      </div>
    </>
  );
}

function GlobalLoader() {

  return (
      <Loader2 className="animate__bounceIn size-6 animate-spin" />
  );
}
