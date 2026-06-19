const CACHE_NAME = "secretlink-v9";
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

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Never intercept SSE streams — they must stay open
  if (url.pathname.startsWith("/v1/dms/stream")) {
    return;
  }

  // Network-first for navigation and API calls
  if (event.request.mode === "navigate" || url.pathname.startsWith("/v1/")) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for same-origin static assets
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).catch(() => new Response("", { status: 503 }))
    )
  );
});

// ─── Web Push ────────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "Secretlink", body: event.data ? event.data.text() : "New notification" };
  }

  const title = payload.title || "Secretlink";
  const options = {
    body: payload.body || "You have a new notification",
    icon: "/secretlink.png",
    badge: "/secretlink.png",
    tag: payload.notificationId || undefined,
    data: { tab: payload.tab || "inbox" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const tab = (event.notification.data && event.notification.data.tab) || "inbox";
  const target = `/dashboard#${tab}`;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/dashboard") && "focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(target).catch(() => {});
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
