/*
  Service Worker — Process & SOP Architect (Global 1080)
  ------------------------------------------------------
  Makes the app installable and fully usable offline.

  HOW UPDATES WORK:
  When you publish a new version of index.html, bump CACHE_VERSION
  (e.g. 'v1' -> 'v2'). That tells every installed copy to refresh
  its cache the next time it is opened online.
*/

const CACHE_VERSION = 'v1';
const CACHE = 'sop-architect-' + CACHE_VERSION;

// Files cached up front so the app opens with no network at all.
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png'
];

// Install: pre-cache the core files, then activate immediately.
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).catch(() => {})
  );
});

// Activate: remove caches from older versions, take control of open pages.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // 1) The app page itself: network-first (so edits show up when online),
  //    falling back to the cached copy when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // 2) Google Fonts (loaded from another domain): cache-first so the app's
  //    typefaces keep working offline after the first online load.
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.match(req).then((cached) => {
        const live = fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        }).catch(() => cached);
        return cached || live;
      })
    );
    return;
  }

  // 3) Everything else on our own site (icons, manifest): cache-first.
  event.respondWith(
    caches.match(req).then((cached) => {
      return cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached);
    })
  );
});
