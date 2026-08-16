import {
  ChatBubbleLeftEllipsisIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

/** Єдина точка зв'язку з розробником — підтримка живе тільки в Telegram. */
export const SUPPORT_TELEGRAM_URL = "https://t.me/w_platform_support";

/**
 * Запрошення написати в Telegram. Стоїть на головному екрані завжди, а не
 * лише в порожньому стані: питання виникають і в тих, у кого гурт уже є.
 */
export function SupportCard({ className }: { className?: string }) {
  return (
    <a
      href={SUPPORT_TELEGRAM_URL}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-foreground/25 bg-accent/60 p-3 text-start shadow-sm transition-all hover:border-foreground/40 hover:bg-accent hover:shadow-md active:scale-[0.99]",
        className,
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
        <ChatBubbleLeftEllipsisIcon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base font-semibold leading-tight underline decoration-foreground/30 underline-offset-4 group-hover:decoration-foreground">
          Питання? Пиши мені в телеграм
        </span>
        <span className="text-sm text-muted-foreground">
          Турбуй з будь-чого: не працює, незрозуміло, хочеться інакше 😀
        </span>
      </span>
      <ArrowTopRightOnSquareIcon className="size-5 shrink-0 text-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </a>
  );
}
