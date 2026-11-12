// Phone notifications for payments due. Browser only; see lib/remind.ts for what's due and public/sw.js for the background check.
import type { Lang } from "./i18n";

const LOG = "remind-log";
type Log = { keys: string[]; lang: Lang };
type PeriodicSync = { register: (tag: string, o: { minInterval: number }) => Promise<void>; unregister: (tag: string) => Promise<void> };

export const notifySupported = () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "caches" in window;
export const notifyPermission = (): NotificationPermission | "unsupported" => (notifySupported() ? Notification.permission : "unsupported");

async function readLog(): Promise<Log> {
  try { const hit = await (await caches.open(LOG)).match("/remind-log"); if (hit) return await hit.json() as Log; } catch { /* start fresh */ }
  return { keys: [], lang: "en" };
}
async function writeLog(l: Log) {
  await (await caches.open(LOG)).put("/remind-log", new Response(JSON.stringify({ ...l, keys: l.keys.slice(-200) }), { headers: { "Content-Type": "application/json" } }));
}
/** The background check reads the language from here (it can't see the page's settings). */
export async function setRemindLang(lang: Lang) { if (!notifySupported()) return; const l = await readLog(); if (l.lang !== lang) await writeLog({ ...l, lang }); }

/** Asks once for permission, then asks the browser to check twice a day in the background where it can. */
export async function enableNotify(lang: Lang): Promise<NotificationPermission | "unsupported"> {
  if (!notifySupported()) return "unsupported";
  const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (p !== "granted") return p;
  await setRemindLang(lang);
  try {
    const reg = await navigator.serviceWorker.ready as ServiceWorkerRegistration & { periodicSync?: PeriodicSync };
    await reg.periodicSync?.register("due-reminders", { minInterval: 12 * 60 * 60 * 1000 });
  } catch { /* not allowed here (not installed, or not Chrome): reminders still show when the app is opened */ }
  return p;
}
export async function disableNotify() {
  try { const reg = await navigator.serviceWorker.ready as ServiceWorkerRegistration & { periodicSync?: PeriodicSync }; await reg.periodicSync?.unregister("due-reminders"); } catch { /* fine */ }
}

/** Shows each reminder once. Returns how many were shown. */
export async function showReminders(list: { key: string; title: string; body: string }[]): Promise<number> {
  if (notifyPermission() !== "granted" || !list.length) return 0;
  const log = await readLog();
  const reg = await navigator.serviceWorker.ready;
  let n = 0;
  for (const r of list) {
    if (log.keys.includes(r.key)) continue;
    await reg.showNotification(r.title, { body: r.body, tag: r.key, icon: "/icon-192.png", badge: "/icon-192.png", data: "/#payments" });
    log.keys.push(r.key); n++;
  }
  if (n) await writeLog(log);
  return n;
}
