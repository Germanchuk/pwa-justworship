import { Link } from "react-router-dom";
import {Bars3Icon, HomeIcon } from "@heroicons/react/24/outline";
import { Routes } from "#constants/routes";
import { useSelector } from "react-redux";
import classNames from "classnames";
import {PageFooterArea} from "#layout/PageFooterArea/PageFooterArea";

export default function BottomBar() {
  const isLoading = useSelector((state: any) => state.viewConfig.globalLoader);
  // <div className="fixed inset-x-0 bottom-0 z-40 animate__zoomIn">
  return (
    <div className={"bottom"}>
      <div className="container mx-auto p-2 pb-0">
        <div className={`flex gap-2`}>
          <div className="glass rounded-t-2xl p-1">
            <Link to={Routes.Root} className={"btn btn-circle btn-ghost"}>
                {isLoading ? <GlobalLoader /> : <HomeIcon className="animate__bounceIn h-6 w-6" />}
            </Link>
          </div>

              <div
                className={
                  classNames(
                    "flex-1 flex gap-2 glass border-b-0 rounded-t-2xl p-1 items-center justify-end"
                  )
                }
              >
                <PageFooterArea />
              </div>

          <div className="glass rounded-t-2xl p-1">
              <label
                htmlFor="my-drawer-4"
                className="drawer-button btn btn-circle btn-ghost"
              >
                <Bars3Icon className={"h-6 w-6"} />
              </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function GlobalLoader() {

  return (
      <span className="animate__bounceIn loading loading-spinner loading-xl" />
  );
}
