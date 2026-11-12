// End to end: receipt images shared into the app the way Android does it (POST /share-target with the image),
// read on the "phone" by the bundled text reader, and turned into a line in the add box.
// The receipts are generated here in typical UPI-receipt layouts; they are not real app screenshots.
//   pnpm receipts                          # against production
//   pnpm receipts http://localhost:3200
import puppeteer from "puppeteer-core";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = (process.argv[2] ?? "https://gurudeep-expenses.vercel.app").replace(/\/$/, "");
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const results: { pass: boolean; name: string }[] = [];
const ok = (name: string, pass: unknown) => results.push({ pass: !!pass, name });

const shell = (body: string, bg = "#ffffff", fg = "#1f1f1f") => `<html><body style="margin:0;font-family:Roboto,Arial,sans-serif;background:${bg};color:${fg};width:390px;height:844px;display:flex;flex-direction:column;align-items:center;padding-top:60px;box-sizing:border-box">${body}</body></html>`;
const RECEIPTS: { name: string; html: string; want: string | null }[] = [
  { name: "paid to, big ₹ amount, UPI id below", want: "Ravi Kumar 500 upi", html: shell(`
    <div style="font-size:15px;color:#5f6368">Paid to</div><div style="font-size:22px;margin-top:6px">Ravi Kumar</div>
    <div style="font-size:14px;color:#5f6368;margin-top:4px">ravikumar@okaxis</div>
    <div style="font-size:52px;font-weight:500;margin-top:28px">₹500</div>
    <div style="font-size:15px;color:#188038;margin-top:10px">Completed</div>
    <div style="font-size:14px;color:#5f6368;margin-top:24px">12 Nov 2026, 10:42 am</div>
    <div style="font-size:13px;color:#5f6368;margin-top:40px">UPI transaction ID 431234567890</div>`) },
  { name: "success banner, store name in capitals, ₹ with paise", want: "Asha Stores 1250.50 upi", html: shell(`
    <div style="background:#5f259f;color:#fff;width:100%;padding:28px 20px;box-sizing:border-box;font-size:20px">Transaction Successful<div style="font-size:13px;margin-top:6px">12 Nov 2026 at 10:42 AM</div></div>
    <div style="width:100%;padding:24px 20px;box-sizing:border-box"><div style="font-size:14px;color:#666">Paid to</div>
    <div style="display:flex;justify-content:space-between;font-size:18px;margin-top:6px"><span>ASHA STORES</span><span>₹ 1,250.50</span></div>
    <div style="font-size:13px;color:#666;margin-top:30px">Transaction ID</div><div style="font-size:15px">T2611121042551234</div>
    <div style="font-size:13px;color:#666;margin-top:16px">Debited from</div><div style="font-size:15px">XXXXXXXX1234</div></div>`, "#f4f4f6") },
  { name: "money received", want: "+2000 from Suresh M", html: shell(`
    <div style="font-size:15px;color:#5f6368">Received from</div><div style="font-size:22px;margin-top:6px">Suresh M</div>
    <div style="font-size:52px;font-weight:500;margin-top:28px">₹2,000</div>
    <div style="font-size:15px;color:#188038;margin-top:10px">Credited to your account</div>`) },
  { name: "dark theme receipt", want: "Swiggy 99 upi", html: shell(`
    <div style="font-size:52px;font-weight:500">₹99</div>
    <div style="font-size:18px;margin-top:14px">Paid to Swiggy</div>
    <div style="font-size:14px;color:#9aa0a6;margin-top:8px">swiggy.stores@icici</div>
    <div style="font-size:14px;color:#81c995;margin-top:16px">Payment successful</div>`, "#202124", "#e8eaed") },
  { name: "Rs. written out", want: "Raju 75.00 upi", html: shell(`
    <div style="font-size:24px">Rs. 75.00</div><div style="font-size:18px;margin-top:10px">Sent to</div><div style="font-size:20px">Raju</div>`) },
  { name: "no amount anywhere (not a receipt)", want: null, html: shell(`<div style="font-size:24px">Happy Diwali!</div><div style="font-size:18px;margin-top:10px">From all of us</div>`) },
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const dir = mkdtempSync(join(tmpdir(), "receipts-"));

// 1. Draw each receipt as a phone screenshot (3× pixels, like most phones).
const draw = await browser.newPage();
await draw.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });
for (const [i, r] of RECEIPTS.entries()) {
  await draw.setContent(r.html, { waitUntil: "load" });
  writeFileSync(join(dir, `r${i}.png`), await draw.screenshot({ type: "png" }));
}
await draw.close();

