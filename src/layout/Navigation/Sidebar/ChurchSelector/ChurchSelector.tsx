import {
  BuildingLibraryIcon,
  PlusCircleIcon,
} from "@heroicons/react/24/outline";
import { Link, useNavigate } from "react-router-dom";
import { Routes } from "#constants/routes";
import { Button } from "@/components/ui/button";

type Variant = "compact" | "hero";

interface ChurchSelectorProps {
  church: any;
  variant?: Variant;
}

export default function ChurchSelector({
  church,
  variant = "compact",
}: ChurchSelectorProps) {
  const navigate = useNavigate();

  if (variant === "hero") {
    if (!church) {
      return (
        <Button asChild variant="outline" className="h-auto w-full justify-start gap-3 p-4">
          <Link to={Routes.JoinChurch}>
            <span className="flex size-10 items-center justify-center rounded-md border border-border bg-background">
              <PlusCircleIcon className="size-5" />
            </span>
            <span className="flex flex-col items-start">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Церква
              </span>
              <span className="text-base font-semibold">Приєднатись до церкви</span>
            </span>
          </Link>
        </Button>
      );
    }
    return (
      <Link
        to={Routes.ChurchSongs}
        className="group flex w-full items-center gap-2.5 rounded-xl border bg-background/60 p-2.5 text-start shadow-xs transition-all hover:border-foreground/30 hover:bg-accent/60 hover:shadow-sm"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground/70 group-hover:text-foreground">
          <BuildingLibraryIcon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Церква
          </span>
          <span className="truncate text-base font-semibold leading-tight">
            {church?.name}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <div className="flex justify-between gap-2 py-1 pr-1 hover:bg-muted">
      <div className="flex items-center">
        <BuildingLibraryIcon className="h-5 w-5 mr-2" />
        Церква:
      </div>
      <div>
        {church ? (
          <Button variant="secondary" size="sm" className="w-44">
            {church?.name}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-44"
            onClick={() => navigate(Routes.JoinChurch)}
          >
            <PlusCircleIcon className="w-5 h-5" />
            Приєднатись
          </Button>
        )}
      </div>
    </div>
  );
}
