import "fake-indexeddb/auto";
import assert from "node:assert";
const SH = (await import("../lib/share.ts")) as typeof import("../lib/share");
const D = (await import("../lib/debts.ts")) as typeof import("../lib/debts");
const TR = (await import("../lib/trends.ts")) as typeof import("../lib/trends");
const SE = (await import("../lib/search.ts")) as typeof import("../lib/search");
const B = (await import("../lib/backup.ts")) as typeof import("../lib/backup");
const S = (await import("../lib/store.ts")) as typeof import("../lib/store");
type Expense = import("../lib/types").Expense;
const NOW = "2026-11-12";

// ---------- Shared payments ----------
// Sample wording only: real app texts vary and change; anything unreadable must give null, never a guess.
const SHARE: [string, string | null][] = [
  ["₹500 paid to Ravi Kumar on 12 Nov via Google Pay. UPI transaction ID 1234", "Ravi Kumar 500 upi"],
  ["Paid ₹1,250.50 to ASHA STORES successfully", "Asha Stores 1250.50 upi"],
  ["Payment of Rs. 99 to Swiggy is successful", "Swiggy 99 upi"],
  ["You received ₹2,000 from Suresh", "+2000 from Suresh"],
  ["Rs 300 credited to your account", "+300"],
  ["Sent INR 75 to Raju", "Raju 75 upi"],
  ["Check out this cool app https://example.com", null],
  ["Paid ₹0 to Ravi", null],
  ["", null],
];
for (const [t, want] of SHARE) assert.equal(SH.sharedToLine("", t, ""), want, `share: "${t}"`);
console.log(`SHARE OK (${SHARE.length})`);

// ---------- Lent / borrowed ----------
const DEBTS: [string, string, "gave" | "got", number, string?][] = [
  ["lent ravi 500", "Ravi", "gave", 50000],
  ["lent 500 to ravi kumar", "Ravi Kumar", "gave", 50000],
  ["gave 500 to asha", "Asha", "gave", 50000],
  ["gave ravi 200", "Ravi", "gave", 20000],
  ["borrowed 1000 from suresh", "Suresh", "got", 100000],
  ["took 300 from amma", "Amma", "got", 30000],
  ["ravi returned 500", "Ravi", "got", 50000],
  ["ravi paid back 200 yesterday", "Ravi", "got", 20000, "2026-11-11"],
  ["got back 100 from asha", "Asha", "got", 10000],
  ["returned 1000 to suresh", "Suresh", "gave", 100000],
  ["repaid suresh 500", "Suresh", "gave", 50000],
  ["udhaar raju 150", "Raju", "gave", 15000],
];
for (const [t, person, dir, paise, date = NOW] of DEBTS) {
  const r = D.parseDebt(t, NOW);
  assert.ok(r && r.ok, `debt "${t}"`);
  assert.deepEqual(r.value, { person, dir, amountPaise: paise, date }, `debt "${t}"`);
}
for (const t of ["chai 20", "gave tip 50", "gave milk money 40", "salary 50000", "auto 80 upi"]) assert.equal(D.parseDebt(t, NOW), null, `not a debt: "${t}"`);
assert.equal((D.parseDebt("lent ravi", NOW) as { code: string }).code, "debtNoAmount");
assert.equal((D.parseDebt("lent 500", NOW) as { code: string }).code, "debtNoPerson");
const dk = (person: string, dir: "gave" | "got", rs: number, date: string, i: number): import("../lib/debts").Debt =>
  ({ id: `dddddddd-0000-4000-8000-${String(i).padStart(12, "0")}`, person, dir, amountPaise: rs * 100, note: "", date, createdAt: `${date}T10:00:00.000Z`, updatedAt: `${date}T10:00:00.000Z` });
const ds = [dk("Ravi", "gave", 500, "2026-11-01", 1), dk("ravi", "got", 200, "2026-11-05", 2), dk("Asha", "got", 1000, "2026-11-03", 3), dk("Raju", "gave", 100, "2026-10-01", 4), dk("Raju", "got", 100, "2026-10-02", 5)];
const bs = D.balances(ds);
assert.deepEqual(bs.map(b => [b.name, b.paise]), [["ravi", 30000], ["Asha", -100000], ["Raju", 0]], "Ravi owes 300, you owe Asha 1000, Raju settled (last)");
assert.equal(D.owedToYou(bs), 30000); assert.equal(D.youOwe(bs), 100000);
console.log(`DEBTS OK (${DEBTS.length} read, 5 left as spends)`);

