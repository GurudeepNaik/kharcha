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
const INCOME = new Set(["salary", "business", "refund", "income"]);
const spent = (rows: Row[]) => rows.filter(r => !INCOME.has(r.category)).reduce((s, r) => s + r.amountPaise, 0);
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

// ---------- Every month ----------
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
  ok("all three are linked to one repeat", nf.every(r => r.repeatId && r.repeatId === nf[0]!.repeatId));
  await page.reload({ waitUntil: "networkidle2" }); await page.waitForSelector("#entry"); await wait(600);
  ok("reopening the app adds nothing twice", (await dbRows(page)).filter(r => r.note === "netflix").length === 3);
  await clickText(page, "Settings", "nav button");
  await page.waitForSelector("[data-testid=repeats]");
  ok("Settings lists it under Every month", (await text(page, "[data-testid=repeats]")).includes("netflix"));
  await clickText(page, "Stop");
  await wait(300);
  ok("Stop removes it from the list", !(await page.$("[data-testid=repeats]")));
  ok("stopping keeps the entries already added", (await dbRows(page)).filter(r => r.note === "netflix").length === 3);
  await clickText(page, "Home", "nav button");
  await page.waitForSelector("#entry");
  // Turning it on from the edit sheet.
  const chai = (await dbRows(page)).find(r => r.note === "chai")!;
  await openRow(page, chai.id);
  await page.click("dialog input[type=checkbox]");
  await clickText(page, "Save changes");
  await wait(500);
  ok("edit sheet can turn on Every month", !!(await dbRows(page)).find(r => r.id === chai.id)?.repeatId);
  ok("row says Every month", (await text(page, `button[data-id="${chai.id}"]`)).includes("Every month"));
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
ok("tapping a category lists its spends", (await page.$$("ul[aria-label='By category'] > li ul button[data-id]")).length >= 1);
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
  await clickText(page, "People", "nav button");
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
  await page.click("button[aria-controls=search-panel]");
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
  ok("manifest: share target and 3 shortcuts", m.share_target?.action === "/" && m.shortcuts?.length === 3);
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
  for (const tab of ["home", "month", "people", "settings"]) {
    await p.evaluate((k: string) => (document.querySelector(`[data-tab=${k}]`) as HTMLElement).click(), tab); await wait(250);
  }
  ok("Kannada: no sideways scroll on any screen", await noOverflow(p));
  await p.close();
}

// ---------- Phone widths, keyboard ----------
for (const w of [320, 390]) {
  const p = await phone(w);
  for (const l of ["electricity bill 1,800 upi", "a very long note about something bought at the market today 120"]) await add(p, l);
  ok(`${w}px: no sideways scroll on Home`, await noOverflow(p));
  await clickText(p, "Month", "nav button"); await wait(200);
  ok(`${w}px: no sideways scroll on Month`, await noOverflow(p));
  await clickText(p, "People", "nav button"); await wait(200);
  ok(`${w}px: no sideways scroll on People`, await noOverflow(p));
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
