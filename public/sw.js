// sw.js — Service Worker (generated — do not edit directly)
// Cache-first for assets, network-first for HTML navigation.

const CACHE_NAME = 'timestamp-v4';

const PRECACHE_URLS = [
  '/',
  '/timezone-converter',
  '/duration-calculator',
  '/age-calculator',
  '/business-days',
  '/countdown',
  '/cron-parser',
  '/favicon.svg',
  '/site.webmanifest',
  '/css/styles.css',
  '/js/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME && k.includes('-v')).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;

  // Network-first for HTML — always fetch fresh navigations
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request).then(c => c || caches.match('/')))
    );
    return;
  }

  // Cache-first for all static assets (JS, CSS, fonts, images)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (!res || !res.ok) return res;
        caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
        return res;
      });
    })
  );
});
