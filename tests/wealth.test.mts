import "fake-indexeddb/auto";
import assert from "node:assert";
import { readFileSync } from "node:fs";
const ST = (await import("../lib/statement.ts")) as typeof import("../lib/statement");
const W = (await import("../lib/wealth.ts")) as typeof import("../lib/wealth");
const IN = (await import("../lib/insights.ts")) as typeof import("../lib/insights");
const Y = (await import("../lib/year.ts")) as typeof import("../lib/year");
const B = (await import("../lib/backup.ts")) as typeof import("../lib/backup");
const S = (await import("../lib/store.ts")) as typeof import("../lib/store");
type Expense = import("../lib/types").Expense;
const file = (n: string) => readFileSync(new URL(`./statements/${n}`, import.meta.url), "utf8");
let n = 0;
const e = (date: string, rs: number, category: string, note = "", extra: Partial<Expense> = {}): Expense =>
  ({ id: `eeeeeeee-0000-4000-8000-${String(++n).padStart(12, "0")}`, amountPaise: Math.round(rs * 100), note, category: category as Expense["category"], method: null, date, createdAt: `${date}T10:00:00.000Z`, updatedAt: `${date}T10:00:00.000Z`, ...extra });

// ---------- Statement import: every row of every sample checked ----------
type Want = [date: string, rs: number, dir: "out" | "in", note: string];
const CASES: [string, Want[], number][] = [
  ["debit-credit.csv", [
    ["2026-11-01", 85000, "in", "salary"], ["2026-11-02", 450, "out", "Swiggy"], ["2026-11-03", 1200, "out", "Ravi Kumar"],
    ["2026-11-05", 5000, "out", "ATM cash"], ["2026-11-07", 12340, "out", "Billpay"], ["2026-11-08", 499, "in", "Asha Stores"],
    ["2026-11-10", 2340.5, "out", "Big Bazaar"]], 0],
  ["tab-debit-credit.txt", [
    ["2026-11-01", 320, "out", "Zepto"], ["2026-11-02", 60000, "in", "salary"], ["2026-11-03", 2000, "out", "ATM cash"], ["2026-11-04", 1850, "out", "Bescom"]], 0],
  ["amount-drcr.csv", [
    ["2026-11-12", 85, "out", "Rapido"], ["2026-11-12", 2000, "in", "Suresh M"], ["2026-11-13", 5000, "out", "Zerodha Broking"], ["2026-11-13", 312, "in", "interest"]], 0],
  ["signed-amount.csv", [["2026-11-14", 999, "out", "Amazon India"], ["2026-11-15", 999, "in", "Refund Amazon"]], 1], // "Opening balance" (no amount) is skipped
];
for (const [name, want, skipped] of CASES) {
  const r = ST.readStatement(file(name));
  assert.ok(r.ok, `${name} reads`);
  assert.deepEqual(r.rows.map(x => [x.date, x.amountPaise / 100, x.dir, x.note]), want, name);
  assert.equal(r.skipped, skipped, `${name} skipped rows`);
}
assert.deepEqual(ST.readStatement("hello,world\n1,2"), { ok: false, code: "noHeader" });
assert.deepEqual(ST.readStatement("Date,Amount\nnot a date,5"), { ok: false, code: "noRows" });
for (const [s, want] of [["12/11/2026", "2026-11-12"], ["12-11-26", "2026-11-12"], ["12.11.2026", "2026-11-12"], ["2026-11-12", "2026-11-12"], ["12-Nov-2026", "2026-11-12"], ["12 November 2026", "2026-11-12"], ["12/11/2026 10:42", "2026-11-12"], ["31/02/2026", null], ["11/2026", null]] as const)
  assert.equal(ST.readDate(s), want, `date "${s}"`);
assert.deepEqual(ST.readAmount("₹ 1,234.50 Dr"), { paise: 123450, dir: "out" }); assert.deepEqual(ST.readAmount("-500"), { paise: 50000, dir: "out" }); assert.equal(ST.readAmount("abc"), null);

// What gets ticked: duplicates of entries already noted, ATM cash and card bills are left unticked.
{
  const r = ST.readStatement(file("debit-credit.csv"));
  if (!r.ok) throw new Error("read");
  const existing = [e("2026-11-03", 450, "food", "swiggy dinner"), e("2026-11-10", 2340.5, "groceries", "groceries")];
  const plan = ST.planImport(r.rows, existing, new Map());
  assert.deepEqual(plan.map(p => [p.row.note, p.category, p.include, p.reason]), [
    ["salary", "salary", true, null],
    ["Swiggy", "food", false, "duplicate"],          // ₹450 on 2 Nov vs 'swiggy dinner' ₹450 on 3 Nov
    ["Ravi Kumar", "other", true, null],
    ["ATM cash", "other", false, "atm"],
    ["Billpay", "bills", false, "card"],              // "HDFCCC": an HDFC credit-card bill payment
    ["Asha Stores", "refund", true, null],
    ["Big Bazaar", "other", false, "duplicate"],
  ]);
  const cc = ST.planImport([{ date: "2026-11-07", amountPaise: 1234000, dir: "out", narration: "CREDIT CARD PAYMENT HDFC", note: "Hdfc", method: null }], [], new Map());
  assert.equal(cc[0]!.reason, "card");
}
console.log(`STATEMENTS OK (${CASES.reduce((s, c) => s + c[1].length, 0)} rows in ${CASES.length} layouts)`);

