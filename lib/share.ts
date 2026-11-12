// A payment shared from Google Pay, PhonePe, Paytm or a bank app, turned into a line for the add box.
// Each app words its share text differently, so this only fills in what it can read for sure (the amount
// and, when clear, the other person) and leaves the line for the person to check before saving.

const AMOUNT = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i;
const INCOMING = /\b(received|credited|got|recd)\b/i;
const NAME_END = String.raw`(?=\s+(?:on|via|using|through|upi|ref|for|with|successfully|at|is|has|was|in)\b|\s*[\n.,|:!]|\s+\d|$)`;
// Money out: the name after "to" ("paid to Ravi"). Money in: the name after "from".
const NAME_TO = new RegExp(String.raw`\b(?:paid to|sent to|payment to|paid|to)\s+([A-Za-z][A-Za-z .&'-]{1,40}?)` + NAME_END, "i");
const NAME_FROM = new RegExp(String.raw`\bfrom\s+([A-Za-z][A-Za-z .&'-]{1,40}?)` + NAME_END, "i");
const NOISE = /^(you|your|account|a\/c|bank|upi|the|me|my)\b/i;

export function sharedToLine(title: string, text: string, url: string): string | null {
  const all = [title, text, url].filter(Boolean).join("\n").replace(/\s+/g, " ").trim();
  if (!all) return null;
  const a = AMOUNT.exec(all);
  if (!a) return null;
  const amount = a[1]!.replace(/,/g, "");
  if (!(Number(amount) > 0)) return null;
  const incoming = INCOMING.test(all) && /\bfrom\b/i.test(all) || /\bcredited\b/i.test(all);
  const m = (incoming ? NAME_FROM : NAME_TO).exec(all.replace(AMOUNT, " ").replace(/\s+/g, " "));
  let name = m?.[1]?.trim().replace(/\s+/g, " ") ?? "";
  if (NOISE.test(name)) name = "";
  name = name.split(" ").slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  if (incoming) return `+${amount}${name ? ` from ${name}` : ""}`;
  return `${name ? `${name} ` : ""}${amount} upi`;
}
