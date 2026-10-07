/* Offline support: caches the app and its fonts so it works with no internet. */
const VERSION = '1.0.0';
const APP_CACHE = 'tt-app-' + VERSION;
const FONT_CACHE = 'tt-fonts-v1';
const SHELL = ['./', './index.html', './app.js', './render.js', './seed.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Rubik:wght@500;600;700&display=swap';

async function cacheFonts() {
  const fc = await caches.open(FONT_CACHE);
  const res = await fetch(FONT_CSS, { mode: 'cors' });
  if (!res.ok) return;
  await fc.put(FONT_CSS, res.clone());
  const css = await res.text();
  const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
  await Promise.all(urls.map(async u => {
    if (await fc.match(u)) return;
    try { const r = await fetch(u, { mode: 'cors' }); if (r.ok) await fc.put(u, r); } catch (e) {}
  }));
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(APP_CACHE);
    await c.addAll(SHELL);
    try { await cacheFonts(); } catch (err) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('tt-app-') && k !== APP_CACHE) await caches.delete(k);
    await self.clients.claim();
    try { await cacheFonts(); } catch (err) {}
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const fc = await caches.open(FONT_CACHE);
      const hit = await fc.match(req.url);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') fc.put(req.url, r.clone());
      return r;
    })());
    return;
  }
  if (url.origin !== location.origin) return;
  // App files: answer from cache instantly, refresh the cache in the background.
  e.respondWith((async () => {
    const c = await caches.open(APP_CACHE);
    const key = req.mode === 'navigate' ? './index.html' : req;
    const hit = await c.match(key, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(key, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const r = await net;
    return r || new Response('Offline', { status: 503 });
  })());
});