// 2. The installed app: a normal profile with the service worker running and controlling the page.
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await page.evaluateOnNewDocument("globalThis.__name = f => f");
page.on("pageerror", e => ok(`no page errors (${(e as Error).message.slice(0, 80)})`, false));
await page.goto(BASE, { waitUntil: "networkidle2" });
await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
await page.reload({ waitUntil: "networkidle2" });
ok("service worker controls the page", await page.evaluate(() => !!navigator.serviceWorker.controller));

for (const [i, r] of RECEIPTS.entries()) {
  // Android sends the share as a form POST to /share-target; do exactly that.
  await page.evaluate(() => {
    const f = document.createElement("form");
    f.method = "post"; f.action = "/share-target"; f.enctype = "multipart/form-data"; f.id = "share-form";
    const inp = document.createElement("input"); inp.type = "file"; inp.name = "receipt"; f.append(inp);
    document.body.append(f);
  });
  await (await page.$("#share-form input"))!.uploadFile(join(dir, `r${i}.png`));
  const t0 = Date.now();
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }), page.evaluate(() => (document.querySelector("#share-form") as HTMLFormElement).submit())]);
  await page.waitForSelector("[data-testid=receipt-status]", { timeout: 15000 }).catch(() => undefined);
  await page.waitForFunction(() => !/Reading/.test(document.querySelector("[data-testid=receipt-status]")?.textContent ?? "Reading"), { timeout: 90000 }).catch(() => undefined);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const got = await page.$eval("#entry", e => (e as HTMLInputElement).value).catch(() => "(no box)");
  const status = await page.$eval("[data-testid=receipt-status]", e => e.textContent).catch(() => "(no status)");
  ok(`${r.name}: ${r.want === null ? "nothing filled, asks to type" : `box shows "${r.want}"`} (got "${got}", ${secs}s)`,
    r.want === null ? got === "" && /Couldn't read/.test(status ?? "") : got === r.want);
}
ok("address bar is clean after a share", await page.evaluate(() => location.search === ""));

// 3. Offline: a second receipt read with no internet (the reader was kept after the first use).
await page.setOfflineMode(true);
await page.evaluate(() => {
  const f = document.createElement("form");
  f.method = "post"; f.action = "/share-target"; f.enctype = "multipart/form-data"; f.id = "share-form2";
  const inp = document.createElement("input"); inp.type = "file"; inp.name = "receipt"; f.append(inp);
  document.body.append(f);
});
await (await page.$("#share-form2 input"))!.uploadFile(join(dir, "r0.png"));
await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => undefined), page.evaluate(() => (document.querySelector("#share-form2") as HTMLFormElement).submit())]);
await page.waitForFunction(() => !/Reading/.test(document.querySelector("[data-testid=receipt-status]")?.textContent ?? "Reading"), { timeout: 90000 }).catch(() => undefined);
ok("reads a receipt with no internet", (await page.$eval("#entry", e => (e as HTMLInputElement).value).catch(() => "")) === "Ravi Kumar 500 upi");
await page.setOfflineMode(false);

await browser.close();
const failed = results.filter(r => !r.pass);
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"} ${r.name}`);
console.log(`\n${results.length - failed.length} of ${results.length} passed against ${BASE}`);
process.exit(failed.length ? 1 : 0);
