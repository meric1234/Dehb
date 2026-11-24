const CACHE_NAME = 'odak-not-v2026-11-24-r2';

const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './focus-studio.css',
  './storage.js',
  './canvas-tools.js',
  './pdf-engine.js',
  './ai-study.js',
  './quiz.js',
  './app.js',
  './focus-studio.js',
  './graph.js',
  './manifest.webmanifest',
  './favicon.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Ses dosyalarındaki parça (Range) isteklerini doğrudan ağa bırakır (206 önbellek hatasını önler)
  if (req.headers.has('range')) return;

  const url = new URL(req.url);

  // Gemini API isteklerini önbelleğe almaz
  if (url.hostname.includes('generativelanguage.googleapis.com')) return;

  // Ağ öncelikli (Network-First): İnternet varken daima en güncel sürümü getirir,
  // internet kesildiğinde önbellekten çevrimdışı açar.
  event.respondWith(
    fetch(req)
      .then(networkRes => {
        if (
          networkRes &&
          networkRes.status === 200 &&
          (networkRes.type === 'basic' || networkRes.type === 'cors')
        ) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(req, clone))
            .catch(() => {});
        }
        return networkRes;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