// ---------- Trends ----------
const e = (date: string, rs: number, category = "food", i = 0): Expense => ({ id: `eeeeeeee-0000-4000-8000-${String(i).padStart(12, "0")}`, amountPaise: rs * 100, note: "", category: category as Expense["category"], method: null, date, createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z" });
const tr = [e("2026-11-01", 100, "food", 1), e("2026-11-01", 50, "food", 2), e("2026-11-12", 20, "food", 3), e("2026-11-05", 50000, "salary", 4), e("2026-10-03", 70, "food", 5), e("2026-10-20", 400, "food", 6), e("2026-06-10", 10, "food", 7)];
const daily = TR.dailySpend(tr, "2026-11", NOW);
assert.equal(daily.length, 12, "only up to today");
assert.deepEqual([daily[0], daily[4], daily[11]], [15000, 0, 2000], "salary isn't spending");
assert.equal(TR.dailySpend(tr, "2026-10", NOW).length, 31);
assert.deepEqual(TR.monthTotals(tr, "2026-11", 6).map(m => [m.month, m.paise]), [["2026-06", 1000], ["2026-07", 0], ["2026-08", 0], ["2026-09", 0], ["2026-10", 47000], ["2026-11", 17000]]);
assert.deepEqual(TR.vsLastMonth(tr, "2026-11", NOW), { now: 17000, then: 7000 }, "Oct up to the 12th = 70 only");
assert.equal(TR.vsLastMonth(tr, "2026-09", NOW), null, "nothing in August to compare with");
assert.deepEqual(TR.vsLastMonth([e("2026-02-28", 5, "food", 1), e("2026-03-31", 9, "food", 2)], "2026-03", "2026-03-31"), { now: 900, then: 500 }, "31 Mar vs all of Feb");
console.log("TRENDS OK");

// ---------- Search ----------
const sr: Expense[] = [
  { ...e("2026-11-01", 450, "food", 1), note: "swiggy dinner", method: "upi" },
  { ...e("2026-11-02", 80, "travel", 2), note: "auto", method: "cash" },
  { ...e("2026-10-02", 450, "shopping", 3), note: "shirt", method: null },
  { ...e("2026-11-05", 50000, "salary", 4), note: "salary", method: null },
];
const ids = (f: Partial<import("../lib/search").Filter>) => SE.filterRows(sr, { ...SE.EMPTY_FILTER, ...f }).map(x => x.note);
assert.deepEqual(ids({ q: "Swiggy" }), ["swiggy dinner"]);
assert.deepEqual(ids({ q: "₹450" }), ["swiggy dinner", "shirt"], "amount search");
assert.deepEqual(ids({ q: "food" }), ["swiggy dinner"], "category name search");
assert.deepEqual(ids({ method: "upi" }), ["swiggy dinner"]);
assert.deepEqual(ids({ method: "none" }), ["shirt", "salary"]);
assert.deepEqual(ids({ kind: "in" }), ["salary"]);
assert.deepEqual(ids({ kind: "out", month: "2026-11" }), ["swiggy dinner", "auto"]);
assert.deepEqual(ids({ category: "shopping" }), ["shirt"]);
assert.deepEqual(ids({ q: "zzz" }), []);
assert.equal(SE.isFiltering(SE.EMPTY_FILTER), false);
console.log("SEARCH OK");

// ---------- Backup v3: lending + budgets round trip; older files still restore ----------
await S.putDebt(ds[0]!); await S.putDebt(ds[2]!);
await S.saveSettings({ categoryLimits: { food: 600000 } });
const bk = B.readBackup(JSON.stringify(B.makeBackup([], new Map(), await S.getSettings(), [], await S.allDebts())));
assert.ok(bk.ok && bk.value.debts.length === 2 && bk.value.settings.categoryLimits.food === 600000);
await S._wipe();
await S.applyRestore([], [], [], bk.value.debts);
assert.equal((await S.allDebts()).length, 2);
const bad = (d: object) => B.readBackup(JSON.stringify({ kind: "expense-tracker-backup", version: 3, expenses: [], learned: [], debts: [{ ...ds[0]!, ...d }] })).ok;
assert.equal(bad({ dir: "stole" }), false); assert.equal(bad({ person: "" }), false); assert.equal(bad({ amountPaise: 1.5 }), false);
const v2 = B.readBackup(JSON.stringify({ kind: "expense-tracker-backup", version: 2, expenses: [], learned: [], repeats: [], settings: { monthlyLimitPaise: 100 } }));
assert.ok(v2.ok && v2.value.debts.length === 0 && Object.keys(v2.value.settings.categoryLimits).length === 0, "version 2 file reads");
assert.equal(B.readBackup(JSON.stringify({ kind: "expense-tracker-backup", version: 3, expenses: [], learned: [], settings: { categoryLimits: { salary: 100, food: -1, junk: 5 } } })).ok && true, true);
const csv = B.toCsv([], [ds[0]!]);
assert.ok(csv.includes("2026-11-01,Gave (lent or repaid),500,People,Ravi,"));
console.log("BACKUP V3 OK");
