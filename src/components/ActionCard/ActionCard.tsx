import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PlusIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

type ActionCardProps = {
  label: string;
  to?: string;
  onClick?: () => void;
  icon?: ReactNode;
  className?: string;
};

export function ActionCard({ label, to, onClick, icon, className }: ActionCardProps) {
  const inner = (
    <>
      <span className="flex size-10 items-center justify-center rounded-md border border-border/70 bg-background/60 text-foreground/70 transition-colors group-hover:border-foreground/30 group-hover:bg-background group-hover:text-foreground">
        {icon ?? <PlusIcon className="size-5" />}
      </span>
      <span className="font-['JetBrains_Mono'] text-sm leading-snug tracking-tight text-foreground/75 group-hover:text-foreground">
        {label}
      </span>
    </>
  );

  const classes = cn(
    "group flex min-h-[7rem] cursor-pointer flex-col items-start justify-between gap-3 rounded-xl border border-dashed border-border bg-background/40 p-4 text-start shadow-xs transition-all hover:border-foreground/30 hover:bg-accent/60 hover:shadow-sm",
    className,
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {inner}
    </button>
  );
}
