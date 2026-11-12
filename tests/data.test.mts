import "fake-indexeddb/auto";
import assert from "node:assert";
const S = (await import("../lib/store.ts")) as typeof import("../lib/store");
const B = (await import("../lib/backup.ts")) as typeof import("../lib/backup");
const T = (await import("../lib/totals.ts")) as typeof import("../lib/totals");
type Expense = import("../lib/types").Expense;

const mk = (i: number, o: Partial<Expense> = {}): Expense => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, amountPaise: 1000 * i + 5, note: `note ${i}`,
  category: (["food", "travel", "bills", "other"] as const)[i % 4]!, method: i % 3 === 0 ? "upi" : i % 3 === 1 ? "cash" : null,
  date: `2026-11-${String((i % 12) + 1).padStart(2, "0")}`, createdAt: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString(),
  updatedAt: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString(), ...o,
});

// Round trip: save 50 rows, back up, wipe, restore, every field of every row comes back.
const rows = Array.from({ length: 50 }, (_, i) => mk(i + 1));
for (const r of rows) await S.putExpense(r);
await S.learn("ramesh", "rent");
await S.saveSettings({ monthlyLimitPaise: 2000000 });
const before = await S.allExpenses();
assert.equal(before.length, 50);
const backup = B.makeBackup(before, await S.learnedMap(), await S.getSettings());
const text = JSON.stringify(backup);
await S._wipe();
assert.equal((await S.allExpenses()).length, 0, "wiped");
const read = B.readBackup(text);
assert.ok(read.ok, "own backup reads back");
const plan = B.planRestore(await S.allExpenses(), read.value.expenses);
assert.deepEqual([plan.add.length, plan.update.length, plan.unchanged], [50, 0, 0]);
await S.applyRestore([...plan.add, ...plan.update], read.value.learned);
const after = await S.allExpenses();
assert.deepEqual(after, before, "every field of all 50 rows restored");
assert.equal((await S.learnedMap()).get("ramesh"), "rent");
assert.equal(read.value.settings.monthlyLimitPaise, 2000000);
// Sorted newest day first, then latest entry first.
for (let i = 1; i < after.length; i++) {
  const a = after[i - 1]!, b = after[i]!;
  assert.ok(a.date > b.date || (a.date === b.date && a.createdAt >= b.createdAt), "sort order");
}
console.log("ROUND TRIP OK (50 rows)");

// Restore plan: newer copy updates, older or same copy doesn't, new id adds.
const cur = [mk(1), mk(2), mk(3)];
const inc = [mk(1), mk(2, { note: "edited", updatedAt: "2026-12-01T00:00:00.000Z" }), mk(3, { note: "stale", updatedAt: "2020-01-01T00:00:00.000Z" }), mk(4)];
const p = B.planRestore(cur, inc);
assert.deepEqual([p.add.map(e => e.id), p.update.map(e => e.note), p.unchanged], [[mk(4).id], ["edited"], 2]);
console.log("RESTORE PLAN OK");

// Bad files are rejected whole.
const good = JSON.parse(text);
const variants: [string, unknown][] = [
  ["not json", "{oops"],
  ["other kind", { ...good, kind: "something" }],
  ["newer version", { ...good, version: 99 }],
  ["float amount", { ...good, expenses: [{ ...good.expenses[0], amountPaise: 10.5 }] }],
  ["negative amount", { ...good, expenses: [{ ...good.expenses[0], amountPaise: -1 }] }],
  ["bad category", { ...good, expenses: [{ ...good.expenses[0], category: "drugs" }] }],
  ["bad date", { ...good, expenses: [{ ...good.expenses[0], date: "2026-02-31" }] }],
  ["long note", { ...good, expenses: [{ ...good.expenses[0], note: "x".repeat(61) }] }],
  ["script id", { ...good, expenses: [{ ...good.expenses[0], id: "<img onerror=x>" }] }],
  ["missing list", { ...good, expenses: undefined }],
];
for (const [name, v] of variants) assert.equal(B.readBackup(typeof v === "string" ? v : JSON.stringify(v)).ok, false, `rejects ${name}`);
assert.match((B.readBackup(JSON.stringify({ ...good, version: 99 })) as { error: string }).error, /newer version/);
console.log(`BAD FILES REJECTED (${variants.length})`);

// CSV
const csv = B.toCsv([mk(1, { note: '=HYPERLINK("x")', amountPaise: 9950, category: "food", method: "upi", date: "2026-11-02" }), mk(2, { note: "tea, snacks", amountPaise: 2000, method: null, date: "2026-11-01" })]);
assert.ok(csv.startsWith("\uFEFFDate,Type,Amount (₹),Category,Note,Paid by\r\n"));
const lines = csv.slice(1).trim().split("\r\n");
assert.equal(lines[1], '2026-11-01,Spent,20,Bills,"tea, snacks",');
assert.equal(lines[2], `2026-11-02,Spent,99.50,Food,"'=HYPERLINK(""x"")",UPI`, "formula neutralised");
assert.ok(B.toCsv([mk(9, { category: "salary", amountPaise: 5000000, note: "salary", date: "2026-11-01" })]).includes("2026-11-01,Money in,50000,Salary,salary,"));
console.log("CSV OK");

