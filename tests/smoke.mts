import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
/** Taps something like a person would: scrolled to the middle of the screen first, clear of toasts and the bottom bar. */
async function tap(page: Page, sel: string) {
  await page.$eval(sel, el => el.scrollIntoView({ block: "center" }));
  await page.click(sel);
}
/** Taps a row like a person would: scrolled to the middle of the screen, clear of the add box and bottom bar. */
async function openRow(page: Page, id: string) {
  await page.$eval(`button[data-id="${id}"]`, b => b.scrollIntoView({ block: "center" }));
  await page.click(`button[data-id="${id}"]`);
  await page.waitForSelector("#edit-amount");
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
const INCOME = new Set(["salary", "business", "refund", "returns", "income"]);
const INVEST = new Set(["sip", "stocks", "deposit", "gold", "retirement", "termIns", "healthIns", "otherIns", "invest"]);
const spent = (rows: Row[]) => rows.filter(r => !INCOME.has(r.category) && !INVEST.has(r.category)).reduce((s, r) => s + r.amountPaise, 0);
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
await openRow(page, chai.id);
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
await openRow(page, chai.id);
await clickText(page, "Delete");
await wait(300);
ok("delete removes it", !(await dbRows(page)).some(r => r.id === chai.id));
await clickText(page, "Undo");
await wait(300);
ok("Undo brings it back unchanged", canon([(await dbRows(page)).find(r => r.id === chai.id)!]) === canon([chai2]));

// ---------- Add box sits within thumb reach ----------
{
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await wait(300);
  const r = await page.evaluate(() => {
    const save = [...document.querySelectorAll("form.dock button")].find(b => b.textContent?.trim() === "Save")!.getBoundingClientRect();
    const nav = document.querySelector("nav")!.getBoundingClientRect();
    return { saveTop: save.top, saveBottom: save.bottom, navTop: nav.top, h: innerHeight };
  });
  ok("Save button is in the bottom third of the screen", r.saveTop > (r.h * 2) / 3);
  ok("add box sits just above the bottom bar, not under it", r.saveBottom <= r.navTop);
}

// ---------- Money in ----------
const spentTodayBefore = paise(await text(page, "[data-testid=today-total]"));
await add(page, "salary 50,000");
rows = await dbRows(page);
ok("salary saved as Salary", rows.some(r => r.note === "salary" && r.category === "salary" && r.amountPaise === 5000000));
ok("money in doesn't count as spent today", paise(await text(page, "[data-testid=today-total]")) === spentTodayBefore);
{
  const m = rows.filter(r => r.date.slice(0, 7) === t.slice(0, 7));
  const inn = m.filter(r => INCOME.has(r.category)).reduce((s, r) => s + r.amountPaise, 0);
  ok("Home shows money in", (await text(page, "[data-testid=money-in]")).includes(`+₹${(inn / 100).toLocaleString("en-IN")}`));
  ok("Home shows what's left (in − spent)", paise(await text(page, "[data-testid=left]")) === Math.abs(inn - spent(m)));
}
await enter(page, "+1500 from ravi");
ok("+ means money in (preview shows +₹1,500)", (await text(page, "[data-testid=preview-amount]")) === "+₹1,500");
await page.keyboard.press("Escape");

// ---------- Invest & insure ----------
{
  await enter(page, "x"); await page.keyboard.press("Backspace");
  const spentBefore = paise(await text(page, "[data-testid=today-total]"));
  await add(page, "sip 5000");
  await add(page, "health insurance 12,000");
  rows = await dbRows(page);
  ok("sip → SIP & mutual funds, health insurance → Health insurance", rows.some(r => r.note === "sip" && r.category === "sip") && rows.some(r => r.note === "health insurance" && r.category === "healthIns"));
  ok("investments and insurance aren't counted as spent", paise(await text(page, "[data-testid=today-total]")) === spentBefore);
  ok("Home shows Invested & insured ₹17,000", (await text(page, "[data-testid=invested]")) === "₹17,000");
  const m = rows.filter(r => r.date.slice(0, 7) === t.slice(0, 7));
  const inn = m.filter(r => INCOME.has(r.category)).reduce((s, r) => s + r.amountPaise, 0);
  ok("Left = money in − spent − invested", paise(await text(page, "[data-testid=left]")) === Math.abs(inn - spent(m) - 1700000));
}

// ---------- Every month (now in Payments) ----------
const planStore = (pg: Page) => pg.evaluate(() => new Promise<{ id: string; name: string; skips: string[]; handledThrough: string | null }[]>(res => { const r = indexedDB.open("expenses"); r.onsuccess = () => { const q = r.result.transaction("plan").objectStore("plan").getAll(); q.onsuccess = () => { res(q.result); r.result.close(); }; }; }));
{
  // Netflix from two months ago, set to repeat: the months since are added straight away.
  const d = new Date(); const back = new Date(d.getFullYear(), d.getMonth() - 2, 1);
  const first = `${back.getDate()}/${back.getMonth() + 1}/${back.getFullYear()}`;
  await enter(page, `netflix 199 ${first}`);
  await clickText(page, "Every month");
  await page.focus("#entry"); await page.keyboard.press("Enter");
  await wait(1200);
  const nf = (await dbRows(page)).filter(r => r.note === "netflix");
  ok(`Every month: catches up to this month (3 entries: ${nf.map(r => r.date).join(", ")})`, nf.length === 3 && new Set(nf.map(r => r.date.slice(0, 7))).size === 3);
  ok("all three are linked to one Payments item", nf.every(r => r.planId && r.planId === nf[0]!.planId));
  await page.reload({ waitUntil: "networkidle2" }); await page.waitForSelector("#entry"); await wait(600);
  ok("reopening the app adds nothing twice", (await dbRows(page)).filter(r => r.note === "netflix").length === 3);
  await clickText(page, "Payments", "nav button");
  await page.waitForSelector("[data-plan=netflix]");
  ok("Payments lists it, paid this month", (await text(page, "[data-plan=netflix]")).includes("Paid ₹199"));
  await tap(page, "[data-plan=netflix]"); await page.waitForSelector("[data-testid=pay-go]");
  await clickText(page, "Edit details"); await page.waitForSelector("[data-testid=plan-save]");
  await clickText(page, "Delete", "dialog button"); await wait(400);
  ok("deleting it removes it from Payments", !(await page.$("[data-plan=netflix]")) && !(await planStore(page)).some(x => x.name === "netflix"));
  ok("...and keeps the entries already added", (await dbRows(page)).filter(r => r.note === "netflix").length === 3);
  await clickText(page, "Home", "nav button");
  await page.waitForSelector("#entry");
  // Turning it on from the edit sheet.
  const chai = (await dbRows(page)).find(r => r.note === "chai")!;
  await openRow(page, chai.id);
  await page.click("dialog input[type=checkbox]");
  await clickText(page, "Save changes");
  await wait(500);
  const chaiPlan = (await dbRows(page)).find(r => r.id === chai.id)?.planId;
  ok("edit sheet can turn on Every month", !!chaiPlan);
  ok("row says Every month", (await text(page, `button[data-id="${chai.id}"]`)).includes("Every month"));
  await openRow(page, chai.id);
  ok("edit sheet says which payment it belongs to", (await text(page, "[data-testid=part-of]")).includes("chai"));

  // Skip this month (on an entry Payments made): the entry goes, the item stays and the month is marked skipped.
  await page.click("[data-testid=skip-this]");
  await wait(400);
  ok("Skip this month removes the entry", !(await dbRows(page)).some(r => r.id === chai.id));
  const it = (await planStore(page)).find(x => x.id === chaiPlan)!;
  ok("...keeps the item and marks the month skipped", !!it && it.skips.includes(t.slice(0, 7)));
  await clickText(page, "Undo");
  await wait(300);
  ok("Undo brings the skipped entry back", (await dbRows(page)).some(r => r.id === chai.id) && !(await planStore(page)).find(x => x.id === chaiPlan)!.skips.length);

  // Coming up (Home): an item due in 3 days shows with Skip.
  const soon = new Date(); soon.setDate(soon.getDate() + 3);
  const lastMonth = new Date(soon.getFullYear(), soon.getMonth() - 1, Math.min(soon.getDate(), 28));
  await enter(page, `broadband 799 ${lastMonth.getDate()}/${lastMonth.getMonth() + 1}/${lastMonth.getFullYear()}`);
  await clickText(page, "Every month");
  await page.focus("#entry"); await page.keyboard.press("Enter");
  await wait(800);
  const dueSoon = soon.getDate() === lastMonth.getDate();
  if (dueSoon) {
    await page.waitForSelector("[data-testid=upcoming]", { timeout: 3000 }).catch(() => undefined);
    ok("Coming up lists broadband (due in 3 days)", (await text(page, "[data-testid=upcoming]")).includes("broadband"));
    await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-testid=upcoming] button")].find(b => b.textContent === "Skip")!.click());
    await wait(400);
    ok("Skip there removes it from Coming up", !(await text(page, "[data-testid=upcoming]")).includes("broadband"));
  }
}

