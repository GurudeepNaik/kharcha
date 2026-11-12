// Browser test of the real app: adding, editing, totals, month view, limit, backup → wipe → restore, CSV,
// phone widths, Back button, offline and install.
//   pnpm smoke                          # against production
//   pnpm smoke http://localhost:3200    # against a local `pnpm start -p 3200`
import puppeteer, { type Page } from "puppeteer-core";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = (process.argv[2] ?? "https://gurudeep-expenses.vercel.app").replace(/\/$/, "");
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const results: { pass: boolean; name: string }[] = [];
const ok = (name: string, pass: unknown) => results.push({ pass: !!pass, name });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });

type Row = { id: string; amountPaise: number; note: string; category: string; method: string | null; date: string; createdAt: string; updatedAt: string };

async function phone(width = 390): Promise<Page> {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument("globalThis.__name = f => f"); // tsx helper used inside page.evaluate
  page.on("pageerror", e => ok(`no page errors (${(e as Error).message.slice(0, 80)})`, false));
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await page.waitForSelector("#entry");
  return page;
}
const text = (page: Page, sel: string) => page.$eval(sel, e => e.textContent?.trim() ?? "").catch(() => "");
const clickText = (page: Page, t: string, sel = "button") => page.evaluate((t: string, sel: string) => {
  const b = [...document.querySelectorAll<HTMLElement>(sel)].find(e => e.textContent?.trim() === t);
  if (!b) throw new Error(`no "${t}"`);
  b.click();
}, t, sel);
async function enter(page: Page, line: string) {
  await page.click("#entry", { count: 3 });
  await page.keyboard.press("Backspace");
  await page.type("#entry", line);
}
async function add(page: Page, line: string) {
  await enter(page, line);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => (document.querySelector("#entry") as HTMLInputElement).value === "", { timeout: 3000 });
}
/** Every row straight from IndexedDB, so checks don't depend on what the screen shows. */
const dbRows = (page: Page) => page.evaluate(() => new Promise<Row[]>((res, rej) => {
  const r = indexedDB.open("expenses");
  r.onerror = () => rej(r.error);
  r.onsuccess = () => { const q = r.result.transaction("expenses").objectStore("expenses").getAll(); q.onsuccess = () => { res(q.result); r.result.close(); }; };
}));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const paise = (s: string) => Math.round(Number(s.replace(/[₹,]/g, "")) * 100);
/** Rows as text with sorted keys and sorted by id, so two copies compare equal only if every field matches. */
const canon = (rows: Row[]) => JSON.stringify([...rows].sort((a, b) => a.id.localeCompare(b.id)).map(r => Object.fromEntries(Object.entries(r).sort(([a], [b]) => a.localeCompare(b)))));
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

// ---------- Adding ----------
const page = await phone();
ok("starts empty", (await text(page, "[data-testid=today-total]")) === "₹0");
await enter(page, "chai");
await page.keyboard.press("Enter");
await wait(200);
ok("no amount → plain error", (await text(page, "[role=alert]")).includes("Add the amount"));
ok("error marks the field", (await page.$eval("#entry", e => e.getAttribute("aria-invalid"))) === "true");
await enter(page, "chai 20");
ok("preview shows ₹20", (await text(page, "[data-testid=preview-amount]")) === "₹20");
ok("preview picks Food", (await page.$eval("#entry-help select", e => (e as HTMLSelectElement).value)) === "food");
await page.keyboard.press("Enter");
await wait(300);
ok("toast confirms save", (await text(page, "[role=status]")).includes("Saved ₹20 · Food"));
ok("focus stays in the box for the next one", await page.evaluate(() => document.activeElement?.id === "entry"));

for (const l of ["auto 80 upi", "swiggy dinner 450", "medicine 340 yesterday", "rent 12,000 1/11", "₹ 99.50 milk cash"]) await add(page, l);
let rows = await dbRows(page);
ok("6 spends saved", rows.length === 6);
const t = today();
const expectToday = rows.filter(r => r.date === t).reduce((s, r) => s + r.amountPaise, 0);
const expectMonth = rows.filter(r => r.date.slice(0, 7) === t.slice(0, 7)).reduce((s, r) => s + r.amountPaise, 0);
ok(`Today total = sum of today's rows (${expectToday / 100})`, paise(await text(page, "[data-testid=today-total]")) === expectToday);
ok(`Month total = sum of this month's rows (${expectMonth / 100})`, paise(await text(page, "[data-testid=home-month-total]")) === expectMonth);
ok("auto → Travel, UPI", rows.some(r => r.note === "auto" && r.category === "travel" && r.method === "upi"));
ok("milk → Groceries, Cash, ₹99.50", rows.some(r => r.note === "milk" && r.category === "groceries" && r.method === "cash" && r.amountPaise === 9950));
ok("no Cash/UPI unless asked", rows.find(r => r.note === "swiggy dinner")?.method === null);