// ---------- Accounts and net worth ----------
{
  const at = "2026-11-01T00:00:00.000Z";
  const bank: import("../lib/wealth").Account = { id: "aaaaaaaa-0000-4000-8000-000000000001", name: "HDFC", type: "bank", openingPaise: 50000_00, openingDate: "2026-11-01", createdAt: at, updatedAt: at };
  const cash: import("../lib/wealth").Account = { ...bank, id: "aaaaaaaa-0000-4000-8000-000000000002", name: "Cash", type: "cash", openingPaise: 2000_00 };
  const card: import("../lib/wealth").Account = { ...bank, id: "aaaaaaaa-0000-4000-8000-000000000003", name: "Card", type: "card", openingPaise: -3000_00 };
  const rows = [
    e("2026-11-02", 85000, "salary", "salary", { accountId: bank.id }),
    e("2026-11-03", 450, "food", "swiggy", { accountId: bank.id }),
    e("2026-11-04", 5000, "sip", "sip", { accountId: bank.id }),
    e("2026-11-05", 40, "food", "chai", { accountId: cash.id }),
    e("2026-11-06", 2000, "shopping", "shoes", { accountId: card.id }),
    e("2026-10-31", 999, "food", "before opening", { accountId: bank.id }), // before the opening date: not counted
  ];
  const transfers = [
    { id: "tttttttt-0000-4000-8000-000000000001", from: bank.id, to: cash.id, amountPaise: 3000_00, date: "2026-11-05", note: "ATM", createdAt: at, updatedAt: at },
    { id: "tttttttt-0000-4000-8000-000000000002", from: bank.id, to: card.id, amountPaise: 3000_00, date: "2026-11-07", note: "card bill", createdAt: at, updatedAt: at },
  ];
  assert.equal(W.balanceOf(bank, rows, transfers) / 100, 50000 + 85000 - 450 - 5000 - 3000 - 3000);
  assert.equal(W.balanceOf(cash, rows, transfers) / 100, 2000 - 40 + 3000);
  assert.equal(W.balanceOf(card, rows, transfers) / 100, -3000 - 2000 + 3000, "card: owed ₹2,000");
  assert.equal(W.cardThisMonth(card, rows, "2026-11-12") / 100, 2000);
  const holdings = [
    { id: "hhhhhhhh-0000-4000-8000-000000000001", name: "PPF", kind: "ppf" as const, valuePaise: 200000_00, createdAt: at, updatedAt: at },
    { id: "hhhhhhhh-0000-4000-8000-000000000002", name: "Bike loan", kind: "loan" as const, valuePaise: 40000_00, createdAt: at, updatedAt: at },
  ];
  const nw = W.netWorth([bank, cash, card], rows, transfers, holdings);
  assert.deepEqual([nw.accounts / 100, nw.owned / 100, nw.owed / 100, nw.total / 100], [123550 + 4960 - 2000, 200000, 40000, 126510 + 200000 - 40000]);

  // Goals: ₹80,000 by June 2027, ₹20,000 saved on 12 Nov 2026 → 8 months (Nov..Jun) → ₹7,500 a month.
  const g = { id: "gggggggg-0000-4000-8000-000000000001", name: "Bike", targetPaise: 80000_00, byMonth: "2027-06", added: [{ date: "2026-11-01", paise: 20000_00 }], createdAt: at, updatedAt: at };
  const gp = W.goalProgress(g, "2026-11-12");
  assert.deepEqual([gp.saved / 100, gp.left / 100, gp.months, gp.perMonth! / 100, gp.done, gp.share], [20000, 60000, 8, 7500, false, 0.25]);
  assert.deepEqual(W.goalProgress({ ...g, byMonth: null }, "2026-11-12").perMonth, null);
  assert.equal(W.goalProgress({ ...g, added: [{ date: "2026-11-01", paise: 90000_00 }] }, "2026-11-12").done, true);
  assert.equal(W.goalProgress({ ...g, byMonth: "2026-10" }, "2026-11-12").perMonth! / 100, 60000, "past the date: the rest is due now");

  // Backup v4 round trip through the store, and bad records rejected.
  await S.put("accounts", bank); await S.put("goals", g); await S.put("holdings", holdings[0]!); await S.put("transfers", transfers[0]!);
  const bk = B.makeBackup(rows, new Map(), { ...(await S.getSettings()), upiAccount: bank.id }, [], [], {
    accounts: await S.all("accounts"), goals: await S.all("goals"), holdings: await S.all("holdings"), transfers: await S.all("transfers"),
    photos: [{ id: rows[0]!.id, type: "image/jpeg", data: Buffer.from("fake").toString("base64") }],
  });
  const rd = B.readBackup(JSON.stringify(bk));
  assert.ok(rd.ok && rd.value.accounts.length === 1 && rd.value.goals[0]!.added.length === 1 && rd.value.holdings.length === 1 && rd.value.transfers.length === 1 && rd.value.photos.length === 1 && rd.value.settings.upiAccount === bank.id);
  assert.ok(rd.ok && rd.value.expenses.every(x => x.accountId));
  await S._wipe();
  await S.applyRestore(rd.ok ? rd.value.expenses : [], [], [], [], { accounts: rd.ok ? rd.value.accounts : [], goals: rd.ok ? rd.value.goals : [] });
  assert.equal((await S.all("accounts")).length, 1); assert.equal((await S.all("goals")).length, 1);
  const bad = (k: string, v: unknown) => B.readBackup(JSON.stringify({ ...bk, [k]: v })).ok;
  assert.equal(bad("accounts", [{ ...bank, type: "wallet" }]), false);
  assert.equal(bad("transfers", [{ ...transfers[0], to: transfers[0]!.from }]), false, "transfer to itself");
  assert.equal(bad("holdings", [{ ...holdings[0], kind: "nft" }]), false);
  assert.equal(bad("goals", [{ ...g, byMonth: "2027-13" }]), false);
  assert.equal(bad("photos", [{ id: rows[0]!.id, type: "text/html", data: "PHNjcmlwdD4=" }]), false, "only images");
  const v3 = B.readBackup(JSON.stringify({ kind: "expense-tracker-backup", version: 3, expenses: [], learned: [], debts: [], repeats: [] }));
  assert.ok(v3.ok && v3.value.accounts.length === 0 && v3.value.photos.length === 0, "version 3 file reads");
}
console.log("ACCOUNTS + NET WORTH + GOALS OK");

