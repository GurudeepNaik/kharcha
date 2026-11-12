// The service worker: the whole app runs in the browser, so once opened it keeps working offline.
// Bump VERSION to drop old caches after a change to this file.
const VERSION = "spend-v3";
const INBOX = "share-inbox"; // what another app shared, held until the page picks it up
const REMIND = "remind-log"; // reminders already shown, and the language to show them in (shared with the page)
const SHELL = ["/", "/icon-192.png", "/icon-512.png", "/icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== INBOX && k !== REMIND).map(k => caches.delete(k))))
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

// ---------- Reminders in the background (installed app on Android Chrome; the page does the same when opened) ----------
// Same rules as remindersDue() in lib/remind.ts: due today or tomorrow, not paid, not skipped; no money in, gold loans or fuel.
const WORDS = {
  en: { today: n => `${n} is due today`, tomorrow: n => `${n} is due tomorrow`, body: "Tap to mark it paid or skip it." },
  hi: { today: n => `${n} आज देना है`, tomorrow: n => `${n} कल देना है`, body: "भुगतान या स्किप करने के लिए टैप करें।" },
  kn: { today: n => `${n} ಇಂದು ಕಟ್ಟಬೇಕು`, tomorrow: n => `${n} ನಾಳೆ ಕಟ್ಟಬೇಕು`, body: "ಪಾವತಿ ಅಥವಾ ಸ್ಕಿಪ್ ಮಾಡಲು ಟ್ಯಾಪ್ ಮಾಡಿ." },
};
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function dayIn(month, day) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${pad(Math.min(day, last))}`;
}
function dueIn(it, month) {
  const [ay, am] = it.startMonth.split("-").map(Number), [by, bm] = month.split("-").map(Number);
  const n = (by - ay) * 12 + (bm - am);
  return n >= 0 && n % it.every === 0;
}
const readAll = (db, store) => new Promise(res => {
  try { const q = db.transaction(store).objectStore(store).getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); } catch { res([]); }
});
const readKey = (db, store, key) => new Promise(res => {
  try { const q = db.transaction(store).objectStore(store).get(key); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); } catch { res(undefined); }
});
async function remindLog() {
  const hit = await (await caches.open(REMIND)).match("/remind-log");
  try { return hit ? await hit.json() : { keys: [], lang: "en" }; } catch { return { keys: [], lang: "en" }; }
}
async function remindFromStore() {
  const db = await new Promise((res, rej) => { const r = indexedDB.open("expenses"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  try {
    if ((await readKey(db, "settings", "notify")) !== true) return;
    const [items, rows] = await Promise.all([readAll(db, "plan"), readAll(db, "expenses")]);
    const log = await remindLog();
    const w = WORDS[log.lang] || WORDS.en;
    const now = new Date(), today = ymd(now), tomorrow = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    for (const it of items) {
      if (it.kind === "income" || it.kind === "goldloan" || (it.amountPaise === null && it.category === "travel")) continue;
      for (const date of [today, tomorrow]) {
        const month = date.slice(0, 7);
        if (!dueIn(it, month) || dayIn(month, it.day) !== date || (it.skips || []).includes(month)) continue;
        if (rows.some(e => (e.planId === it.id || e.repeatId === it.id) && e.date.slice(0, 7) === month)) continue;
        const key = `${it.id}:${date}`;
        if (log.keys.includes(key)) continue;
        const amt = it.amountPaise ? ` · ₹${(it.amountPaise / 100).toLocaleString("en-IN")}` : "";
        await self.registration.showNotification((date === today ? w.today : w.tomorrow)(it.name) + amt, { body: w.body, tag: key, icon: "/icon-192.png", badge: "/icon-192.png", data: "/#payments" });
        log.keys.push(key);
      }
    }
    log.keys = log.keys.slice(-200);
    await (await caches.open(REMIND)).put("/remind-log", new Response(JSON.stringify(log), { headers: { "Content-Type": "application/json" } }));
  } finally { db.close(); }
}
self.addEventListener("periodicsync", event => {
  if (event.tag === "due-reminders") event.waitUntil(remindFromStore().catch(() => undefined));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data || "/#payments";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    const w = ws.find(c => new URL(c.url).origin === location.origin);
    if (w) return w.focus().then(c => c.navigate ? c.navigate(url) : c);
    return self.clients.openWindow(url);
  }));
});
