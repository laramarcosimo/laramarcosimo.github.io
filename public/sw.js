const CACHE = 'apex-coach-v2';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // nunca cachear APIs externas (Gemini)
  if (url.pathname === '/version.json') return; // siempre a la red: sirve para detectar versiones nuevas
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put('/index.html', cp)); return r; }).catch(() => caches.match('/index.html')));
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; })),
  );
});

/* ---------- Aviso de fin de descanso ---------- */
// Un único tag para descanso y calentamiento y SIN «renotify»: si llegan dos avisos (local + servidor) el segundo sustituye al primero sin sonar otra vez.
const showTimerDone = (title, body) =>
  self.registration.showNotification(title || '¡Tiempo de descanso terminado! ⏱️', {
    body: body || 'Toca volver a la carga con la siguiente serie',
    icon: '/pwa-192x192.png',
    badge: '/badge-72.png',
    vibrate: [300, 100, 300],
    tag: 'workout-timer',
    renotify: false,
  });

// Respaldo: si iOS suspende la página, el Service Worker (mientras siga vivo) dispara el aviso a la hora prevista.
let restTimer = null;
let restResolve = null;
const clearRest = () => {
  if (restTimer) clearTimeout(restTimer);
  restTimer = null;
  if (restResolve) restResolve();
  restResolve = null;
};

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'rest-cancel' || d.type === 'timer-cancel') return clearRest();
  if (d.type !== 'rest-start' && d.type !== 'timer-start') return;
  clearRest();
  const ms = Math.max(0, Number(d.endsAt) - Date.now());
  e.waitUntil(
    new Promise((resolve) => {
      restResolve = resolve;
      restTimer = setTimeout(async () => {
        restTimer = null;
        restResolve = null;
        try {
          const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          const visible = wins.some((c) => c.visibilityState === 'visible');
          if (!visible && self.Notification && self.Notification.permission === 'granted') await showTimerDone(d.title, d.body);
        } finally {
          resolve();
        }
      }, ms);
    }),
  );
});

// Avisos push enviados por el servidor (funcionan con la app cerrada).
self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { title: 'Apex Coach', body: e.data ? e.data.text() : '' };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || 'Apex Coach', {
      body: d.body || '',
      icon: '/pwa-192x192.png',
      badge: '/badge-72.png',
      tag: d.tag === 'rest' || d.tag === 'warmup' ? 'workout-timer' : d.tag || 'apex',
      renotify: d.tag === 'rest' || d.tag === 'warmup' ? false : true,
      vibrate: [300, 100, 300],
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins[0];
      if (win) return win.focus();
      return self.clients.openWindow('/');
    }),
  );
});
