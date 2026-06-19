import { useEffect, useRef, useState } from "react";
import { useNotifications } from "../hooks/useNotifications";
import {
  notificationIcon,
  notificationMessage,
  notificationTab,
  relativeTime,
  type NotificationDTO,
} from "../lib/notifications.client";

interface NotificationBellProps {
  token: string;
  onNavigate?: (tab: "inbox" | "messages" | "profile") => void;
}

export function NotificationBell({ token, onNavigate }: NotificationBellProps) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(token);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleItemClick(n: NotificationDTO) {
    if (!n.read) markRead(n.id);
    setOpen(false);
    onNavigate?.(notificationTab(n));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-raised transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-accent text-surface">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop — dims background and captures outside taps */}
          <div className="fixed inset-0 z-40 bg-black/30" aria-hidden="true" onClick={() => setOpen(false)} />
          {/* Panel — centered near top on mobile, anchored by the sidebar on desktop */}
          <div className="fixed left-1/2 -translate-x-1/2 top-16 sm:left-20 sm:bottom-4 sm:top-auto sm:translate-x-0 w-[calc(100vw-2rem)] sm:w-80 max-h-[70vh] bg-surface border border-border/50 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
              <h3 className="text-sm font-bold">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead()}
                  className="text-xs text-accent hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-text-muted">No notifications yet</div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleItemClick(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-border/30 last:border-0 transition-colors hover:bg-surface-raised ${
                      n.read ? "" : "bg-accent/5"
                    }`}
                  >
                    <span className="text-lg leading-none mt-0.5 shrink-0">{notificationIcon(n)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-text">{notificationMessage(n)}</span>
                      <span className="block text-xs text-text-muted mt-0.5">{relativeTime(n.createdAt)}</span>
                    </span>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
