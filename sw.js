/* ============================================================
   TURNO - service worker
   Vdaka nemu sa appka otvori aj bez signalu a da sa nainstalovat.

   DOLEZITE pri testovani:
   Kod (index.html, lang.js) sa berie VZDY najprv zo siete a cache je
   len zalozna pre offline. Keby to bolo naopak, po oprave chyby by
   ludia este dlho videli staru pokazenu verziu - a to by cele
   testovanie znemoznilo.

   Obrazky a fonty sa beru z cache, tie sa nemenia.
   ============================================================ */

const VERSION = 'turno-v1.0';
const SHELL = [
  './', './index.html', './lang.js', './manifest.json',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  // Databaza nikdy z cache - vzdy zive data
  if (url.hostname.includes('supabase')) return;

  const sameOrigin = url.origin === location.origin;
  const isCode = req.mode === 'navigate' ||
                 /\.(html|js|json)$/.test(url.pathname) ||
                 url.pathname.endsWith('/');

  if (sameOrigin && isCode) {
    // SIET NAJPRV - po nasadeni opravy ju clovek dostane hned
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then(hit => hit || caches.match('./index.html'))
        )
    );
    return;
  }

  // Obrazky, fonty a ostatne - cache najprv, je to rychlejsie
  e.respondWith(
    caches.match(req).then(hit =>
      hit || fetch(req).then(res => {
        if (res && res.ok && sameOrigin) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit)
    )
  );
});