// ---------- Month ----------
await clickText(page, "Month", "nav button");
await page.waitForSelector("[data-testid=month-total]");
rows = await dbRows(page);
const monthRows = rows.filter(r => r.date.slice(0, 7) === t.slice(0, 7));
const monthSum = spent(monthRows);
const monthIn = monthRows.reduce((s, r) => s + (INCOME.has(r.category) ? r.amountPaise : 0), 0);
ok("Month total = sum of the month's spends (money in excluded)", paise(await text(page, "[data-testid=month-total]")) === monthSum);
const catSums = await page.$$eval("ul[aria-label='By category'] > li > button", bs => bs.map(b => b.querySelector(".num")!.childNodes[0]!.textContent!.trim()));
ok(`category rows add up to the month total (${catSums.length} categories)`, catSums.reduce((s, c) => s + paise(c), 0) === monthSum);
await page.click("ul[aria-label='By category'] > li > button");
ok(`Month shows money in +₹${(monthIn / 100).toLocaleString("en-IN")}`, (await text(page, "[data-testid=month-in]")).includes(`+₹${(monthIn / 100).toLocaleString("en-IN")}`));
ok("Month lists investments by type (this month and all time)", (await text(page, "[data-testid=invest-summary]")).includes("Health insurance"));
// Tax saving (current financial year): health insurance ₹12,000 counts under Section 126; the plain SIP doesn't.
{
  const fyStart = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  ok(`tax card shows FY ${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`, (await text(page, "#tax-title")).includes(`${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`));
  ok("Section 126: ₹12,000 of ₹25,000", (await text(page, "[data-testid=tax-d]")).includes("₹12,000 of ₹25,000"));
  await page.click("[data-testid=seniorSelf]"); await wait(300);
  ok("60 or older: limit becomes ₹50,000", (await text(page, "[data-testid=tax-d]")).includes("₹12,000 of ₹50,000"));
  await page.click("[data-testid=seniorSelf]"); await wait(300);
  ok("plain SIP isn't counted under Section 123", (await text(page, "[data-testid=tax-c]")).includes("₹0 of ₹1,50,000"));
}
ok("tapping a category lists its spends", (await page.$$("ul[aria-label='By category'] > li ul button[data-id]")).length >= 1);
{
  const sip = (await dbRows(page)).find(r => r.note === "sip")!;
  await page.$eval("[data-testid=tax-c]", el => el.scrollIntoView({ block: "center" }));
  await page.goBack(); await wait(300);
  await openRow(page, sip.id);
  await page.select("#edit-tax", "c");
  await clickText(page, "Save changes"); await wait(400);
  ok("choosing Section 123 on an entry is saved", (await dbRows(page)).find(r => r.id === sip.id)?.tax === "c");
  await clickText(page, "Month", "nav button"); await page.waitForSelector("[data-testid=tax-c]");
  ok("...and Section 123 now counts ₹5,000", (await text(page, "[data-testid=tax-c]")).includes("₹5,000 of ₹1,50,000"));
}
await page.goBack();
await wait(300);
ok("phone Back returns to Home", !!(await page.$("#entry")));

