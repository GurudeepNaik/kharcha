// Reads one line like "chai 20", "₹1,250 rent", "auto 80 yesterday upi" into a spend.
import { guessCategory, type Category } from "./categories";
import { addDays, validDate } from "./dates";
import { MAX_PAISE } from "./money";

export type Method = "upi" | "cash";
export interface Parsed { amountPaise: number; note: string; date: string; category: Category; method: Method | null }
export type ParseResult = { ok: true; value: Parsed } | { ok: false; error: string; empty?: boolean };

const METHOD_WORDS: Record<string, Method> = { upi: "upi", gpay: "upi", phonepe: "upi", paytm: "upi", bhim: "upi", cash: "cash", nagad: "cash" };

// The amount: optional ₹ / Rs / INR, digits (commas allowed), decimals, an optional k for thousands.
// It must stand alone, so "2kg" or "10/11" are never read as an amount.
const AMOUNT = /(?<![\w.,/])(?:₹|rs\.?|inr)?\s*(\d[\d,]*)(\.\d+)?\s*(k)?(?![\w.,/])/i;
const DATE = /(?<![\w/])(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?(?![\w/])/;

export function parseEntry(text: string, now: string, learned: ReadonlyMap<string, Category> = new Map()): ParseResult {
  let rest = ` ${text.normalize("NFKC")} `;
  if (!rest.trim()) return { ok: false, error: "Type what you spent, like chai 20.", empty: true };

  // Date: "yesterday"/"kal", "today", or day/month[/year].
  let date = now;
  const word = /(?<![\w])(yesterday|kal|today|aaj)(?![\w])/i.exec(rest);
  if (word) {
    if (/^(yesterday|kal)$/i.test(word[1]!)) date = addDays(now, -1);
    rest = rest.slice(0, word.index) + " " + rest.slice(word.index + word[0].length);
  }
  const dm = DATE.exec(rest);
  if (dm) {
    const d = Number(dm[1]), m = Number(dm[2]);
    const yearGiven = dm[3] !== undefined;
    let y = yearGiven ? Number(dm[3]!.length === 2 ? `20${dm[3]}` : dm[3]) : Number(now.slice(0, 4));
    let found = validDate(y, m, d);
    if (!found) return { ok: false, error: "That date doesn't exist. Write it as day/month, like 10/11." };
    // "28/12" typed in January means last December.
    if (!yearGiven && found > now) { y -= 1; found = validDate(y, m, d); }
    if (!found || found > now) return { ok: false, error: "That date is in the future. Spends can only be for today or earlier." };
    date = found;
    rest = rest.slice(0, dm.index) + " " + rest.slice(dm.index + dm[0].length);
  }

  // Paid by: upi / gpay / cash ...
  let method: Method | null = null;
  rest = rest.replace(/(?<![\w])(upi|gpay|phonepe|paytm|bhim|cash|nagad)(?![\w])/gi, (w) => { method ??= METHOD_WORDS[w.toLowerCase()]!; return " "; });

  const a = AMOUNT.exec(rest);
  if (!a) return { ok: false, error: "Add the amount, like chai 20." };
  const digits = a[1]!.replace(/,/g, "");
  const frac = a[2] ?? "";
  const k = !!a[3];
  if (!k && frac.length > 3) return { ok: false, error: "Use at most 2 decimal places (paise), like 99.50." };
  let paise = Math.round(Number(`${digits}${frac}`) * 100 * (k ? 1000 : 1));
  if (!Number.isFinite(paise) || paise <= 0) return { ok: false, error: "The amount must be more than ₹0." };
  if (paise > MAX_PAISE) return { ok: false, error: "That's more than ₹1 crore. Check the amount." };
  paise = Math.trunc(paise);
  rest = rest.slice(0, a.index) + " " + rest.slice(a.index + a[0].length);

  const note = rest.replace(/\s+/g, " ").trim().replace(/^[-:–,.;]+|[-:–,;]+$/g, "").trim().slice(0, 60);
  return { ok: true, value: { amountPaise: paise, note, date, category: guessCategory(note, learned), method } };
}
