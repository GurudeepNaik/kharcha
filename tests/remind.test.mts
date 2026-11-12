import assert from "node:assert";
const R = (await import("../lib/remind.ts")) as typeof import("../lib/remind");
type Item = import("../lib/plan").PlanItem;
type Expense = import("../lib/types").Expense;
const at = "2026-01-01T00:00:00.000Z";
let n = 0;
const item = (o: Partial<Item>): Item => ({ id: `iiiiiiii-0000-4000-8000-${String(++n).padStart(12, "0")}`, name: "x", kind: "bill", category: "bills", amountPaise: 1000_00, day: 5, every: 1,
  startMonth: "2026-01", autoPay: false, handledThrough: null, skips: [], accountId: null, loan: null, createdAt: at, updatedAt: at, ...o });
const NOW = "2026-11-12";
const wifi = item({ name: "Wi-Fi", day: 12 }), emi = item({ name: "EMI", kind: "loan", day: 13 }), sip = item({ name: "SIP", kind: "invest", category: "sip", day: 13, skips: ["2026-11"] });
const salary = item({ name: "Salary", kind: "income", category: "salary", day: 12 }), gold = item({ name: "Gold", kind: "goldloan", amountPaise: null, day: 12 });
const later = item({ name: "Netflix", day: 20 }), yearly = item({ name: "Term", kind: "insurance", category: "termIns", every: 12, startMonth: "2026-03", day: 13 });
const paid: Expense = { id: "e1-aaaaaaaa", amountPaise: 1000_00, note: "wifi", category: "bills", method: null, date: "2026-11-10", createdAt: at, updatedAt: at, planId: wifi.id };
const items = [wifi, emi, sip, salary, gold, later, yearly];
assert.deepEqual(R.remindersDue(items, [], NOW).map(x => [x.item.name, x.when]), [["Wi-Fi", "today"], ["EMI", "tomorrow"]], "skipped SIP, salary, gold loan, later and not-this-month left out");
assert.deepEqual(R.remindersDue(items, [paid], NOW).map(x => x.item.name), ["EMI"], "already paid: no reminder");
// Day 31 in a 30-day month falls on the 30th.
assert.deepEqual(R.remindersDue([item({ name: "Rent", day: 31 })], [], "2026-11-29").map(x => x.when), ["tomorrow"]);

const cal = R.calendarFile(items, NOW, it => `${it.name} due`, "https://example.test", "2026-11-12T10:00:00.000Z");
assert.equal(cal.count, 5, "everything except salary and the gold loan");
assert.ok(cal.text.includes("RRULE:FREQ=MONTHLY;INTERVAL=12;BYMONTHDAY=13") && cal.text.includes("DTSTART;VALUE=DATE:20270313"), "yearly term insurance from next March");
assert.ok(cal.text.includes("DTSTART;VALUE=DATE:20261112") && cal.text.includes("TRIGGER:-PT6H"), "Wi-Fi from this month, alert the evening before");
assert.ok(cal.text.split("\r\n").every(l => new TextEncoder().encode(l).length <= 75), "lines folded");
assert.equal(R.calendarFile([item({ name: "Rent", day: 30 })], NOW, it => it.name, "x").text.includes("BYMONTHDAY=-1"), true, "29–31: last day");
assert.ok(R.calendarFile([item({ name: "a,b;c" })], NOW, it => it.name, "x").text.includes(String.raw`SUMMARY:a\,b\;c`), "escaped");
console.log("REMINDERS OK");