// ---------- Limit ----------
await clickText(page, "Settings", "nav button");
await page.waitForSelector("#limit");
await page.type("#limit", "abc");
await page.click("[data-testid=limit-save]");
await wait(150);
ok("limit rejects text", (await text(page, "#limit-error")).length > 0);
await page.click("#limit", { count: 3 }); await page.keyboard.press("Backspace"); await page.type("#limit", "20000");
await page.click("[data-testid=limit-save]");
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
await clickText(page, `Export ${before.length} entries`);
await wait(1200);
const csvName = readdirSync(dl).find(f => f.endsWith(".csv"));
const csv = csvName ? readFileSync(join(dl, csvName), "utf8") : "";
ok(`CSV has a header and one line per entry (${csv.trim().split("\r\n").length - 1} lines, ${before.length} entries)`, csv.startsWith("\uFEFFDate,Type,Amount (₹),Category,Note,Paid by") && csv.trim().split("\r\n").length === before.length + 1);

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

// ---------- People: lent and borrowed ----------
{
  await clickText(page, "Home", "nav button");
  await page.waitForSelector("#entry");
  const spentToday = paise(await text(page, "[data-testid=today-total]"));
  await enter(page, "borrowed 200 from asha");
  ok("Home box reads a loan line (preview)", (await text(page, "[data-testid=debt-preview]")).includes("Asha gave you"));
  await page.keyboard.press("Enter");
  await wait(400);
  ok("a loan doesn't change spending", paise(await text(page, "[data-testid=today-total]")) === spentToday);
  await clickText(page, "Wealth", "nav button");
  await page.waitForSelector("#p-name");
  ok("People: you owe ₹200", (await text(page, "[data-testid=you-owe]")) === "₹200");
  await page.type("#p-name", "Ravi"); await page.type("#p-amount", "500");
  await clickText(page, "Save", "form button");
  await wait(400);
  ok("People: Ravi owes you ₹500", (await text(page, "[data-testid=owed-to-you]")) === "₹500" && (await text(page, "[data-testid=people]")).includes("Ravi owes you ₹500"));
  await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-testid=people] button")].find(b => b.textContent?.includes("Ravi"))!.click());
  await page.waitForSelector("[data-testid=person-balance]");
  await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("dialog button")].find(b => b.textContent?.startsWith("Settle up"))!.click());
  await wait(400);
  ok("Settle up clears Ravi", (await text(page, "[data-testid=person-balance]")) === "Settled" && (await text(page, "[data-testid=owed-to-you]")) === "₹0");
  await page.keyboard.press("Escape");
}

// ---------- Budgets ----------
{
  await clickText(page, "Settings", "nav button");
  await page.waitForSelector("#b-food");
  await page.type("#b-food", "100");
  await page.click("[data-testid=budgets-save]");
  await wait(300);
  await clickText(page, "Home", "nav button");
  await page.waitForSelector("[data-testid=budget-warnings]");
  ok("Home warns: Food over budget", (await text(page, "[data-testid=budget-warnings]")).includes("Food: ₹"));
  await clickText(page, "Month", "nav button");
  await page.waitForSelector("[data-testid=month-total]");
  ok("Month shows Food against its budget", (await text(page, "ul[aria-label='By category']")).includes("of ₹100"));
}

// ---------- Trends ----------
{
  ok("Month shows the spend-per-day chart", !!(await page.$("[data-testid=daily-chart]")));
  ok("Month shows the last 6 months chart", !!(await page.$("[data-testid=six-chart]")));
  ok("Month compares with last month", (await text(page, "[data-testid=vs-last]")).includes("last month"));
  await page.evaluate(() => (document.querySelector("[data-testid=daily-chart] figcaption button") as HTMLElement).click());
  const dayRows = await page.$$eval("[data-testid=daily-chart] tbody tr", r => r.length);
  ok(`chart has a table view (${dayRows} days, one per day so far)`, dayRows === new Date().getDate());
  const tableSum = await page.$$eval("[data-testid=daily-chart] tbody tr td:last-child", c => c.map(x => x.textContent!));
  ok("daily table adds up to the month total", tableSum.reduce((s, x) => s + paise(x), 0) === paise(await text(page, "[data-testid=month-total]")));
}

// ---------- Search ----------
{
  await clickText(page, "Home", "nav button");
  await page.waitForSelector("#entry");
  await tap(page, "button[aria-controls=search-panel]");
  await page.type("#q", "swiggy");
  await wait(200);
  ok("search finds swiggy (1 entry)", (await text(page, "[data-testid=search-summary]")).startsWith("1 entry"));
  await page.click("#q", { count: 3 }); await page.keyboard.press("Backspace");
  await page.select("#search-panel select:nth-of-type(1)", "");
  await page.evaluate(() => { const s = document.querySelectorAll<HTMLSelectElement>("#search-panel select")[2]!; s.value = "in"; s.dispatchEvent(new Event("change", { bubbles: true })); });
  await wait(200);
  const inRows = (await dbRows(page)).filter(r => INCOME.has(r.category)).length;
  ok(`filter "Money in only" (${inRows})`, (await text(page, "[data-testid=search-summary]")).startsWith(inRows === 1 ? "1 entry" : `${inRows} entries`));
}