// Picking a category teaches it.
await enter(page, "ramesh 500");
ok("unknown word → Other", (await page.$eval("#entry-help select", e => (e as HTMLSelectElement).value)) === "other");
await page.select("#entry-help select", "rent");
await clickText(page, "UPI");
await page.keyboard.press("Enter").catch(() => undefined);
await page.focus("#entry"); await page.keyboard.press("Enter");
await page.waitForFunction(() => (document.querySelector("#entry") as HTMLInputElement).value === "");
rows = await dbRows(page);
ok("picked category and UPI saved", rows.some(r => r.note === "ramesh" && r.category === "rent" && r.method === "upi"));
await enter(page, "ramesh 700");
ok("learned: ramesh → Rent next time", (await page.$eval("#entry-help select", e => (e as HTMLSelectElement).value)) === "rent");
await page.keyboard.press("Enter");
await wait(300);
await clickText(page, "Undo");
await wait(300);
ok("Undo removes the spend just saved", (await dbRows(page)).filter(r => r.note === "ramesh").length === 1);

// ---------- Editing ----------
const chai = (await dbRows(page)).find(r => r.note === "chai")!;
const todayBeforeEdit = (await dbRows(page)).filter(r => r.date === t).reduce((s, r) => s + r.amountPaise, 0);
await page.click(`button[data-id="${chai.id}"]`);
await page.waitForSelector("#edit-amount");
await page.click("#edit-amount", { count: 3 }); await page.keyboard.press("Backspace"); await page.type("#edit-amount", "abc");
await clickText(page, "Save changes");
await wait(150);
ok("edit rejects a bad amount", (await text(page, "#edit-error")).includes("numbers only"));
await page.click("#edit-amount", { count: 3 }); await page.keyboard.press("Backspace"); await page.type("#edit-amount", "25");
await clickText(page, "Save changes");
await wait(300);
const chai2 = (await dbRows(page)).find(r => r.id === chai.id)!;
ok("edit saves ₹25 and bumps updatedAt", chai2.amountPaise === 2500 && chai2.updatedAt > chai.updatedAt);
ok("Today total follows the edit", paise(await text(page, "[data-testid=today-total]")) === todayBeforeEdit + 500);
await page.click(`button[data-id="${chai.id}"]`);
await page.waitForSelector("#edit-amount");
await clickText(page, "Delete");
await wait(300);
ok("delete removes it", !(await dbRows(page)).some(r => r.id === chai.id));
await clickText(page, "Undo");
await wait(300);
ok("Undo brings it back unchanged", canon([(await dbRows(page)).find(r => r.id === chai.id)!]) === canon([chai2]));

// ---------- Month ----------
await clickText(page, "Month", "nav button");
await page.waitForSelector("[data-testid=month-total]");
rows = await dbRows(page);
const monthRows = rows.filter(r => r.date.slice(0, 7) === t.slice(0, 7));
const monthSum = monthRows.reduce((s, r) => s + r.amountPaise, 0);
ok("Month total = sum of the month's rows", paise(await text(page, "[data-testid=month-total]")) === monthSum);
const catSums = await page.$$eval("ul[aria-label='By category'] > li > button", bs => bs.map(b => b.querySelector(".num")!.childNodes[0]!.textContent!.trim()));
ok(`category rows add up to the month total (${catSums.length} categories)`, catSums.reduce((s, c) => s + paise(c), 0) === monthSum);
await page.click("ul[aria-label='By category'] > li > button");
ok("tapping a category lists its spends", (await page.$$("ul[aria-label='By category'] > li ul button[data-id]")).length >= 1);
await page.goBack();
await wait(300);
ok("phone Back returns to Home", !!(await page.$("#entry")));

// ---------- Limit ----------
await clickText(page, "Settings", "nav button");
await page.waitForSelector("#limit");
await page.type("#limit", "abc");
await clickText(page, "Save", "form button");
await wait(150);
ok("limit rejects text", (await text(page, "#limit-error")).length > 0);
await page.click("#limit", { count: 3 }); await page.keyboard.press("Backspace"); await page.type("#limit", "20000");
await clickText(page, "Save", "form button");
await wait(200);
await clickText(page, "Home", "nav button");
await page.waitForSelector("[data-testid=limit]");
const left = 2000000 - monthSum;
ok(`Home shows ${left >= 0 ? "left" : "over"} correctly`, (await text(page, "[data-testid=limit]")).includes(`₹${Math.abs(left / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`));

// ---------- Survives a reload ----------
const before = (await dbRows(page)).sort((a, b) => a.id.localeCompare(b.id));
await page.reload({ waitUntil: "networkidle2" });
await page.waitForSelector("#entry");
ok("spends survive a reload", canon(await dbRows(page)) === canon(before));

