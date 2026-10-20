// Offline support: the game itself is stored on first visit, fonts are stored the first time they load.
// Change VERSION whenever you upload a new index.html so phones pick up the update.
const VERSION = 'ultimate-manager-v76';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './icon-maskable-192.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // cloud sync always goes straight to Supabase, never the offline store
  if (url.hostname.endsWith('supabase.co')) return;
  // the app description must always be fresh so the phone sees the current app identity
  if (url.origin === location.origin && url.pathname.endsWith('.webmanifest')) {
    e.respondWith(fetch(req, {cache: 'no-store'}).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return r; }).catch(() => caches.match(req)));
    return;
  }
  // the page: try the network first so updates arrive, fall back to the stored copy when offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // everything else (icons, Google Fonts): stored copy first, network as backup, and keep a copy
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r && (r.ok || r.type === 'opaque') && (url.origin === location.origin || url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com'))) {
      const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy));
    }
    return r;
  }).catch(() => hit)));
});