// ---------- Share sheet and home-screen shortcut ----------
{
  const p = await phone();
  await p.goto(`${BASE}/?text=${encodeURIComponent("₹500 paid to Ravi Kumar on 12 Nov via Google Pay")}`, { waitUntil: "networkidle2" });
  await p.waitForFunction(() => (document.querySelector("#entry") as HTMLInputElement | null)?.value !== "", { timeout: 5000 }).catch(() => undefined);
  ok("shared payment fills the box", (await p.$eval("#entry", e => (e as HTMLInputElement).value)) === "Ravi Kumar 500 upi");
  ok("shared text is cleared from the address bar", !(await p.evaluate(() => location.search)));
  await p.goto(`${BASE}/?add=1`, { waitUntil: "networkidle2" });
  await wait(400);
  ok("shortcut opens with the box ready to type", await p.evaluate(() => document.activeElement?.id === "entry"));
  const m = await p.evaluate(async () => (await fetch("/manifest.webmanifest")).json());
  ok("manifest: share target takes receipt images, and 3 shortcuts", m.share_target?.action === "/share-target" && m.share_target?.params?.files?.[0]?.accept?.includes("image/*") && m.shortcuts?.length === 3);
  await p.close();
}

// ---------- Hindi and Kannada ----------
{
  const p = await phone();
  await clickText(p, "Settings", "nav button");
  await p.waitForSelector("input[name=lang]");
  await p.evaluate(() => (document.querySelector("input[name=lang][value=hi]") as HTMLElement).click());
  await wait(300);
  ok("Hindi: bottom bar reads होम", (await text(p, "[data-tab=home]")) === "होम" && (await p.evaluate(() => document.documentElement.lang)) === "hi-IN");
  await p.reload({ waitUntil: "networkidle2" }); await wait(400);
  ok("Hindi is remembered after reopening", (await text(p, "[data-tab=settings]")) === "सेटिंग्स");
  await p.evaluate(() => (document.querySelector("[data-tab=home]") as HTMLElement).click());
  await p.waitForSelector("#entry");
  await enter(p, "चाय 20");
  ok("typing चाय 20 reads ₹20 · खाना", (await text(p, "[data-testid=preview-amount]")) === "₹20" && (await p.$eval("#entry-help select", e => (e as HTMLSelectElement).selectedOptions[0]!.textContent)) === "खाना");
  await p.keyboard.press("Enter"); await wait(300);
  ok("Hindi toast", (await text(p, "[role=status]")).includes("सेव हुआ"));
  ok("Hindi: no sideways scroll", await noOverflow(p));
  await p.evaluate(() => (document.querySelector("[data-tab=settings]") as HTMLElement).click());
  await p.waitForSelector("input[name=lang]");
  await p.evaluate(() => (document.querySelector("input[name=lang][value=kn]") as HTMLElement).click());
  await wait(300);
  ok("Kannada: bottom bar reads ಮುಖಪುಟ", (await text(p, "[data-tab=home]")) === "ಮುಖಪುಟ");
  for (const tab of ["home", "payments", "month", "wealth", "settings"]) {
    await p.evaluate((k: string) => (document.querySelector(`[data-tab=${k}]`) as HTMLElement).click(), tab); await wait(250);
  }
  ok("Kannada: no sideways scroll on any screen", await noOverflow(p));
  await p.close();
}

