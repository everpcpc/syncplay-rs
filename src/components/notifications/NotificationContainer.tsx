import { useNotificationStore } from "../../store/notifications";

export function NotificationContainer() {
  const notifications = useNotificationStore((state) => state.notifications);
  const removeNotification = useNotificationStore((state) => state.removeNotification);

  const getNotificationStyles = (type: string) => {
    switch (type) {
      case "success":
        return "app-toast app-toast-success";
      case "error":
        return "app-toast app-toast-error";
      case "warning":
        return "app-toast app-toast-warning";
      case "info":
      default:
        return "app-toast app-toast-info";
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
          )} p-4 rounded-lg shadow-lg animate-slide-in`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <span className="text-xl font-bold">{getNotificationIcon(notification.type)}</span>
              <p className="text-sm">{notification.message}</p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="app-text-muted hover:opacity-80 ml-4"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
