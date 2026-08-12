// Minimal service worker: satisfies PWA install criteria and provides a
// network-first passthrough. The app is Firebase-backed and online-first,
// so we deliberately avoid caching app data.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Network passthrough; nothing cached.
  event.respondWith(fetch(event.request));
});
