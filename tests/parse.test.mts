import assert from "node:assert";
const P = (await import("../lib/parse.ts")) as typeof import("../lib/parse");
const C = (await import("../lib/categories.ts")) as typeof import("../lib/categories");
const M = (await import("../lib/money.ts")) as typeof import("../lib/money");
const D = (await import("../lib/dates.ts")) as typeof import("../lib/dates");

const NOW = "2026-11-12";
type Row = [input: string, paise: number, note: string, category: string, date?: string, method?: string | null];
const OK: Row[] = [
  ["chai 20", 2000, "chai", "food"],
  ["20 chai", 2000, "chai", "food"],
  ["₹1,250 rent", 125000, "rent", "rent"],
  ["auto 80 yesterday", 8000, "auto", "travel", "2026-11-11"],
  ["kal auto 80", 8000, "auto", "travel", "2026-11-11"],
  ["20", 2000, "", "other"],
  ["rent 12,000 1/11", 1200000, "rent", "rent", "2026-11-01"],
  ["₹ 99.50 medicine", 9950, "medicine", "health"],
  ["medicines 340", 34000, "medicines", "health"],
  ["Rs.150 petrol", 15000, "petrol", "travel"],
  ["rs 150 Petrol pump", 15000, "Petrol pump", "travel"],
  ["1.5k groceries dmart", 150000, "groceries dmart", "groceries"],
  ["swiggy dinner 450 upi", 45000, "swiggy dinner", "food", NOW, "upi"],
  ["milk 30 cash", 3000, "milk", "groceries", NOW, "cash"],
  ["gpay 999 amazon", 99900, "amazon", "shopping", NOW, "upi"],
  ["rice 2kg 120", 12000, "rice 2kg", "groceries"],
  ["electricity bill 1,800 5/11", 180000, "electricity bill", "bills", "2026-11-05"],
  ["28/12 gift 500", 50000, "gift", "shopping", "2025-12-28"],
  ["school fees 25000 10/06/2026", 2500000, "school fees", "bills", "2026-06-10"],
  ["pani puri 40", 4000, "pani puri", "food"],
  ["something new 75", 7500, "something new", "other"],
  ["recharge 299 - jio", 29900, "recharge - jio", "bills"],
  ["inr 10 tea", 1000, "tea", "food"],
  // Typed in Hindi or Kannada
  ["चाय 20", 2000, "चाय", "food"],
  ["दूध 30 कल", 3000, "दूध", "groceries", "2026-11-11"],
  ["ಬಾಡಿಗೆ 8000", 800000, "ಬಾಡಿಗೆ", "rent"],
  ["ಆಟೋ 60 ನಿನ್ನೆ", 6000, "ಆಟೋ", "travel", "2026-11-11"],
  ["ಸಂಬಳ 40000", 4000000, "ಸಂಬಳ", "salary"],
  // Money in
  ["salary 50,000", 5000000, "salary", "salary"],
  ["+2000 from ravi", 200000, "from ravi", "income"],
  ["+ 1500 gift", 150000, "gift", "income"],
  ["amazon refund 499", 49900, "amazon refund", "refund"],
  ["cashback 25 upi", 2500, "cashback", "refund", NOW, "upi"],
  ["freelance 12k 1/11", 1200000, "freelance", "business", "2026-11-01"],
  ["rent received 8000", 800000, "rent received", "income"],
  // Spends that mention money words stay spends
  ["pay electricity 900", 90000, "pay electricity", "bills"],
  ["client lunch 600", 60000, "client lunch", "food"],
  ["loan interest 2000", 200000, "loan interest", "rent"],
];
for (const [input, paise, note, cat, date = NOW, method = null] of OK) {
  const r = P.parseEntry(input, NOW);
  assert.ok(r.ok, `"${input}" should read: ${!r.ok ? r.error : ""}`);
  assert.deepEqual(r.value, { amountPaise: paise, note, category: cat, date, method }, `"${input}"`);
}
const BAD: [string, RegExp][] = [
  ["", /Type what you spent/],
  ["   ", /Type what you spent/],
  ["chai", /Add the amount/],
  ["chai 0", /more than ₹0/],
  ["99.999 tea", /2 decimal/],
  ["house 2,00,00,000", /1 crore/],
  ["tea 20 31/02", /doesn't exist/],
  ["tea 20 13/11/2026", /future/],
  ["tea 20 1/1/2030", /future/],
];
for (const [input, re] of BAD) {
  const r = P.parseEntry(input, NOW);
  assert.equal(r.ok, false, `"${input}" should be rejected`);
  assert.match(!r.ok ? r.error : "", re, `"${input}" error`);
}
// Taught words beat the built-in list.
const learned = new Map([["chai", "other" as const], ["ramesh", "rent" as const]]);
assert.equal((P.parseEntry("chai 20", NOW, learned) as { value: { category: string } }).value.category, "other");
assert.equal((P.parseEntry("paid Ramesh 5000", NOW, learned) as { value: { category: string } }).value.category, "rent");
assert.equal(C.keyWord("for the Ramesh shop"), "ramesh");
assert.equal(C.keyWord("20 2kg"), "2kg");
assert.equal(C.keyWord(""), null);
console.log(`PARSE OK (${OK.length} readable, ${BAD.length} rejected)`);

assert.equal(M.rupees(12500000), "₹1,25,000");
assert.equal(M.rupees(9950), "₹99.50");
assert.equal(M.rupees(5), "₹0.05");
assert.equal(M.plainAmount(9950), "99.50");
assert.equal(M.plainAmount(2000), "20");
assert.equal(D.addDays("2026-03-01", -1), "2026-02-28");
assert.equal(D.addMonths("2026-01", -1), "2025-12");
assert.equal(D.dayLabel("2026-11-12", NOW), "Today");
assert.equal(D.dayLabel("2026-11-11", NOW), "Yesterday");
assert.equal(D.dayLabel("2026-11-10", NOW), "Tue 10 Nov");
assert.equal(D.dayLabel("2025-11-10", NOW), "Mon 10 Nov 2025");
assert.equal(D.daysLeft("2026-11", NOW), 19);
assert.equal(D.daysLeft("2026-10", NOW), 0);
console.log("MONEY + DATES OK");
