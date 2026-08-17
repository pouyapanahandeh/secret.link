import { useCallback, useEffect, useRef, useState } from "react";
import { getApiBase } from "../lib/api.client";
import type { NotificationDTO } from "../lib/notifications.client";

export const NOTIFICATION_PAGE_SIZE = 10;

interface UseNotificationsResult {
  notifications: NotificationDTO[];
  unreadCount: number;
  hasMore: boolean;
  loadingMore: boolean;
  markRead: (id: string) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotifications(token: string): UseNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sseRef = useRef<EventSource | null>(null);
  const loadingRef = useRef(false);
  const nextOffsetRef = useRef(0);
  const hasMoreRef = useRef(false);

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token],
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `${getApiBase()}/v1/notifications?limit=${NOTIFICATION_PAGE_SIZE}&offset=0`,
        { headers: authHeaders() },
      );
      if (!res.ok) return;
      const data = await res.json();
      const items = (data.notifications ?? []) as NotificationDTO[];
      setNotifications(items);
      setUnreadCount(data.unreadCount ?? 0);
      setHasMore(!!data.hasMore);
      const offset = Number(data.nextOffset ?? items.length);
      nextOffsetRef.current = offset;
      hasMoreRef.current = !!data.hasMore;
    } catch {
      /* offline / transient — keep previous state */
    }
  }, [authHeaders]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `${getApiBase()}/v1/notifications?limit=${NOTIFICATION_PAGE_SIZE}&offset=${nextOffsetRef.current}`,
        { headers: authHeaders() },
      );
      if (!res.ok) return;
      const data = await res.json();
      const items = (data.notifications ?? []) as NotificationDTO[];
      setNotifications((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...items.filter((n) => !seen.has(n.id))];
      });
      setHasMore(!!data.hasMore);
      const offset = Number(data.nextOffset ?? nextOffsetRef.current + items.length);
      nextOffsetRef.current = offset;
      hasMoreRef.current = !!data.hasMore;
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [authHeaders]);

  const markRead = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((count) => Math.max(0, count - 1));
      try {
        const res = await fetch(`${getApiBase()}/v1/notifications/read`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ id }),
        });
        if (res.ok) {
          const body = await res.json();
          if (typeof body.unreadCount === "number") setUnreadCount(body.unreadCount);
        }
      } catch {
        /* ignore */
      }
    },
    [authHeaders],
  );

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
                prev.some((n) => n.id === incoming.id) ? prev : [incoming, ...prev],
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

  return { notifications, unreadCount, hasMore, loadingMore, markRead, loadMore, refresh };
}
