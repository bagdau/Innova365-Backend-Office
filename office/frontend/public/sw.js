/* Innova Office — оболочка приложения работает без сети; данные (/api) никогда не кэшируются. */
const VERSION = 'office-v1';
const SHELL = ['/', '/favicon.svg', '/manifest.webmanifest', '/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // данные и поток событий — только из сети; без связи — понятный ответ
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/events') return;
    e.respondWith(fetch(req).catch(() => new Response(JSON.stringify({ error: 'Нет связи с сервером' }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  // переходы по страницам: сеть, а без неё — сохранённая оболочка
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put('/', copy)); return r; }).catch(() => caches.match('/').then((r) => r || Response.error())));
    return;
  }
  // скрипты, стили и иконки (имена с хэшем) — из кэша, при первой загрузке сохраняются
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok && (url.pathname.startsWith('/assets/') || /\.(png|svg|webmanifest|woff2?)$/.test(url.pathname))) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return r; })));
});
