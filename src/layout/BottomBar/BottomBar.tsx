import { Link } from "react-router-dom";
import {Bars3Icon, HomeIcon } from "@heroicons/react/24/outline";
import { Routes } from "#constants/routes";
import { useSelector } from "react-redux";
import classNames from "classnames";
import {PageFooterArea} from "#layout/PageFooterArea/PageFooterArea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type Props = {
  onMenuClick: () => void;
};

export default function BottomBar({ onMenuClick }: Props) {
  const isLoading = useSelector((state: any) => state.viewConfig.globalLoader);
  return (
    <div className={"top"}>
      <div className="container mx-auto p-2">
        <div className={`flex gap-2`}>
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
                    "flex-1 flex gap-2 glass border-t-0 rounded-2xl p-1 items-center justify-end"
                  )
                }
              >
                <PageFooterArea />
              </div>

          <div className="glass rounded-2xl p-1">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={onMenuClick}>
              <Bars3Icon className={"h-6 w-6"} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GlobalLoader() {

  return (
      <Loader2 className="animate__bounceIn size-6 animate-spin" />
  );
}
