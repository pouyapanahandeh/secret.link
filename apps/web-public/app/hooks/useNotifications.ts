import { useCallback, useEffect, useRef, useState } from "react";
import { getApiBase } from "../lib/api.client";
import type { NotificationDTO } from "../lib/notifications.client";

interface UseNotificationsResult {
  notifications: NotificationDTO[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Loads the current user's notifications and keeps them live via SSE.
 * Mirrors the DM stream pattern: POST for a short-lived ticket, then open an
 * EventSource (EventSource can't send Authorization headers).
 */
export function useNotifications(token: string): UseNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const sseRef = useRef<EventSource | null>(null);

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token],
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/v1/notifications`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      /* offline / transient — keep previous state */
    }
  }, [authHeaders]);

  const markRead = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      try {
        const res = await fetch(`${getApiBase()}/v1/notifications/read`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ id }),
        });
        if (res.ok) {
          const { unreadCount } = await res.json();
          if (typeof unreadCount === "number") setUnreadCount(unreadCount);
        }
      } catch {
        /* ignore */
      }
    },
    [authHeaders],
  );

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await fetch(`${getApiBase()}/v1/notifications/read`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
    } catch {
      /* ignore */
    }
  }, [authHeaders]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    refresh();

    (async () => {
      try {
        const ticketRes = await fetch(`${getApiBase()}/v1/notifications/stream-ticket`, {
          method: "POST",
          headers: authHeaders(),
        });
        if (!ticketRes.ok) return;
        const { ticket } = await ticketRes.json();
        if (cancelled) return;

        const url = `${getApiBase()}/v1/notifications/stream?ticket=${encodeURIComponent(ticket)}`;
        const sse = new EventSource(url);
        sseRef.current = sse;

        sse.addEventListener("notification", (e) => {
          try {
            const payload = JSON.parse((e as MessageEvent).data);
            const incoming: NotificationDTO | undefined = payload.notification;
            if (incoming) {
              setNotifications((prev) =>
                prev.some((n) => n.id === incoming.id) ? prev : [incoming, ...prev].slice(0, 50),
              );
            }
            if (typeof payload.unreadCount === "number") setUnreadCount(payload.unreadCount);
          } catch {
            /* ignore malformed event */
          }
        });
      } catch {
        /* SSE unavailable — list still loads via refresh() */
      }
    })();

    return () => {
      cancelled = true;
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [token, authHeaders, refresh]);

  return { notifications, unreadCount, markRead, markAllRead, refresh };
}
