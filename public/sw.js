// Offline support. The version and the file list below are filled in at build time (see vite.config.js).
// Cached: the app shell, Quran and tafsir data, icons. Fonts are cached as they are used.
// Not cached: the recitation audio (everyayah.com), which needs a connection.
const VERSION = '__VERSION__';
const CORE = 'core-' + VERSION;
const RUNTIME = 'runtime-v1';
const PRECACHE = __PRECACHE__;
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('core-') && k !== CORE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // pages: try the network first so a new release shows up quickly, fall back to the cached shell offline
    if (req.mode === 'navigate') {
      e.respondWith(fetch(req).catch(() => caches.match(new URL('./', self.registration.scope).href)));
      return;
    }
    // everything else of ours was precached under a versioned cache: serve it from there
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
    return;
  }

  // web fonts: show the cached copy immediately and refresh it in the background
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(RUNTIME).then(cache =>
        cache.match(req).then(hit => {
          const fresh = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res }).catch(() => hit);
          return hit || fresh;
        })
      )
    );
  }
  // anything else (audio, etc.) goes straight to the network
});

// Tapping a reminder opens (or focuses) the app on the page it is about.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const open = list.find(c => 'focus' in c);
      if (!open) return self.clients.openWindow(url);
      return (open.navigate ? open.navigate(url).catch(() => {}) : Promise.resolve()).then(() => open.focus());
    })
  );
});
