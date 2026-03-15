// Self-unregistering service worker — clears stale caches from previous versions.
// Kept as a file so browsers with an old SW will pick up this version and clean up.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach((c) => c.navigate(c.url)))
  );
  self.registration.unregister();
});
