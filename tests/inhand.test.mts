import assert from "node:assert";
const H = (await import("../lib/inhand.ts")) as typeof import("../lib/inhand");
type Expense = import("../lib/types").Expense;
type Debt = import("../lib/debts").Debt;
type Account = import("../lib/wealth").Account;
type Transfer = import("../lib/wealth").Transfer;
let n = 0;
const e = (date: string, rs: number, category: Expense["category"], extra: Partial<Expense> = {}, createdAt = `${date}T12:00:00.000Z`): Expense =>
  ({ id: `e-${++n}-aaaaaaaa`, amountPaise: rs * 100, note: "x", category, method: null, date, createdAt, updatedAt: createdAt, ...extra });

// Set ₹20,000 in hand on 10 Oct at 10:00. Entries made earlier that day are already in it.
const start = { paise: 20000_00, date: "2026-10-10", at: "2026-10-10T10:00:00.000Z" };
const rows = [
  e("2026-10-10", 50, "food", {}, "2026-10-10T09:00:00.000Z"), // before: already counted in the ₹20,000
  e("2026-10-09", 300, "food"), // older: ignored
  e("2026-10-10", 200, "food"), // after (12:00): −200
  e("2026-10-20", 1000, "sip"), // investment: −1,000
  e("2026-11-01", 85000, "salary"), // +85,000
  e("2026-11-05", 649, "bills"), // −649
];
const debts: Debt[] = [{ id: "d1", person: "Ravi", dir: "gave", amountPaise: 500_00, note: "", date: "2026-11-06", createdAt: "2026-11-06T09:00:00.000Z", updatedAt: "2026-11-06T09:00:00.000Z" }];
const s = H.inHandState(start, rows, debts, [], [], "2026-11-12");
// Oct: 20,000 − 200 − 1,000 = 18,800 carried. Nov: +85,000 − 649 − 500 lent.
assert.deepEqual([s.broughtIn! / 100, s.cameIn / 100, s.wentOut / 100, s.now / 100], [18800, 85000, 1149, 102651]);
const oct = H.monthInHand(start, rows, debts, [], [], "2026-10", "2026-11-12")!;
assert.deepEqual([oct.start, oct.end / 100, oct.current], [null, 18800, false], "first month: no start, ends with what carried");
const nov = H.monthInHand(start, rows, debts, [], [], "2026-11", "2026-11-12")!;
assert.deepEqual([nov.start! / 100, nov.end / 100, nov.current], [18800, 102651, true]);
assert.equal(H.monthInHand(start, rows, debts, [], [], "2026-09", "2026-11-12"), null, "before it was set");
assert.equal(H.inHandState(start, [], [], [], [], "2026-10-15").broughtIn, null, "started this month");

// Credit card: spends wait until the bill is paid from the bank.
const card: Account = { id: "card1", name: "HDFC card", type: "card", openingPaise: 0, openingDate: "2026-10-01", createdAt: "x", updatedAt: "x" };
const bank: Account = { id: "bank1", name: "SBI", type: "bank", openingPaise: 0, openingDate: "2026-10-01", createdAt: "x", updatedAt: "x" };
const cardRows = [e("2026-11-02", 3000, "shopping", { accountId: "card1" }), e("2026-11-03", 100, "food", { accountId: "bank1" })];
assert.equal(H.inHandState(start, cardRows, [], [card, bank], [], "2026-11-12").now / 100, 19900, "card spend not out yet");
const paid: Transfer[] = [{ id: "t1", from: "bank1", to: "card1", amountPaise: 3000_00, date: "2026-11-10", note: "", createdAt: "2026-11-10T09:00:00.000Z", updatedAt: "2026-11-10T09:00:00.000Z" }];
const moved: Transfer[] = [{ id: "t2", from: "bank1", to: "cash1", amountPaise: 2000_00, date: "2026-11-10", note: "", createdAt: "2026-11-10T09:00:00.000Z", updatedAt: "2026-11-10T09:00:00.000Z" }];
assert.equal(H.inHandState(start, cardRows, [], [card, bank], paid, "2026-11-12").now / 100, 16900, "card bill paid");
assert.equal(H.inHandState(start, cardRows, [], [card, bank], moved, "2026-11-12").now / 100, 19900, "bank to cash: same money");

// Saved values are checked when read back.
assert.deepEqual(H.validInHand(start), start);
assert.equal(H.validInHand({ paise: 1.5, date: "2026-10-10", at: start.at }), null);
assert.equal(H.validInHand({ paise: 100, date: "10/10", at: start.at }), null);
console.log("IN HAND OK");
