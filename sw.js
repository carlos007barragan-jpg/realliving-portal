/* Real Living Business Suite — service worker.

   Design goals, in order:
   1. Make the Suite installable as a real app (a fetch handler is required for that).
   2. Never make the GitHub Pages staleness problem worse. App HTML and JS are fetched
      NETWORK-FIRST — online you always get the freshest file; the cache is only a
      fallback for when the phone is offline. We do NOT freeze app versions.
   3. Never touch Supabase or CDN traffic. Auth tokens and API responses must never be
      cached, and cross-origin requests are passed straight through untouched.
   4. Give a clean "you're offline" page instead of the browser's dinosaur.

   Bump CACHE_VERSION to force every client onto a fresh cache on the next visit. */

const CACHE_VERSION = 'rl-suite-v2-hardreset';
const BASE = '/realliving-portal/';
const PRECACHE = [
  BASE,
  BASE + 'index.html',
  BASE + 'offline.html',
  BASE + 'manifest.json',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png',
  BASE + 'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((c) => c.addAll(PRECACHE).catch(() => {/* a missing asset must not block install */}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Let the page tell a freshly-installed worker to take over immediately. */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isSameOrigin(url) {
  try { return new URL(url).origin === self.location.origin; } catch (e) { return false; }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  /* Only ever handle GET. Never intercept POST/auth/writes. */
  if (req.method !== 'GET') return;

  /* Cross-origin (Supabase, CDNs, mail/sms links, etc.) — do not touch. Passing through
     without respondWith lets the browser handle it exactly as if no worker existed. */
  if (!isSameOrigin(req.url)) return;

  const url = new URL(req.url);
  const isStatic = url.pathname.indexOf(BASE + 'icons/') === 0 ||
                   url.pathname === BASE + 'manifest.json';

  /* Static, rarely-changing assets: cache-first (fast, works offline). */
  if (isStatic) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  /* Everything else same-origin (app HTML, onboard.js, etc.): NETWORK-FIRST.
     Fresh when online; cached copy only as an offline fallback; offline.html if we
     have neither and it's a navigation. */
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match(BASE + 'offline.html');
        return new Response('', { status: 504, statusText: 'Offline' });
      }))
  );
});
