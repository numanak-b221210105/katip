// Kâtip service worker: app shell offline, network-first for pages, cache-first for built assets.
// Model weights are cached separately by the transcription library in Cache Storage.
const CACHE = "katip-shell-v2";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon.svg", "./icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("katip-shell") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Files shared to the installed app from the Android share sheet.
  if (req.method === "POST" && url.pathname.endsWith("/share-target")) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData();
        const f = fd.get("audio");
        if (f && typeof f !== "string") {
          const c = await caches.open("katip-share");
          await c.put(new URL("./shared-audio", self.registration.scope).href,
            new Response(f, { headers: { "content-type": f.type || "audio/ogg", "x-name": encodeURIComponent(f.name || "audio") } }));
        }
      } catch (_) { /* fall through to the app */ }
      return Response.redirect(new URL("./#/?shared=1", self.registration.scope).href, 303);
    })());
    return;
  }
  if (req.method !== "GET" || url.origin !== location.origin) return; // model downloads handled by the library
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy)); return r; }).catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return r;
  })));
});
