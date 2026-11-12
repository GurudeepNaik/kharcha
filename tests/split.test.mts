import assert from "node:assert";
const S = (await import("../lib/split.ts")) as typeof import("../lib/split");
const P = (await import("../lib/parse.ts")) as typeof import("../lib/parse");
const w = (t: string) => S.splitWords(t);
assert.deepEqual(w("dinner 1200 split ravi asha"), { rest: "dinner 1200", people: ["Ravi", "Asha"], ways: 3 });
assert.deepEqual(w("dinner 1200 split with Ravi, Asha and Kiran"), { rest: "dinner 1200", people: ["Ravi", "Asha", "Kiran"], ways: 4 });
assert.deepEqual(w("cab 600 split 3 ways"), { rest: "cab 600", people: [], ways: 3 });
assert.deepEqual(w("pizza 900 split ravi yesterday upi"), { rest: "pizza 900 yesterday upi", people: ["Ravi"], ways: 2 });
assert.deepEqual(w("movie 750 split ravi 10/11"), { rest: "movie 750 10/11", people: ["Ravi"], ways: 2 });
assert.equal(w("split"), null, "no one to split with");
assert.equal(w("chai 20"), null);
assert.equal(w("splitsville 200"), null, "only the word split");
// The rest still reads as a normal entry.
const r = P.parseEntry(w("pizza 900 split ravi yesterday upi")!.rest, "2026-11-12");
assert.ok(r.ok && r.value.amountPaise === 900_00 && r.value.date === "2026-11-11" && r.value.method === "upi" && r.value.note === "pizza", JSON.stringify(r));
// Shares add up to the bill; you take the leftover.
assert.deepEqual(S.shares(1200_00, 3), { each: 400_00, yours: 400_00 });
assert.deepEqual(S.shares(1000_00, 3), { each: 333_00, yours: 334_00 });
assert.deepEqual(S.shares(100, 3), { each: 33, yours: 34 }, "₹1 split 3 ways: paise");
console.log("SPLIT OK");
