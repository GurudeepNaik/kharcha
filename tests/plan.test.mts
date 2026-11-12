import assert from "node:assert";
const P = (await import("../lib/plan.ts")) as typeof import("../lib/plan");
type Expense = import("../lib/types").Expense;
type Item = import("../lib/plan").PlanItem;
const at = "2026-01-01T00:00:00.000Z";
let n = 0;
const item = (o: Partial<Item>): Item => ({
  id: `iiiiiiii-0000-4000-8000-${String(++n).padStart(12, "0")}`, name: "x", kind: "bill", category: "bills", amountPaise: 1000_00, day: 5, every: 1,
  startMonth: "2026-01", autoPay: false, handledThrough: null, skips: [], accountId: null, loan: null, createdAt: at, updatedAt: at, ...o,
});
const pay = (it: Item, date: string, rs: number, extra: Partial<Expense> = {}): Expense =>
  ({ id: `eeeeeeee-0000-4000-8000-${String(++n).padStart(12, "0")}`, amountPaise: Math.round(rs * 100), note: it.name, category: it.category, method: null, date, createdAt: `${date}T09:00:00.000Z`, updatedAt: `${date}T09:00:00.000Z`, planId: it.id, ...extra });
const NOW = "2026-11-12";

// ---------- Status each month ----------
{
  const wifi = item({ name: "Wi-Fi", amountPaise: 799_00, day: 10 });
  const sip = item({ name: "SIP", kind: "invest", category: "sip", day: 20, skips: ["2026-10"] });
  const term = item({ name: "Term insurance", kind: "insurance", category: "termIns", every: 12, startMonth: "2026-03", day: 15 });
  const rows = [pay(wifi, "2026-11-08", 799)];
  assert.equal(P.statusOf(wifi, rows, "2026-11", NOW), "paid");
  assert.equal(P.statusOf(wifi, rows, "2026-10", NOW), "overdue", "October's Wi-Fi was never paid");
  assert.equal(P.statusOf(sip, rows, "2026-10", NOW), "skipped");
  assert.equal(P.statusOf(sip, rows, "2026-11", NOW), "due", "due on the 20th, today is the 12th");
  assert.equal(P.statusOf(term, rows, "2026-11", NOW), "notDue", "yearly: only in March");
  assert.equal(P.statusOf(term, rows, "2027-03", NOW), "due");
  assert.equal(P.statusOf(wifi, rows, "2025-12", NOW), "notDue", "before it started");
  // Totals: salary in, Wi-Fi paid, SIP due, term not due.
  const salary = item({ name: "Salary", kind: "income", category: "salary", amountPaise: 85000_00, day: 1 });
  const t = P.monthTotals([wifi, sip, term, salary], [...rows, pay(salary, "2026-11-01", 85000)], "2026-11", NOW);
  assert.deepEqual([t.toPay / 100, t.paid / 100, t.left / 100, t.expectedIn / 100, t.received / 100, t.count, t.done], [1799, 799, 1000, 85000, 85000, 2, 1]);
  // Paying more than expected counts what was paid.
  const t2 = P.monthTotals([wifi], [pay(wifi, "2026-11-08", 900)], "2026-11", NOW);
  assert.equal(t2.toPay / 100, 900);
}
console.log("STATUS + TOTALS OK");

