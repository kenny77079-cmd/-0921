const CACHE_NAME = 'health-record-v1-5-1-cache';
const CORE_ASSETS = ['./', './index.html', './manifest.json', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // 核心檔案必須先快取；外部圖表庫則盡力快取，不讓 CDN 暫時失敗阻止安裝。
    await cache.addAll(CORE_ASSETS);
    try {
      const chartURL = 'https://cdn.jsdelivr.net/npm/chart.js';
      const response = await fetch(chartURL, {mode: 'cors'});
      if (response.ok) await cache.put(chartURL, response.clone());
    } catch (e) { /* 若 CDN 無法連線，App 仍可使用；圖表可能需要網路 */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('health-record-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response && response.ok) {
        const url = new URL(event.request.url);
        // 快取同源檔案及 Chart.js CDN，讓首次成功載入後可嘗試離線使用。
        if (url.origin === self.location.origin || url.href.startsWith('https://cdn.jsdelivr.net/npm/chart.js')) {
          await cache.put(event.request, response.clone());
        }
      }
      return response;
    } catch (error) {
      if (event.request.mode === 'navigate') {
        const app = await cache.match('./index.html');
        if (app) return app;
      }
      throw error;
    }
  })());
});
