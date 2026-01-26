import { useNotificationStore } from "../../store/notifications";

export function NotificationContainer() {
  const notifications = useNotificationStore((state) => state.notifications);
  const removeNotification = useNotificationStore(
    (state) => state.removeNotification
  );

  const getNotificationStyles = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-600 border-green-500";
      case "error":
        return "bg-red-600 border-red-500";
      case "warning":
        return "bg-yellow-600 border-yellow-500";
      case "info":
      default:
        return "bg-blue-600 border-blue-500";
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "warning":
        return "⚠";
      case "info":
      default:
        return "ℹ";
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`${getNotificationStyles(
            notification.type
          )} border-l-4 p-4 rounded shadow-lg text-white animate-slide-in`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <span className="text-xl font-bold">
                {getNotificationIcon(notification.type)}
              </span>
              <p className="text-sm">{notification.message}</p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-white hover:text-gray-200 ml-4"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
