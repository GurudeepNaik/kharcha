import assert from "node:assert";
const U = (await import("../lib/upi.ts")) as typeof import("../lib/upi");
// A shop QR with no amount: you type it.
const shop = U.readUpiQr("upi://pay?pa=srilakshmi.stores@ybl&pn=SRI%20LAKSHMI%20STORES&mc=5411&tr=STQ123&cu=INR")!;
assert.equal(shop.pa, "srilakshmi.stores@ybl");
assert.equal(shop.name, "SRI LAKSHMI STORES");
assert.equal(shop.amountPaise, null);
assert.equal(U.payeeNote(shop), "Sri Lakshmi Stores");
const link = U.payLink(shop, 12050);
assert.equal(link, "upi://pay?pa=srilakshmi.stores@ybl&pn=SRI%20LAKSHMI%20STORES&mc=5411&tr=STQ123&cu=INR&am=120.50");
assert.ok(link.startsWith("upi://pay?"));
// Billing QR with the amount in it, + for spaces, upper-case scheme.
const bill = U.readUpiQr("UPI://pay?pa=Cafe@okaxis&pn=Brew+Cafe&am=240.00")!;
assert.equal(bill.amountPaise, 24000);
assert.equal(bill.name, "Brew Cafe");
assert.equal(U.payLink(bill, 24000), "upi://pay?pa=Cafe@okaxis&pn=Brew%20Cafe&am=240.00&cu=INR");
// Paise formatting.
assert.ok(U.payLink(shop, 5).endsWith("am=0.05"));
assert.ok(U.payLink(shop, 100000).endsWith("am=1000.00"));
// A person's QR with no name: the UPI ID is the note.
assert.equal(U.payeeNote(U.readUpiQr("upi://pay?pa=9876543210@paytm")!), "9876543210@Paytm");
// Not UPI payment QRs.
for (const bad of ["https://example.com", "upi://mandate?pa=a@b", "upi://pay?pn=NoId", "upi://pay?pa=not an id", "javascript:alert(1)", "upi://pay?pa=a@b&am=-5", ""])
  assert.equal(bad === "upi://pay?pa=a@b&am=-5" ? U.readUpiQr(bad)?.amountPaise : U.readUpiQr(bad), null, bad);
// Unknown parameters are dropped; a duplicate pa can't override the first.
const odd = U.readUpiQr("upi://pay?pa=shop@ybl&pa=evil@ybl&redirect=https://x.y&pn=Shop")!;
assert.equal(odd.pa, "shop@ybl");
assert.ok(!U.payLink(odd, 100).includes("redirect") && !U.payLink(odd, 100).includes("evil"));
// Amounts out of range are ignored (you type it instead).
assert.equal(U.readUpiQr("upi://pay?pa=a.b@ybl&am=999999999")!.amountPaise, null);
assert.equal(U.readUpiQr("upi://pay?pa=a.b@ybl&am=0")!.amountPaise, null);
console.log("UPI OK");