// Totals
const tr = [mk(1, { amountPaise: 100, category: "food" }), mk(2, { amountPaise: 300, category: "travel" }), mk(3, { amountPaise: 50, category: "food" })];
assert.equal(T.sum(tr), 450);
assert.deepEqual(T.byCategory(tr).map(c => [c.category, c.paise, c.count]), [["travel", 300, 1], ["food", 150, 2]]);
assert.equal(T.byCategory(tr).reduce((s, c) => s + c.paise, 0), T.sum(tr), "categories sum to the total");
const mixed = [...tr, mk(4, { amountPaise: 9000, category: "salary" })];
assert.equal(T.sum(T.spends(mixed)), 450, "salary isn't a spend");
assert.equal(T.sum(T.incomes(mixed)), 9000);
assert.equal(T.byDay(mixed.map(e => ({ ...e, date: "2026-11-01" })))[0]!.paise, 450, "day total counts spends only");
console.log("TOTALS OK");

// ---------- Monthly repeats ----------
const R = (await import("../lib/repeat.ts")) as typeof import("../lib/repeat");
const at = "2026-11-12T00:00:00.000Z";
const rent = mk(20, { note: "rent", category: "rent", amountPaise: 1200000, date: "2026-08-01" });
const rule = R.repeatFrom(rent, "11111111-2222-4333-8444-555555555555", at);
assert.deepEqual([rule.day, rule.lastMonth], [1, "2026-08"]);
const due = R.dueRepeats([rule], "2026-11-12", at);
assert.deepEqual(due.entries.map(e => e.date), ["2026-09-01", "2026-10-01", "2026-11-01"], "catches up Sep, Oct, Nov");
assert.equal(due.rules[0]!.lastMonth, "2026-11");
assert.ok(due.entries.every(e => e.repeatId === rule.id && e.amountPaise === 1200000 && e.category === "rent"));
assert.equal(R.dueRepeats(due.rules, "2026-11-30", at).entries.length, 0, "nothing twice in the same month");
const sal = { ...rule, id: "aaaaaaaa-2222-4333-8444-555555555555", day: 31, lastMonth: "2026-10" };
assert.equal(R.dueRepeats([sal], "2026-11-29", at).entries.length, 0, "31st waits for the month's last day");
assert.deepEqual(R.dueRepeats([sal], "2026-11-30", at).entries.map(e => e.date), ["2026-11-30"], "31st → 30 Nov");
assert.deepEqual(R.dueRepeats([{ ...sal, lastMonth: "2027-01" }], "2027-02-28", at).entries.map(e => e.date), ["2027-02-28"], "31st → 28 Feb");
assert.equal(R.dueRepeats([{ ...rule, lastMonth: "2020-01" }], "2026-11-12", at).entries.length, 24, "catch-up capped at 24 months");
assert.equal(R.nextDate({ ...rule, lastMonth: "2026-11" }), "2026-12-01");
assert.equal(R.repeatEntryId(rule.id, "2026-09"), due.entries[0]!.id);

// Stored: due entries are added once, even if the same batch runs twice (two tabs).
await S._wipe();
await S.putRepeat(rule);
const first = await S.applyDue(due.entries, due.rules);
const again = await S.applyDue(due.entries, due.rules);
assert.deepEqual([first.length, again.length, (await S.allExpenses()).length], [3, 0, 3]);
assert.equal((await S.allRepeats())[0]!.lastMonth, "2026-11");

// Backups carry repeats; a version 1 file (no repeats) still restores.
const b2 = B.readBackup(JSON.stringify(B.makeBackup(await S.allExpenses(), new Map(), await S.getSettings(), await S.allRepeats())));
assert.ok(b2.ok && b2.value.repeats.length === 1 && b2.value.expenses.every(e => e.repeatId === rule.id));
const v1 = { kind: "expense-tracker-backup", version: 1, exportedAt: at, expenses: [mk(1)], learned: [], settings: {} };
const r1 = B.readBackup(JSON.stringify(v1));
assert.ok(r1.ok && r1.value.repeats.length === 0 && r1.value.expenses.length === 1, "version 1 backup reads");
assert.equal(B.readBackup(JSON.stringify({ ...v1, version: 2, repeats: [{ ...rule, day: 32 }] })).ok, false, "bad repeat rejected");
console.log("REPEATS OK");
