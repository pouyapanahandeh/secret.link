import { useEffect, useRef, useState } from "react";
import { NOTIFICATION_PAGE_SIZE, useNotifications } from "../hooks/useNotifications";
import type { NotificationDTO } from "../lib/notifications.client";
import { notificationTab } from "../lib/notifications.client";
import { NotificationHistoryDrawer, NotificationItem } from "./NotificationHistoryDrawer";

const BADGE_OPENED_KEY = "sl_notif_bell_opened_at";

interface NotificationBellProps {
  token: string;
  onNavigate?: (tab: "inbox" | "messages" | "profile") => void;
}

function readOpenedAt() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(BADGE_OPENED_KEY);
  } catch {
    return null;
  }
}

export function NotificationBell({ token, onNavigate }: NotificationBellProps) {
  const { notifications, unreadCount, hasMore, loadingMore, markRead, loadMore } = useNotifications(token);
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState<string | null>(readOpenedAt);
  const ref = useRef<HTMLDivElement | null>(null);

  const preview = notifications.slice(0, NOTIFICATION_PAGE_SIZE);
  const canOpenHistory = hasMore || notifications.length > NOTIFICATION_PAGE_SIZE;

  const badgeCount = openedAt
    ? notifications.filter((n) => n.createdAt > openedAt).length
    : unreadCount;
  const showBadge = !open && badgeCount > 0;
  const badgeLabel = badgeCount > 9 ? "9+" : String(badgeCount);

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

  function clearBadge() {
    const now = new Date().toISOString();
    setOpenedAt(now);
    try {
      localStorage.setItem(BADGE_OPENED_KEY, now);
    } catch {
      /* ignore */
    }
  }

  function toggleOpen() {
    setOpen((wasOpen) => {
      if (!wasOpen) clearBadge();
      return !wasOpen;
    });
  }

  function handleItemClick(n: NotificationDTO) {
    if (!n.read) void markRead(n.id);
    setOpen(false);
    setHistoryOpen(false);
    onNavigate?.(notificationTab(n));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={showBadge ? `Notifications, ${badgeCount} new` : "Notifications"}
        aria-expanded={open}
        onClick={toggleOpen}
        className="relative p-1.5 rounded-full text-text-muted hover:text-text hover:bg-surface-raised transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {showBadge && (
          <span className="copy-btn-pop absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-extrabold rounded-full bg-accent text-black">
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" aria-hidden="true" onClick={() => setOpen(false)} />
          <div className="fixed left-1/2 -translate-x-1/2 top-16 sm:left-20 sm:bottom-4 sm:top-auto sm:translate-x-0 w-[calc(100vw-2rem)] sm:w-80 max-h-[min(70vh,28rem)] bg-surface border border-border shadow-xl z-50 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div>
                <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent">Inbox</p>
                <h3 className="text-sm font-extrabold tracking-tight">Notifications</h3>
              </div>
            </div>

            <div className="overflow-y-auto">
              {preview.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-text-muted">No notifications yet</div>
              ) : (
                <div className="divide-y divide-border">
                  {preview.map((n) => (
                    <NotificationItem key={n.id} notification={n} onClick={() => handleItemClick(n)} />
                  ))}
                </div>
              )}
            </div>

            {canOpenHistory && (
              <div className="shrink-0 border-t border-border p-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setHistoryOpen(true);
                  }}
                  className="w-full min-h-10 rounded-full border border-border bg-surface-raised text-xs font-extrabold hover:border-accent transition-colors"
                >
                  Notification history
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {historyOpen && (
        <NotificationHistoryDrawer
          notifications={notifications}
          hasMore={hasMore}
          loading={loadingMore}
          onLoadMore={() => void loadMore()}
          onSelect={handleItemClick}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}
