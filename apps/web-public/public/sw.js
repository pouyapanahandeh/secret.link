const CACHE_NAME = "secretlink-v11";
const PRECACHE_URLS = ["/secretlink.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  let payload = { title: "Secretlink", body: "You have a new notification", tab: "inbox" };
  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    /* keep defaults */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/secretlink.png",
      badge: "/secretlink.png",
      data: payload,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const tab = event.notification.data?.tab ?? "inbox";
  const target = `/dashboard?tab=${encodeURIComponent(tab)}`;
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if ("focus" in client) {
          if ("navigate" in client) {
            await client.navigate(target);
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  // Never intercept SSE streams — they must stay open
  if (event.request.url.includes("/v1/dms/stream") || event.request.url.includes("/v1/notifications/stream")) {
    return;
  }
  // Network-first for navigation and API calls
  if (event.request.mode === "navigate" || event.request.url.includes("/v1/")) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
