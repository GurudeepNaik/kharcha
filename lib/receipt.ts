// Text read from a payment receipt image (Google Pay, PhonePe, Paytm, a bank app) turned into a line for the add box.
//
// The text reader often misreads the ₹ sign: as ¥ < % z F X, or as an extra leading digit ("₹2,000" → "32,000").
// So each receipt is read at a few sizes, and the amounts compared:
//  - readings that agree, or differ only by one extra leading character, give the shorter amount;
//  - readings that disagree in any other way give no amount, so the person types it instead of saving a wrong one.

const LABELS = /^(paid to|sent to|to|payment to|received from|from|banking name)\b[:\s]*/i;
const SKIP_NAME = /@|\d{4,}|upi|transaction|bank|account|a\/c|google|phonepe|paytm|completed|successful|debited|credited/i;
const MONTHS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;
const MISREAD = "[₹¥<%zZfFxX&]";

const clean = (s: string) => s.replace(/[|_~`'"“”]/g, " ").replace(/\s+/g, " ").trim();
const titleCase = (s: string) => s.toLowerCase().split(" ").filter(Boolean).slice(0, 3).map(w => w[0]!.toUpperCase() + w.slice(1)).join(" ");
const linesOf = (text: string) => text.split(/\r?\n/).map(clean).filter(Boolean);

/** The amount in one reading, as written ("1,250.50"), or null. */
export function amountIn(text: string): string | null {
  const lines = linesOf(text);
  // 1. After a currency sign or word: "₹500", "Rs. 75.00", "INR 99", "¥1,250.50" (a misread ₹).
  for (const l of lines) {
    if (MONTHS.test(l) || /:\d{2}/.test(l)) continue;
    // A misread ₹ only counts on its own: the X in "XXXXXXXX1234" (a masked account) is not one.
    const m = new RegExp(String.raw`(?:(?<![A-Za-z0-9])${MISREAD}|\brs\.?|\binr)\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d{1,7}(?:\.\d{1,2})?)\b`, "i").exec(l);
    if (m) return m[1]!;
  }
  // 2. A line that is only an amount: "500", "2,000", "1,250.50".
  for (const l of lines) {
    const m = /^(\d{1,3}(?:,\d{2,3})+(?:\.\d{2})?|\d{1,7}(?:\.\d{2})?)$/.exec(l);
    if (m) return m[1]!;
  }
  return null;
}

/** One amount all readings agree on, allowing for a misread ₹ read as one extra leading character. */
export function agreedAmount(found: string[]): string | null {
  const digits = [...new Set(found.map(a => a.replace(/,/g, "")))];
  if (!digits.length) return null;
  const shortest = digits.reduce((a, b) => (b.length < a.length ? b : a));
  const fits = digits.every(d => d === shortest || (d.length === shortest.length + 1 && d.endsWith(shortest)));
  return fits ? shortest : null;
}

function nameOf(lines: string[], incoming: boolean): string {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    const lab = LABELS.exec(l);
    if (!lab) continue;
    const label = lab[1]!.toLowerCase();
    if (incoming ? !/from/.test(label) : /from/.test(label)) continue;
    const rest = clean(l.slice(lab[0].length));
    const cand = rest || clean(lines[i + 1] ?? "");
    const name = cand.replace(/[^A-Za-z .&-]/g, " ").replace(/\s+/g, " ").trim();
    if (name.length >= 2 && !SKIP_NAME.test(cand)) return titleCase(name);
  }
  return "";
}

/** Several readings of the same receipt (different sizes) → a line like "Ravi Kumar 500 upi", or null. */
export function receiptToLine(readings: string[]): string | null {
  const texts = readings.filter(t => t.trim());
  if (!texts.length) return null;
  const amount = agreedAmount(texts.map(amountIn).filter((a): a is string => !!a));
  if (!amount || !(Number(amount) > 0) || Number(amount) > 1_00_00_000) return null;
  const all = texts.join("\n");
  const incoming = /received from|money received|credited to/i.test(all) && !/paid to|sent to/i.test(all);
  const name = nameOf(linesOf(all), incoming);
  return incoming ? `+${amount}${name ? ` from ${name}` : ""}` : `${name ? `${name} ` : ""}${amount} upi`;
}
