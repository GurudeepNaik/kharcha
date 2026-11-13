import assert from "node:assert";
const L = (await import("../lib/lock.ts")) as typeof import("../lib/lock");
assert.ok(L.validPin("1234") && L.validPin("123456") && !L.validPin("123") && !L.validPin("1234567") && !L.validPin("12a4"));
const lock = await L.makeLock("2468");
assert.ok(!JSON.stringify(lock).includes("2468"), "the PIN itself is never stored");
assert.equal(lock.len, 4);
const other = await L.makeLock("2468");
assert.notEqual(lock.hash, other.hash, "salted: the same PIN gives a different hash");
const t0 = Date.parse("2026-11-13T10:00:00Z");
let r = await L.checkPin(lock, "2468", t0);
assert.ok(r.ok && r.next.fails === 0);
// Wrong 4 times: no wait. 5th: 30 s, and even the right PIN waits.
let cur = lock;
for (let k = 1; k <= 4; k++) { r = await L.checkPin(cur, "0000", t0); assert.ok(!r.ok && r.waitSec === 0 && r.next.fails === k); cur = r.next; }
r = await L.checkPin(cur, "0000", t0); assert.ok(!r.ok && r.waitSec === 30); cur = r.next;
r = await L.checkPin(cur, "2468", t0 + 10_000); assert.ok(!r.ok && r.waitSec === 20, "right PIN still waits");
r = await L.checkPin(cur, "2468", t0 + 31_000); assert.ok(r.ok && r.next.fails === 0 && r.next.waitUntil === null, "after the wait it opens and resets");
assert.deepEqual([L.waitFor(4), L.waitFor(5), L.waitFor(6), L.waitFor(20)], [0, 30, 60, 3600]);
assert.deepEqual(L.validLock(JSON.parse(JSON.stringify(lock))), lock);
assert.equal(L.validLock({ salt: "x", hash: "y", iter: 5 }), null);
console.log("LOCK OK");