// ---------- Backup → wipe → restore, CSV ----------
const dl = mkdtempSync(join(tmpdir(), "spent-dl-"));
await (await page.createCDPSession()).send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: dl });
await clickText(page, "Settings", "nav button");
await page.waitForSelector("#limit");
await clickText(page, "Save backup file");
await wait(1200);
const backupName = readdirSync(dl).find(f => f.endsWith(".json"));
ok("backup file downloaded", !!backupName);
await clickText(page, `Export ${before.length} spends`);
await wait(1200);
const csvName = readdirSync(dl).find(f => f.endsWith(".csv"));
const csv = csvName ? readFileSync(join(dl, csvName), "utf8") : "";
ok("CSV has a header and one line per spend", csv.startsWith("﻿Date,Amount (₹),Category,Note,Paid by") && csv.trim().split("\r\n").length === before.length + 1);

const fresh = await phone();
ok("a fresh browser starts empty", (await dbRows(fresh)).length === 0);
await clickText(fresh, "Settings", "nav button");
await fresh.waitForSelector("[data-testid=restore-input]");
await (await fresh.$("[data-testid=restore-input]"))!.uploadFile(join(dl, backupName!));
await fresh.waitForSelector("[data-testid=restore-plan]");
ok(`restore preview: ${before.length} new`, (await text(fresh, "[data-testid=restore-plan]")).startsWith(`${before.length} new`));
await clickText(fresh, "Restore");
await wait(500);
const restored = await dbRows(fresh);
ok(`restore brings back every field of every spend (${restored.length} of ${before.length})`, restored.length === before.length && canon(restored) === canon(before));
const restoredLimit = await fresh.evaluate(() => new Promise<unknown>(res => {
  const r = indexedDB.open("expenses");
  r.onsuccess = () => { const q = r.result.transaction("settings").objectStore("settings").get("monthlyLimitPaise"); q.onsuccess = () => { res(q.result); r.result.close(); }; };
}));
ok("restore brings the ₹20,000 monthly limit to a phone with none", restoredLimit === 2000000);
await (await fresh.$("[data-testid=restore-input]"))!.uploadFile(join(dl, backupName!));
await fresh.waitForSelector("[data-testid=restore-plan]");
ok("restoring the same file again changes nothing", (await text(fresh, "[data-testid=restore-plan]")).includes(`${before.length} already here`));
await clickText(fresh, "Cancel");
const junk = join(dl, "junk.json");
await import("node:fs").then(fs => fs.writeFileSync(junk, JSON.stringify({ kind: "expense-tracker-backup", version: 1, expenses: [{ id: "x" }], learned: [] })));
await (await fresh.$("[data-testid=restore-input]"))!.uploadFile(junk);
await wait(300);
ok("a damaged file is refused", (await text(fresh, "[role=alert]")).includes("damaged"));

// ---------- Phone widths, keyboard ----------
for (const w of [320, 390]) {
  const p = await phone(w);
  for (const l of ["electricity bill 1,800 upi", "a very long note about something bought at the market today 120"]) await add(p, l);
  ok(`${w}px: no sideways scroll on Home`, await noOverflow(p));
  await clickText(p, "Month", "nav button"); await wait(200);
  ok(`${w}px: no sideways scroll on Month`, await noOverflow(p));
  await clickText(p, "Settings", "nav button"); await wait(200);
  ok(`${w}px: no sideways scroll on Settings`, await noOverflow(p));
  await clickText(p, "Home", "nav button"); await wait(200);
  await p.focus("#entry"); await wait(300);
  ok(`${w}px: bottom bar hides while typing`, (await p.$eval("nav", n => n.getAttribute("data-hidden"))) === "true");
  await p.close();
}

// ---------- Install and offline ----------
{
  const normal = await browser.newPage();
  await normal.goto(BASE, { waitUntil: "networkidle2" });
  await normal.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  const { installabilityErrors } = await (await normal.createCDPSession()).send("Page.getInstallabilityErrors");
  ok(`Chrome says it can be installed${installabilityErrors.length ? ` (${installabilityErrors.map(e => e.errorId).join(", ")})` : ""}`, installabilityErrors.length === 0);
  await normal.reload({ waitUntil: "networkidle2" });
  await wait(800);
  await normal.setOfflineMode(true);
  await normal.reload({ waitUntil: "domcontentloaded" }).catch(() => undefined);
  await normal.waitForSelector("#entry", { timeout: 5000 }).catch(() => undefined);
  ok("opens with no internet", !!(await normal.$("#entry")));
  if (await normal.$("#entry")) {
    const n = (await dbRows(normal)).length;
    await add(normal, "offline tea 15").catch(() => undefined);
    ok("adds a spend with no internet", (await dbRows(normal)).length === n + 1);
  }
  await normal.setOfflineMode(false);
}

await browser.close();
const failed = results.filter(r => !r.pass);
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"} ${r.name}`);
console.log(`\n${results.length - failed.length} of ${results.length} passed against ${BASE}`);
process.exit(failed.length ? 1 : 0);
