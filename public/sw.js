// Offline support. The version and the file list below are filled in at build time (see vite.config.js).
// Cached: the app shell, Quran and tafsir data, icons. Fonts are cached as they are used.
// Recitation audio (everyayah.com) is not cached by itself: it comes from the network, except for the surahs a person chose to
// download (kept in the separate audio-v1 cache by src/offline.js), which are served from there, even without internet.
const VERSION = '__VERSION__';
const CORE = 'core-' + VERSION;
const RUNTIME = 'runtime-v1';
const AUDIO = 'audio-v1';          // downloaded recitations; never deleted by a new release
const PRECACHE = __PRECACHE__;
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

/** A recitation file: the downloaded copy if there is one (answering a Range request by slicing it, as an audio element asks), else the network. */
async function audioResponse(req) {
  const hit = await (await caches.open(AUDIO)).match(req.url);
  const range = req.headers.get('range');
  // not downloaded: ask the network ourselves, in CORS mode (everyayah.com allows it), so the answer is a normal readable one and
  // not the opaque kind that some browsers refuse to seek in; the Range request of the audio element is passed on as it came
  if (!hit) return fetch(req.url, { mode: 'cors', headers: range ? { Range: range } : {} });
  const m = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) return hit;
  const buf = await hit.arrayBuffer(), size = buf.byteLength;
  let start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  let end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (!(start <= end) || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  return new Response(buf.slice(start, end + 1), { status: 206, headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(end - start + 1), 'Content-Range': 'bytes ' + start + '-' + end + '/' + size, 'Accept-Ranges': 'bytes' } });
}

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

  // recitations: a downloaded copy when there is one
  if (url.hostname === 'everyayah.com') { e.respondWith(audioResponse(req)); return; }

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
  // anything else goes straight to the network
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