// ---------- EMI loan ----------
{
  // ₹1,00,000 at 12% a year (1% a month), EMI ₹10,000, since 1 Jan, due on the 5th.
  const loan = item({ name: "Personal loan", kind: "loan", category: "rent", amountPaise: 10000_00, day: 5, loan: { principalPaise: 100000_00, ratePct: 12, since: "2026-01-01", endBy: null } });
  const s0 = P.loanState(loan, [], "2026-01-31")!;
  assert.deepEqual([s0.principalPaise / 100, s0.monthlyInterestPaise / 100], [100000, 1000], "before the first due day: no interest yet");
  // Feb 5: +₹1,000 interest; paid ₹10,000 → ₹91,000. Mar 5: +₹910; paid ₹10,000 → ₹81,910.
  const rows = [pay(loan, "2026-02-05", 10000), pay(loan, "2026-03-05", 10000)];
  assert.equal(P.loanState(loan, rows, "2026-03-31")!.principalPaise / 100, 81910);
  // April skipped: interest still added (₹819.10 → ₹82,729.10).
  assert.equal(P.loanState(loan, rows, "2026-04-30")!.principalPaise / 100, 82729.1);
  // Paying more (₹20,000) in May brings it down faster: 82,729.10 + 827.29 − 20,000.
  const more = [...rows, pay(loan, "2026-05-05", 20000)];
  const s = P.loanState(loan, more, "2026-05-31")!;
  assert.equal(s.principalPaise / 100, 63556.39);
  assert.ok(s.projection && s.projection.months === 7 && s.projection.endMonth === "2026-12", `projection ${JSON.stringify(s.projection)}`);
  assert.equal(s.paidPaise / 100, 40000);
  // An EMI below the interest never ends.
  const tiny = { ...loan, amountPaise: 500_00 };
  assert.equal(P.loanState(tiny, [], "2026-01-31")!.projection, null);
  // Pay-more tip: about 10% of EMI rounded to ₹500 → ₹1,000 more.
  const tip = P.payMoreTip(loan, [], "2026-01-31")!;
  assert.equal(tip.extraPaise / 100, 1000);
  assert.ok(tip.monthsSooner >= 1 && tip.interestSaved > 0, JSON.stringify(tip));
}
console.log("EMI LOAN OK");

// ---------- Gold loan ----------
{
  // ₹1,00,000 at 9% a year, simple interest per day, since 1 Jan 2026.
  const gold = item({ name: "Gold loan", kind: "goldloan", category: "rent", amountPaise: null, loan: { principalPaise: 100000_00, ratePct: 9, since: "2026-01-01", endBy: "2026-12-31" } });
  // 31 Jan: 30 days × ₹1,00,000 × 9% / 365 = ₹739.73.
  const s1 = P.loanState(gold, [], "2026-01-31")!;
  assert.deepEqual([s1.principalPaise / 100, s1.interestPaise / 100, s1.totalPaise / 100], [100000, 739.73, 100739.73]);
  // Pay ₹5,000 on 31 Jan: ₹739.73 interest first, ₹4,260.27 off the loan.
  const rows = [pay(gold, "2026-01-31", 5000)];
  const s2 = P.loanState(gold, rows, "2026-01-31")!;
  assert.deepEqual([s2.principalPaise / 100, s2.interestPaise / 100], [95739.73, 0]);
  // Skip Feb and March: interest just builds up (59 days to 31 Mar).
  const s3 = P.loanState(gold, rows, "2026-03-31")!;
  assert.equal(s3.interestPaise / 100, Math.round(9573973 * 0.09 * 59 / 365) / 100);
  assert.equal(P.statusOf(gold, rows, "2026-02", "2026-03-31"), "due", "gold loan: never overdue");
  assert.equal(P.suggestedAmount(gold, rows, "2026-03-31"), Math.ceil(s3.interestPaise / 100) * 100, "suggests paying the interest due, in whole rupees");
  const fuel = item({ name: "Bike petrol", category: "travel", amountPaise: null, day: 1 });
  assert.equal(P.statusOf(fuel, [], "2026-11", NOW), "due", "petrol: never overdue");
}
console.log("GOLD LOAN OK");

