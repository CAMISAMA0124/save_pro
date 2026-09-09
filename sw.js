/* ================================================
   sw.js - Service Worker
   記帳PRO PWA 離線快取
   ================================================ */

const CACHE_NAME = 'jizhangpro-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/manifest.json',
  '/js/state.js',
  '/js/data/api.js',
  '/js/app.js',
  '/js/modules/loan-calc.js',
  '/js/pages/explore.js',
  '/js/pages/assets.js',
  '/js/pages/dashboard.js',
  '/js/pages/liabilities.js',
  '/js/pages/settings.js',
];

// 安裝：快取靜態資源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 啟用：清除舊快取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 請求攔截：Network First for API, Cache First for static
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API 請求不快取（需要即時資料）
  if (url.pathname.startsWith('/api/')) return;
  // 外部資源（CDN、Google Fonts）不快取
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
      return cached || networkFetch;
    })
  );
});