import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  notificationIcon,
  notificationMessage,
  relativeTime,
  type NotificationDTO,
} from "../lib/notifications.client";

export function NotificationItem({
  notification,
  onClick,
}: {
  notification: NotificationDTO;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised ${
        notification.read ? "" : "bg-accent/5"
      }`}
    >
      <span className="text-lg leading-none mt-0.5 shrink-0">{notificationIcon(notification)}</span>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm ${notification.read ? "text-text-muted" : "text-text font-semibold"}`}>
          {notificationMessage(notification)}
        </span>
        <span className="block font-mono text-[10px] tracking-wide uppercase text-text-muted mt-0.5">
          {relativeTime(notification.createdAt)}
        </span>
      </span>
      {!notification.read && <span className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />}
    </button>
  );
}

export function NotificationHistoryDrawer({
  notifications,
  hasMore,
  loading,
  onLoadMore,
  onSelect,
  onClose,
}: {
  notifications: NotificationDTO[];
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  onSelect: (n: NotificationDTO) => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    const node = sentinelRef.current;
    const root = listRef.current;
    if (!node || !root || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { root, rootMargin: "160px", threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, notifications.length]);

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Notification history"
        className="drawer-slide-up relative z-10 w-full sm:max-w-lg max-h-[85vh] bg-surface border-t border-border sm:border sm:mb-6 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-start justify-between gap-4 px-5 pb-3 shrink-0">
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent">Inbox</p>
            <h2 className="text-lg font-extrabold tracking-tight">Notifications</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full border border-border text-text-muted hover:text-text flex items-center justify-center text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div ref={listRef} className="overflow-y-auto flex-1 border-t border-border">
          {notifications.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-text-muted">No notifications yet</p>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} onClick={() => onSelect(n)} />
              ))}
            </div>
          )}
          {hasMore && (
            <div ref={sentinelRef} className="py-5 text-center">
              <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-text-muted">
                {loading ? "Loading…" : "Scroll for more"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
