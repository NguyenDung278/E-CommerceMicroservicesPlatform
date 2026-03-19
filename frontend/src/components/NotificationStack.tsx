type NotificationTone = "info" | "success" | "error";

export type NotificationItem = {
  id: number;
  title: string;
  message: string;
  tone: NotificationTone;
};

type NotificationStackProps = {
  items: NotificationItem[];
  onDismiss: (id: number) => void;
};

export function NotificationStack({ items, onDismiss }: NotificationStackProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="notification-stack" aria-live="polite" aria-atomic="false">
      {items.map((item) => (
        <article
          className={`notification-toast notification-toast-${item.tone}`}
          key={item.id}
          role="status"
        >
          <div className="notification-toast-copy">
            <strong>{item.title}</strong>
            <p>{item.message}</p>
          </div>
          <button
            aria-label="Đóng thông báo"
            className="notification-toast-close"
            type="button"
            onClick={() => onDismiss(item.id)}
          >
            ×
          </button>
        </article>
      ))}
    </div>
  );
}
