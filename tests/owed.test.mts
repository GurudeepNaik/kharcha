import assert from "node:assert";
const D = (await import("../lib/debts.ts")) as typeof import("../lib/debts");
type Debt = import("../lib/debts").Debt;
let n = 0;
const d = (person: string, dir: "gave" | "got", rs: number, date: string, note = ""): Debt =>
  ({ id: `d${++n}`, person, dir, amountPaise: rs * 100, note, date, createdAt: `${date}T09:00:00Z`, updatedAt: `${date}T09:00:00Z` });
const debts = [
  d("Ravi", "gave", 500, "2026-09-01", "old loan"), d("Ravi", "got", 500, "2026-09-10", "Settled"), // settled in Sept
  d("Ravi", "gave", 400, "2026-10-20", "dinner · split"), d("Ravi", "gave", 200, "2026-10-25", "movie"),
  d("Asha", "gave", 300, "2026-11-10", "cab"),
  d("Kiran", "got", 1000, "2026-08-01", "rent"),
];
const bs = D.balances(debts);
const ravi = bs.find(b => b.name === "Ravi")!;
assert.deepEqual([ravi.paise / 100, ravi.since, ravi.notes], [600, "2026-10-20", ["dinner · split", "movie"]], "since the day it last started; old settled notes dropped");
assert.equal(D.daysBetween("2026-10-20", "2026-11-13"), 24);
assert.equal(D.oldestOwed(debts, "2026-11-13")?.name, "Ravi", "Asha only 3 days; Kiran is money you owe");
assert.equal(D.oldestOwed(debts, "2026-10-30"), null, "nothing 2 weeks old yet");
assert.equal(D.whatsappLink("Hi Ravi, ₹600 & thanks"), "https://wa.me/?text=Hi%20Ravi%2C%20%E2%82%B9600%20%26%20thanks");
assert.ok(D.UPI_ID.test("ravi.k@okaxis") && D.UPI_ID.test("9876543210@ybl") && !D.UPI_ID.test("ravi") && !D.UPI_ID.test("a@b c"));
console.log("OWED OK");