// ---------- Upgrade: an older install's "Every month" items move into Payments ----------
{
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.evaluateOnNewDocument("globalThis.__name = f => f");
  await p.goto(`${BASE}/robots.txt`);
  // The database as the previous version left it (v4), with one repeat and the entry it made.
  await p.evaluate(() => new Promise<void>((res, rej) => {
    const r = indexedDB.open("expenses", 4);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore("expenses", { keyPath: "id" }).createIndex("date", "date");
      for (const n of ["learned"]) d.createObjectStore(n, { keyPath: "word" });
      d.createObjectStore("settings");
      for (const n of ["repeats", "debts", "accounts", "transfers", "holdings", "goals", "photos"]) d.createObjectStore(n, { keyPath: "id" });
    };
    r.onsuccess = () => {
      const now = new Date(); const m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const tx = r.result.transaction(["repeats", "expenses"], "readwrite");
      tx.objectStore("repeats").put({ id: "rrrrrrrr-0000-4000-8000-000000000001", amountPaise: 79900, note: "wifi", category: "bills", method: null, day: 1, lastMonth: m, createdAt: "2026-01-01T00:00:00.000Z" });
      tx.objectStore("expenses").put({ id: "eeeeeeee-0000-4000-8000-000000000001", amountPaise: 79900, note: "wifi", category: "bills", method: null, date: `${m}-01`, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", repeatId: "rrrrrrrr-0000-4000-8000-000000000001" });
      tx.oncomplete = () => { r.result.close(); res(); };
      tx.onerror = () => rej(tx.error);
    };
  }));
  await p.goto(BASE, { waitUntil: "networkidle2" }); await p.waitForSelector("#entry"); await wait(600);
  const moved = await planStore(p);
  ok("old 'Every month' item is now in Payments (same id)", moved.length === 1 && moved[0]!.id === "rrrrrrrr-0000-4000-8000-000000000001" && moved[0]!.name === "wifi");
  ok("you're told it moved", (await text(p, "[role=status]")).includes("now in Payments"));
  await clickText(p, "Payments", "nav button"); await p.waitForSelector("[data-plan=wifi]");
  ok("its old entry still counts as this month's payment", (await text(p, "[data-plan=wifi]")).includes("Paid ₹799"));
  await p.reload({ waitUntil: "networkidle2" }); await wait(500);
  ok("nothing added twice after reopening", (await dbRows(p)).length === 1 && (await planStore(p)).length === 1);
  await ctx.close();
}

// ---------- Payments: salary, loans, SIP, insurance, bills ----------
{
  const p = await phone();
  const D = new Date().getDate();
  await clickText(p, "Payments", "nav button");
  await p.waitForSelector("[data-testid=plan-add-empty]");
  const addItem = async (type: string, fill: Record<string, string>, pickName?: string, startEmpty = false) => {
    await tap(p, startEmpty ? "[data-testid=plan-add-empty]" : "[data-testid=plan-add]");
    await p.waitForSelector("[data-testid=plan-types]");
    await clickText(p, type, "[data-testid=plan-types] button span"); // the tile's title
    await p.waitForSelector("[data-testid=plan-save]");
    if (pickName) await clickText(p, pickName, "[data-testid=plan-picks] button");
    for (const [id, v] of Object.entries(fill)) { await p.click(`#${id}`, { count: 3 }); await p.keyboard.press("Backspace"); await p.type(`#${id}`, v); }
    await p.click("[data-testid=plan-save]"); await wait(500);
  };
  await addItem("Salary", { "pl-amount": "85000", "pl-day": "1" }, undefined, true);
  await addItem("Loan with EMI", { "pl-principal": "100000", "pl-rate": "12", "pl-amount": "10000", "pl-day": String(D) });
  await addItem("Gold loan", { "pl-principal": "50000", "pl-rate": "9" });
  await addItem("SIP", { "pl-amount": "5000", "pl-day": String(Math.min(D + 1, 28)) });
  await addItem("Bill or subscription", { "pl-amount": "649", "pl-day": String(D) }, "Netflix");
  await addItem("Bill or subscription", {}, "Bike petrol");
  const items = await planStore(p);
  ok(`6 monthly items saved (${items.map(x => x.name).join(", ")})`, items.length === 6);
  await wait(800);
  const rws = await dbRows(p);
  ok("Netflix (auto, due today) is paid by itself", rws.some(r => r.note === "Netflix" && r.amountPaise === 64900 && r.planId) && (await text(p, "[data-plan=Netflix]")).includes("Paid ₹649"));

  // Salary received → what's left after payments.
  await tap(p, "[data-plan=Salary]"); await p.waitForSelector("[data-testid=pay-go]");
  ok("salary box suggests ₹85,000", (await p.$eval("#pay-amount", e => (e as HTMLInputElement).value)) === "85000");
  await p.click("[data-testid=pay-go]"); await wait(400);
  ok("salary saved as money in, linked", (await dbRows(p)).some(r => r.category === "salary" && r.amountPaise === 8500000 && r.planId));
  ok("summary says what's left after all payments", (await text(p, "[data-testid=plan-free]")).startsWith("After all payments"));

  // Loan with EMI: what's left, months to go, a pay-more tip; then pay the EMI.
  await tap(p, "[data-plan='Personal loan']"); await p.waitForSelector("[data-testid=loan-info]");
  const li = await text(p, "[data-testid=loan-info]");
  ok("loan shows ₹1,00,000 left and EMIs to go", li.includes("Left to pay: ₹1,00,000") && /\d+ more EMIs/.test(li));
  ok("loan shows a pay-more tip", (await text(p, "[data-testid=loan-tip]")).startsWith("Pay ₹1,000 more a month"));
  await p.click("[data-testid=pay-go]"); await wait(400);
  ok("EMI paid: ₹10,000 entry under Rent & EMI", (await dbRows(p)).some(r => r.category === "rent" && r.amountPaise === 1000000 && r.planId));
  ok("loan row now says ₹90,000 left", (await text(p, "[data-plan='Personal loan']")).includes("Left to pay: ₹90,000"));

  // Gold loan: total to close today, pay any amount.
  await tap(p, "[data-plan='Gold loan']"); await p.waitForSelector("[data-testid=loan-info]");
  ok("gold loan: ₹50,000 to close today", (await text(p, "[data-testid=loan-info]")).includes("To close today: ₹50,000"));
  await p.keyboard.press("Escape"); await wait(200);

  // SIP: skip this month.
  await tap(p, "[data-plan=SIP]"); await p.waitForSelector("[data-testid=pay-skip]");
  await p.click("[data-testid=pay-skip]"); await wait(400);
  ok("SIP skipped this month", (await text(p, "[data-plan=SIP]")).includes("Skipped this month"));

  // Smart: typing "bike petrol 450" on Home ticks off Bike petrol.
  await clickText(p, "Home", "nav button"); await p.waitForSelector("#entry");
  await add(p, "bike petrol 450");
  const bikeId = (await planStore(p)).find(x => x.name === "Bike petrol")!.id;
  ok("'bike petrol 450' counts as the Bike petrol payment", (await dbRows(p)).some(r => r.note === "bike petrol" && r.planId === bikeId));
  ok("Home shows this month's payments", (await text(p, "[data-testid=home-payments]")).includes("done"));

  // Loans count in net worth.
  await clickText(p, "Wealth", "nav button"); await p.waitForSelector("[data-testid=plan-loans]");
  ok("Wealth lists both loans from Payments", (await text(p, "[data-testid=plan-loans]")).includes("Personal loan") && (await text(p, "[data-testid=plan-loans]")).includes("Gold loan"));
  ok("net worth = −(₹90,000 + ₹50,000)", (await text(p, "[data-testid=networth-total]")) === "−₹1,40,000");
  await clickText(p, "Payments", "nav button"); await wait(300);
  ok("Payments: no sideways scroll", await noOverflow(p));
  await p.close();
}

// ---------- Wealth: accounts, transfers, net worth, goals ----------
{
  const p = await phone();
  const store = (name: string) => p.evaluate((n: string) => new Promise<{ id: string; [k: string]: unknown }[]>(res => { const r = indexedDB.open("expenses"); r.onsuccess = () => { const q = r.result.transaction(n).objectStore(n).getAll(); q.onsuccess = () => { res(q.result); r.result.close(); }; }; }), name);
  await clickText(p, "Wealth", "nav button");
  await p.waitForSelector("[data-testid=add-account]");
  const addAccount = async (type: "bank" | "cash" | "card", name: string, rs: string) => {
    await tap(p, "[data-testid=add-account]"); await p.waitForSelector("#a-name");
    await p.evaluate((k: string) => (document.querySelector(`input[name=atype][value=${k}]`) as HTMLElement).click(), type);
    await p.type("#a-name", name); await p.type("#a-open", rs);
    await clickText(p, "Save", "dialog button"); await wait(300);
  };
  await addAccount("bank", "SBI", "50000");
  await addAccount("cash", "Wallet", "2000");
  await addAccount("card", "HDFC card", "3000");
  const acs = await store("accounts");
  ok("3 accounts saved (card stored as −₹3,000 owed)", acs.length === 3 && acs.find(a => a.name === "HDFC card")?.openingPaise === -300000);
  const sbi = acs.find(a => a.name === "SBI")!.id, wallet = acs.find(a => a.name === "Wallet")!.id;
  await p.select("[data-testid=upiAccount]", sbi); await p.select("[data-testid=cashAccount]", wallet); await wait(200);
  ok("net worth = 50,000 + 2,000 − 3,000", (await text(p, "[data-testid=networth-total]")) === "₹49,000");
  // An entry paid by UPI goes to the UPI account by itself.
  await clickText(p, "Home", "nav button"); await p.waitForSelector("#entry");
  await add(p, "auto 80 upi"); await add(p, "chai 20 cash");
  const rws = await dbRows(p);
  ok("UPI entry → SBI, cash entry → Wallet", rws.find(r => r.note === "auto")?.accountId === sbi && rws.find(r => r.note === "chai")?.accountId === wallet);
  await clickText(p, "Wealth", "nav button"); await p.waitForSelector("[data-testid=accounts]");
  ok("SBI balance ₹49,920", (await text(p, "[data-testid=accounts]")).includes("₹49,920"));
  // Move ₹1,000 from SBI to the card (paying the bill): not spending.
  await clickText(p, "Move money"); await p.waitForSelector("#m-amt");
  await p.select("#m-from", sbi); await p.select("#m-to", acs.find(a => a.name === "HDFC card")!.id);
  await p.type("#m-amt", "1000"); await clickText(p, "Save", "dialog button"); await wait(300);
  ok("card now owes ₹2,000; SBI ₹48,920", (await text(p, "[data-testid=accounts]")).includes("You owe ₹2,000") && (await text(p, "[data-testid=accounts]")).includes("₹48,920"));
  ok("moving money keeps net worth (₹48,900 after ₹100 spent)", (await text(p, "[data-testid=networth-total]")) === "₹48,900");
  // What you own, and a loan.
  for (const [kind, name, rs] of [["ppf", "PPF", "200000"], ["loan", "Bike loan", "40000"]] as const) {
    await tap(p, "[data-testid=add-holding]"); await p.waitForSelector("#h-kind");
    await p.select("#h-kind", kind); await p.type("#h-name", name); await p.type("#h-val", rs);
    await clickText(p, "Save", "dialog button"); await wait(300);
  }
  ok("net worth = 48,900 + 2,00,000 − 40,000", (await text(p, "[data-testid=networth-total]")) === "₹2,08,900");
  // A goal with a date: how much a month.
  const d = new Date(); const by = new Date(d.getFullYear(), d.getMonth() + 7, 1);
  await tap(p, "[data-testid=add-goal]"); await p.waitForSelector("#g-name");
  await p.type("#g-name", "Bike"); await p.type("#g-target", "80000");
  await p.$eval("#g-by", (el, v) => { const i = el as HTMLInputElement; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!; set.call(i, v); i.dispatchEvent(new Event("input", { bubbles: true })); }, `${by.getFullYear()}-${String(by.getMonth() + 1).padStart(2, "0")}`);
  await clickText(p, "Save", "dialog button"); await wait(300);
  await clickText(p, "Add money"); await p.waitForSelector("#am"); await p.type("#am", "20000"); await clickText(p, "Save", "dialog button"); await wait(300);
  ok("goal: ₹20,000 of ₹80,000 saved, ₹7,500 a month for 8 months", (await text(p, "[data-testid=goal-progress]")).includes("₹20,000 of ₹80,000 saved") && (await text(p, "[data-testid=goal-progress]")).includes("₹7,500 a month for 8 months"));
  ok("Wealth: no sideways scroll at 390px", await noOverflow(p));

  // ---------- Bank statement import ----------
  await clickText(p, "Settings", "nav button"); await p.waitForSelector("[data-testid=statement-input]");
  const before = (await dbRows(p)).length;
  await (await p.$("[data-testid=statement-input]"))!.uploadFile(new URL("./statements/debit-credit.csv", import.meta.url).pathname);
  await p.waitForSelector("[data-testid=import-found]");
  ok("statement: 7 transactions found", (await text(p, "[data-testid=import-found]")).startsWith("7 transactions"));
  const ticked = await p.$$eval("[data-testid=import-rows] input[type=checkbox]", xs => xs.filter(x => (x as HTMLInputElement).checked).length);
  ok(`ATM cash and the card bill come unticked (${ticked} of 7 ticked)`, ticked === 5);
  await tap(p, "[data-testid=import-go]"); await wait(500);
  const after = await dbRows(p);
  ok(`import adds exactly the ticked rows (${after.length - before})`, after.length - before === ticked);
  ok("imported salary is money in, Swiggy is Food", after.some(r => r.note === "salary" && r.category === "salary" && r.date === "2026-11-01") && after.some(r => r.note === "Swiggy" && r.category === "food"));
  await clickText(p, "Undo"); await wait(500);
  ok("Undo removes the whole import", (await dbRows(p)).length === before);

  // ---------- Receipt photo on an entry ----------
  await clickText(p, "Home", "nav button"); await p.waitForSelector("#entry");
  const chai = (await dbRows(p)).find(r => r.note === "chai")!;
  await openRow(p, chai.id);
  await (await p.$("[data-testid=photo-input]"))!.uploadFile(new URL("../public/icon-512.png", import.meta.url).pathname);
  await p.waitForSelector("[data-testid=photo] img", { timeout: 5000 }).catch(() => undefined);
  ok("photo attaches to the entry", (await dbRows(p)).find(r => r.id === chai.id)?.photo === true && (await store("photos")).length === 1);
  const jpeg = await p.evaluate(() => new Promise<string>(res => { const r = indexedDB.open("expenses"); r.onsuccess = () => { const q = r.result.transaction("photos").objectStore("photos").getAll(); q.onsuccess = () => res(`${q.result[0].blob.type} ${q.result[0].blob.size}`); }; }));
  ok(`photo saved as a small JPEG (${jpeg})`, /^image\/jpeg \d+$/.test(jpeg) && Number(jpeg.split(" ")[1]) < 300_000);
  await clickText(p, "Remove photo"); await wait(300);
  ok("Remove photo deletes it", !(await dbRows(p)).find(r => r.id === chai.id)?.photo && (await store("photos")).length === 0);
  await p.keyboard.press("Escape");

  // ---------- Notes and the year ----------
  await clickText(p, "Month", "nav button"); await p.waitForSelector("[data-testid=mode-year]");
  await p.click("[data-testid=mode-year]"); await p.waitForSelector("[data-testid=year]");
  const yr = String(new Date().getFullYear());
  const ySpent = (await dbRows(p)).filter(r => r.date.startsWith(yr) && !INCOME.has(r.category) && !INVEST.has(r.category)).reduce((s2, r) => s2 + r.amountPaise, 0);
  ok(`year in review: spent = this year's spends (${ySpent / 100})`, paise(await text(p, "[data-testid=year-spent]")) === ySpent);
  ok("Year: no sideways scroll", await noOverflow(p));
  await p.close();
}
{
  // Notes need a few entries: the first browser's data has them.
  await clickText(page, "Month", "nav button"); await page.waitForSelector("[data-testid=mode-month]");
  ok("Month shows Notes (fixed monthly payments)", (await text(page, "[data-testid=notes]")).includes("Fixed monthly payments"));
  await clickText(page, "Home", "nav button"); await page.waitForSelector("#entry");
}

// ---------- In hand: what you have now, carried into next month ----------
{
  const p = await phone();
  const now = async () => paise(await text(p, "[data-testid=inhand-now]"));
  ok("Home asks how much you have", !!(await p.$("[data-testid=inhand-form]")));
  await p.type("#inhand-amt", "20,000"); await tap(p, "[data-testid=inhand-save]");
  await p.waitForSelector("[data-testid=inhand-now]");
  ok("in hand set to ₹20,000", (await now()) === 20000_00);
  await add(p, "chai 50"); await add(p, "salary 1000"); await add(p, "sip 500"); await add(p, "lent ravi 200"); await wait(300);
  ok("spend, salary, SIP and lending all update in hand (₹20,250)", (await now()) === 20250_00);
  ok("this month's in and out shown", (await text(p, "[data-testid=inhand-month]")) === "+₹1,000 in · −₹750 out");
  await tap(p, "[data-testid=inhand-fix]");
  await p.click("#inhand-amt", { count: 3 }); await p.keyboard.press("Backspace"); await p.type("#inhand-amt", "30000"); await tap(p, "[data-testid=inhand-save]");
  await p.waitForSelector("[data-testid=inhand-now]"); await wait(200);
  ok("correcting it sets the new amount", (await now()) === 30000_00);
  await add(p, "auto 40"); await wait(200);
  ok("entries after the correction still count", (await now()) === 29960_00);
  // Started last month: what was left comes over.
  await p.evaluate(() => new Promise<void>((res, rej) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-15`;
    const r = indexedDB.open("expenses");
    r.onerror = () => rej(r.error);
    r.onsuccess = () => { const tx = r.result.transaction("settings", "readwrite"); tx.objectStore("settings").put({ paise: 1000000, date: day, at: `${day}T00:00:00.000Z` }, "inHand"); tx.oncomplete = () => { r.result.close(); res(); }; };
  }));
  await p.reload({ waitUntil: "networkidle2" }); await p.waitForSelector("[data-testid=inhand-now]");
  const line = await text(p, "[data-testid=inhand-month]");
  ok(`last month's ₹10,000 carried over (${line})`, /^From \S+: ₹10,000 · \+₹1,000 in · −₹790 out$/.test(line));
  ok("in hand now = 10,000 + 1,000 − 790", (await now()) === 10210_00);
  await clickText(p, "Month", "nav button"); await p.waitForSelector("[data-testid=month-hand]");
  const mh = await text(p, "[data-testid=month-hand]");
  ok(`Month shows started with and in hand now (${mh})`, mh.includes("Started with₹10,000") && mh.includes("In hand now₹10,210"));
  ok("no sideways scroll", await noOverflow(p));
  await p.close();
}

// ---------- Split a bill ----------
{
  const p = await phone();
  const debtRows = () => p.evaluate(() => new Promise<{ person: string; amountPaise: number; dir: string; note: string }[]>((res, rej) => {
    const r = indexedDB.open("expenses"); r.onerror = () => rej(r.error);
    r.onsuccess = () => { const q = r.result.transaction("debts").objectStore("debts").getAll(); q.onsuccess = () => { res(q.result); r.result.close(); }; };
  }));
  await enter(p, "dinner 1200 split ravi asha");
  ok("split preview: 3 ways, ₹400 each", (await text(p, "[data-testid=split-preview]")) === "Split 3 ways · your share ₹400 · Ravi and Asha owe you ₹400 each");
  await p.keyboard.press("Enter");
  await p.waitForFunction(() => (document.querySelector("#entry") as HTMLInputElement).value === "", { timeout: 3000 }); await wait(300);
  const r1 = await dbRows(p), d1 = await debtRows(p);
  ok("your ₹400 share saved as a food spend", r1.length === 1 && r1[0]!.amountPaise === 400_00 && r1[0]!.category === "food" && r1[0]!.note === "dinner");
  ok("Ravi and Asha each owe ₹400 (People)", d1.length === 2 && d1.every(d => d.amountPaise === 400_00 && d.dir === "gave") && d1.map(d => d.person).sort().join() === "Asha,Ravi");
  await add(p, "cab 600 split 3 ways"); await wait(300);
  ok("split 3 ways with no names: only your ₹200", (await dbRows(p)).some(r => r.note === "cab" && r.amountPaise === 200_00) && (await debtRows(p)).length === 2);
  await p.close();
}

// ---------- Reminders: calendar file and notifications ----------
{
  const p = await phone();
  await p.browserContext().overridePermissions(BASE, ["notifications"]);
  const d = today();
  await p.evaluate((d: string) => new Promise<void>((res, rej) => {
    const r = indexedDB.open("expenses"); r.onerror = () => rej(r.error);
    r.onsuccess = () => {
      const at = new Date().toISOString();
      const tx = r.result.transaction("plan", "readwrite");
      tx.objectStore("plan").put({ id: "rrrrrrrr-0000-4000-8000-000000000001", name: "Wi-Fi", kind: "bill", category: "bills", amountPaise: 79900, day: Number(d.slice(8)), every: 1,
        startMonth: d.slice(0, 7), autoPay: false, handledThrough: null, skips: [], accountId: null, loan: null, createdAt: at, updatedAt: at });
      tx.oncomplete = () => { r.result.close(); res(); };
    };
  }), d);
  await p.reload({ waitUntil: "networkidle2" }); await p.waitForSelector("#entry");
  await clickText(p, "Payments", "nav button"); await p.waitForSelector("[data-testid=remind]");
  const dir = await mkdtemp(join(tmpdir(), "kharcha-ics-"));
  await (await p.createCDPSession()).send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: dir });
  await tap(p, "[data-testid=remind-calendar]");
  let ics = "";
  for (let k = 0; k < 20 && !ics; k++) { await wait(200); const f = (await readdir(dir)).find(x => x.endsWith(".ics")); if (f) ics = await readFile(join(dir, f), "utf8"); }
  ok(`calendar file has Wi-Fi monthly with an alert (${ics.length} chars${ics ? "" : ", no file"})`, ics.includes("SUMMARY:Wi-Fi due · ₹799") && ics.includes(`BYMONTHDAY=${Math.min(Number(d.slice(8)), 29) >= 29 ? -1 : Number(d.slice(8))}`) && ics.includes("BEGIN:VALARM"));
  await tap(p, "[data-testid=remind-notify]");
  await p.waitForFunction(() => document.querySelector("[data-testid=remind-notify]")?.getAttribute("aria-checked") === "true", { timeout: 4000 }).catch(() => undefined);
  ok("notifications switch turns on", (await p.$eval("[data-testid=remind-notify]", b => b.getAttribute("aria-checked"))) === "true");
  await wait(800);
  const shown = await p.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map(n => n.title));
  ok(`a notification for Wi-Fi due today (${shown.join(" | ")})`, shown.includes("Wi-Fi is due today · ₹799"));
  await p.evaluate(async () => { for (const n of await (await navigator.serviceWorker.ready).getNotifications()) n.close(); });
  await p.reload({ waitUntil: "networkidle2" }); await wait(1200);
  const again = await p.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).length);
  ok("shown once, not again on reopening", shown.length > 0 && again === 0);
  await p.close();
}

