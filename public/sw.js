// Minimal service worker — exists only to satisfy the "installable PWA" checklist Chrome/Android
// uses to decide whether to fire beforeinstallprompt (it requires a registered service worker
// with a fetch handler). Deliberately does no caching of its own: every request still goes
// straight to the network untouched, so installing the app never risks the HSE data going stale
// behind a cache.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
