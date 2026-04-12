import { XMarkIcon } from "@heroicons/react/24/outline";
import { useDispatch, useSelector } from "react-redux";
import { removeNotification } from "#layout/slices/notificationsSlice";

export default function NotificationsCenter() {
  const notifications = useSelector((state: any) => state.notifications);
  const dispatch = useDispatch();
  return (
    <div className="toast toast-top toast-center w-screen">
      {notifications.map((notification: any) => {
        return (
          <div
            role="alert"
            key={notification.id}
            className={`block z-20 py-2 px-3 alert rounded-lg shadow-xl alert-${
              notification?.type ?? "info"
            }`}
          >
            <div className="w-full flex items-center justify-between gap-3">
              <span className="text-xl whitespace-break-spaces text-left">
                {notification.message}
              </span>
              <button
                className="btn btn-ghost btn-sm bg-transparent btn-square"
                onClick={() => dispatch(removeNotification(notification.id))}
              >
                <XMarkIcon />
              </button>
            </div>
          </div>
        );
      })}
      <div className="alert-error alert-info alert-success alert-warning" />
    </div>
  );
}