// ---------- Google Drive backup: Google accepts this site (the sign-in itself needs a real account) ----------
{
  const p = await phone();
  await add(p, "chai 20");
  await clickText(p, "Settings", "nav button"); await p.waitForSelector("[data-testid=drive-backup]");
  ok("Drive backup and restore buttons shown", !!(await p.$("[data-testid=drive-restore]")));
  await wait(1500);
  const popup = new Promise<Page | null>(res => { p.browserContext().once("targetcreated", async t => res(await t.page())); setTimeout(() => res(null), 10000); });
  await tap(p, "[data-testid=drive-backup]");
  const g = await popup;
  let url = "";
  if (g) { await g.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => undefined); url = g.url(); }
  const err = /\/error|origin_mismatch|invalid_client|redirect_uri_mismatch/.test(url) || (g ? /origin_mismatch|invalid_client|Access blocked|doesn.t comply/i.test(await g.content().catch(() => "")) : true);
  ok(`Google's sign-in opens with no setup error (${url.slice(0, 60)})`, !!g && url.includes("accounts.google.com") && !err);
  await g?.close().catch(() => undefined);
  await p.close();
}

// ---------- Phone widths, keyboard ----------
for (const w of [320, 390]) {
  const p = await phone(w);
  for (const l of ["electricity bill 1,800 upi", "a very long note about something bought at the market today 120"]) await add(p, l);
  ok(`${w}px: no sideways scroll on Home`, await noOverflow(p));
  await clickText(p, "Month", "nav button"); await wait(200);
  ok(`${w}px: no sideways scroll on Month`, await noOverflow(p));
  await clickText(p, "Wealth", "nav button"); await wait(200);
  ok(`${w}px: no sideways scroll on Wealth`, await noOverflow(p));
  await clickText(p, "Payments", "nav button"); await wait(200);
  ok(`${w}px: no sideways scroll on Payments`, await noOverflow(p));
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