// ---------- Smart notes ----------
{
  const rows = [
    e("2026-10-02", 1000, "food", "swiggy"), e("2026-10-05", 300, "travel", "auto"),
    e("2026-11-01", 900, "food", "swiggy"), e("2026-11-03", 800, "food", "swiggy dinner"), e("2026-11-06", 500, "food", "Swiggy"),
    e("2026-11-02", 3000, "shopping", "shoes"), e("2026-11-10", 100, "travel", "auto"), e("2026-11-11", 50000, "salary", "salary"),
    e("2026-11-20", 999, "food", "after today"),
  ];
  const rp = [{ id: "r1", amountPaise: 199_00, note: "netflix", category: "bills" as const, method: null, day: 5, lastMonth: "2026-11", createdAt: "x" },
    { id: "r2", amountPaise: 5000_00, note: "sip", category: "sip" as const, method: null, day: 5, lastMonth: "2026-11", createdAt: "x" },
    { id: "r3", amountPaise: 50000_00, note: "salary", category: "salary" as const, method: null, day: 1, lastMonth: "2026-11", createdAt: "x" }];
  const got = IN.insights(rows, "2026-11", "2026-11-12", rp, 2000_00);
  assert.deepEqual(got, [
    { kind: "catUp", category: "food", now: 2200_00, then: 1000_00, pct: 120 },
    { kind: "often", note: "swiggy", count: 3, paise: 2200_00 },
    { kind: "repeats", count: 2, paise: 5199_00 },
    { kind: "pace", projected: Math.round(5300_00 / 12 * 30 / 100) * 100, limit: 2000_00 },
    { kind: "biggest", note: "shoes", category: "shopping", paise: 3000_00, date: "2026-11-02" },
  ]);
  assert.deepEqual(IN.insights([], "2026-11", "2026-11-12", [], null), [], "nothing to say with no data");
}
console.log("SMART NOTES OK");

// ---------- Year in review ----------
{
  const rows = [
    e("2026-01-05", 1000, "food"), e("2026-01-20", 50000, "salary"), e("2026-03-01", 4000, "rent"), e("2026-03-02", 10000, "sip"),
    e("2026-06-10", 200, "travel"), e("2026-06-11", 50000, "salary"), e("2025-12-31", 99999, "food"),
  ];
  const y = Y.yearReview(rows, 2026, "2026-11-12");
  assert.deepEqual([y.count, y.moneyIn / 100, y.spent / 100, y.invested / 100, y.left / 100, y.keptPct], [6, 100000, 5200, 10000, 84800, 95]);
  assert.deepEqual(y.topCats.map(c => c.category), ["rent", "food", "travel"]);
  assert.deepEqual([y.highest?.month, y.lowest?.month], ["2026-03", "2026-06"]);
  assert.equal(y.biggest?.category, "rent");
  assert.deepEqual(y.investByCat, [{ category: "sip", paise: 10000_00 }]);
  assert.equal(y.noSpendDays, 316 - 3, "1 Jan–12 Nov is 316 days, 3 with spends");
  assert.equal(Y.yearReview(rows, 2024, "2026-11-12").count, 0);
}
console.log("YEAR IN REVIEW OK");
