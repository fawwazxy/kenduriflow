// KenduriFlow service worker: keeps the app opening fast and working on weak signal.
// Pages and files: network first, the saved copy when offline. Live data (/api, /socket.io) always goes to the server.
const CACHE = 'kenduriflow-v7';

const SHELL = [
  '/', '/offline.html', '/login', '/account', '/host', '/plan', '/host-event.html', '/guard', '/neighbour', '/admin', '/people', '/guest.html',
  '/css/app.css', '/favicon.svg', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png',
  '/js/common.js', '/js/map.js', '/js/chart.js', '/js/home.js', '/js/login.js', '/js/account.js', '/js/host.js',
  '/vendor/jsQR.js', '/js/plan.js', '/js/scan.js', '/js/gate.js', '/js/host-event.js', '/js/guard.js', '/js/neighbour.js', '/js/admin.js', '/js/people.js', '/js/guest.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Pages with an id in the address share one saved page.
function shellFor(url) {
  if (url.pathname.startsWith('/e/')) return '/guest.html';
  if (/^\/host\/[^/]+$/.test(url.pathname)) return '/host-event.html';
  if (/^\/guard\/[^/]+$/.test(url.pathname)) return '/guard';
  return url.pathname;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req.mode === 'navigate' ? shellFor(url) : req, res.clone());
      return res;
    } catch (err) {
      const saved = await cache.match(req.mode === 'navigate' ? shellFor(url) : req, { ignoreSearch: true });
      if (saved) return saved;
      if (req.mode === 'navigate') return cache.match('/offline.html');
      throw err;
    }
  })());
});
