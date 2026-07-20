import { XMarkIcon } from "@heroicons/react/24/outline";
import { useDispatch, useSelector } from "react-redux";
import { removeNotification } from "#layout/slices/notificationsSlice";
import { Button } from "@/components/ui/button";
import classNames from "classnames";

const TYPE_CLASSES: Record<string, string> = {
  error: "border-destructive/50 text-destructive bg-destructive/10",
  info: "border-blue-500/50 text-blue-700 bg-blue-50",
  success: "border-green-500/50 text-green-700 bg-green-50",
  warning: "border-yellow-500/50 text-yellow-700 bg-yellow-50",
};

export default function NotificationsCenter() {
  const notifications = useSelector((state: any) => state.notifications);
  const dispatch = useDispatch();
  return (
    <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 p-4 w-screen items-center">
      {notifications.map((notification: any) => {
        const type = notification?.type ?? "info";
        return (
          <div
            role="alert"
            key={notification.id}
            className={classNames(
              "pointer-events-auto block z-20 py-2 px-3 rounded-lg shadow-xl border",
              TYPE_CLASSES[type] ?? TYPE_CLASSES.info
            )}
          >
            <div className="w-full flex items-center justify-between gap-3">
              <span className="text-xl whitespace-break-spaces text-left">
                {notification.message}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0"
                onClick={() => dispatch(removeNotification(notification.id))}
              >
                <XMarkIcon className="size-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