// ---------- Auto-pay ----------
{
  const netflix = item({ name: "Netflix", amountPaise: 649_00, day: 3, autoPay: true, startMonth: "2026-09" });
  const r1 = P.duePayments([netflix], [], NOW, at);
  assert.deepEqual(r1.entries.map(e => [e.date, e.amountPaise / 100, e.planId === netflix.id, e.id]), [
    ["2026-09-03", 649, true, P.autoEntryId(netflix.id, "2026-09")], ["2026-10-03", 649, true, P.autoEntryId(netflix.id, "2026-10")], ["2026-11-03", 649, true, P.autoEntryId(netflix.id, "2026-11")]]);
  assert.equal(r1.items[0]!.handledThrough, "2026-11");
  assert.equal(P.duePayments(r1.items, [], NOW, at).entries.length, 0, "a deleted auto entry doesn't come back");
  assert.equal(P.duePayments([{ ...netflix, skips: ["2026-10"] }], [], NOW, at).entries.length, 2, "skipped month not added");
  assert.equal(P.duePayments([netflix], [pay(netflix, "2026-10-01", 649)], NOW, at).entries.length, 2, "paid by hand: not added again");
  assert.equal(P.duePayments([{ ...netflix, day: 20 }], [], NOW, at).entries.length, 2, "November's day hasn't come");
}
console.log("AUTO-PAY OK");

// ---------- Smart help ----------
{
  const netflix = item({ name: "Netflix", amountPaise: 649_00 });
  const elec = item({ name: "Electricity", amountPaise: null, day: 10 });
  const bike = item({ name: "Bike petrol", category: "travel", amountPaise: null });
  const car = item({ name: "Car petrol", category: "travel", amountPaise: null });
  const sal = item({ name: "Salary", kind: "income", category: "salary", amountPaise: 85000_00 });
  const items = [netflix, elec, bike, car, sal];
  const e = (note: string, category = "bills", date = NOW) => ({ note, category: category as Expense["category"], date, amountPaise: 100 });
  assert.equal(P.matchItem(e("netflix"), items, [])?.id, netflix.id);
  assert.equal(P.matchItem(e("bescom bill"), items, [])?.id, elec.id, "BESCOM is the electricity bill");
  assert.equal(P.matchItem(e("bike petrol", "travel"), items, [])?.id, bike.id);
  assert.equal(P.matchItem(e("petrol", "travel"), items, []), null, "bike or car? don't guess");
  assert.equal(P.matchItem(e("salary", "salary"), items, [])?.id, sal.id);
  assert.equal(P.matchItem(e("salary"), items, []), null, "a spend never matches money in");
  assert.equal(P.matchItem(e("netflix"), items, [pay(netflix, "2026-11-03", 649)]), null, "fixed amount already paid this month");
  assert.equal(P.matchItem(e("electricity"), items, [pay(elec, "2026-11-03", 900)])?.id, elec.id, "varying amounts can be paid twice");
  assert.equal(P.matchItem(e("chai"), items, []), null);

  const mk = (note: string, date: string, rs: number, category = "bills"): Expense => ({ id: `x-${++n}-aaaaaaaa`, amountPaise: rs * 100, note, category: category as Expense["category"], method: null, date, createdAt: at, updatedAt: at });
  const rows = [mk("wifi act", "2026-09-07", 799), mk("wifi act", "2026-10-07", 799), mk("chai", "2026-09-02", 20), mk("chai", "2026-10-02", 60), mk("gym", "2026-10-01", 1500), mk("netflix", "2026-09-03", 649), mk("netflix", "2026-10-03", 649)];
  const got = P.looksMonthly(rows, items, NOW);
  assert.deepEqual(got.map(x => [x.name, x.amountPaise / 100, x.months, x.day]), [["Wifi act", 799, ["2026-09", "2026-10"], 7]], "Wi-Fi yes; chai varies too much; gym once; Netflix already in Payments");
}
console.log("SMART HELP OK");

// ---------- Old repeats move over ----------
{
  const r = { id: "rrrrrrrr-0000-4000-8000-000000000001", amountPaise: 199_00, note: "netflix", category: "bills" as const, method: null, day: 5, lastMonth: "2026-11", createdAt: at };
  const it = P.fromRepeat(r, at);
  assert.deepEqual([it.id, it.name, it.autoPay, it.handledThrough, it.every, it.kind], [r.id, "netflix", true, "2026-11", 1, "bill"]);
  const old = pay(it, "2026-10-05", 199, { planId: undefined, repeatId: r.id });
  assert.equal(P.paidIn(it, [old], "2026-10").length, 1, "entries made by the old repeat still count");
}
console.log("MIGRATION OK");
