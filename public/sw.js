// The service worker: the whole app runs in the browser, so once opened it keeps working offline.
// Bump VERSION to drop old caches after a change to this file.
const VERSION = "spend-v2";
const INBOX = "share-inbox"; // what another app shared, held until the page picks it up
const SHELL = ["/", "/icon-192.png", "/icon-512.png", "/icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== INBOX).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  // Android share sheet → POST /share-target with the receipt image and any text. Keep them in a cache on this
  // phone, then open the app, which reads them. Nothing goes to a server.
  if (request.method === "POST" && new URL(request.url).pathname === "/share-target") {
    event.respondWith((async () => {
      try {
        const form = await request.formData();
        const cache = await caches.open(INBOX);
        await cache.delete("/share-inbox/file");
        const meta = { title: String(form.get("title") ?? ""), text: String(form.get("text") ?? ""), url: String(form.get("url") ?? ""), file: false };
        const file = form.getAll("receipt").find(f => f && typeof f === "object" && /^image\//.test(f.type) && f.size > 0 && f.size < 15e6);
        if (file) { await cache.put("/share-inbox/file", new Response(file, { headers: { "Content-Type": file.type } })); meta.file = true; }
        await cache.put("/share-inbox/meta", new Response(JSON.stringify(meta), { headers: { "Content-Type": "application/json" } }));
        return Response.redirect("/?shared=1", 303);
      } catch {
        return Response.redirect("/?shared=0", 303);
      }
    })());
    return;
  }
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/_vercel/")) return;

  // Build files have content hashes in their names, so a cached copy is always right.
  // The receipt reader's files (/ocr/) are large and fixed per release: download once, then keep.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/ocr/") || /^\/icon[-.\w]*\.(png|svg)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(hit => hit || fetch(request).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(cache => cache.put(request, copy)); }
        return res;
      })),
    );
    return;
  }

  // Pages: the network first for the latest version, the saved copy when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok && url.pathname === "/") { const copy = res.clone(); caches.open(VERSION).then(cache => cache.put("/", copy)); }
          return res;
        })
        .catch(() => caches.match("/")),
    );
  }
});
