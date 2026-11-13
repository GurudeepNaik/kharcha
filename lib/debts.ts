// Lent and borrowed: money between you and a person. Kept apart from spends, so it never changes spending totals.
import { guessCategory } from "./categories";
import { parseEntry } from "./parse";

export type Direction = "gave" | "got"; // gave: money from you to them; got: from them to you
export interface Debt { id: string; person: string; dir: Direction; amountPaise: number; note: string; date: string; createdAt: string; updatedAt: string }
export type DebtParse = { ok: true; value: { person: string; dir: Direction; amountPaise: number; date: string } } | { ok: false; code: "debtNoPerson" | "debtNoAmount"; error: string };

const NOT_PEOPLE = /\b(tip|tips|donation|charity|temple|church|mosque|gurudwara|dakshina|alms|offering|hundi|bribe|fine|penalty)\b/i;
const titleCase = (s: string) => s.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
export const personKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Reads "lent ravi 500", "gave 500 to ravi", "borrowed 200 from asha", "ravi returned 500", "repaid asha 200".
 * Returns null when the line isn't about lending at all, so it's read as a normal entry.
 */
export function parseDebt(text: string, now: string): DebtParse | null {
  const low = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  let dir: Direction | null = null;
  let verb: RegExp | null = null;
  if (/ (borrowed|took) /.test(low)) { dir = "got"; verb = /\b(borrowed|took)\b/i; }
  else if (/ (got|received) back /.test(low)) { dir = "got"; verb = /\b(got|received) back\b/i; }
  else if (/ (lent|udhaar|udhar) /.test(low)) { dir = "gave"; verb = /\b(lent|udhaar|udhar)\b/i; }
  else if (/ (returned|repaid|paid back) /.test(low)) {
    verb = /\b(returned|repaid|paid back)\b/i;
    // "ravi returned 500" (they paid you back) vs "returned 500 to ravi" / "repaid ravi" (you paid them back).
    const before = low.slice(0, low.search(/ (returned|repaid|paid back) /)).replace(/[₹\d.,\s]|rs\b/g, "");
    dir = before ? "got" : "gave";
  } else if (/ gave /.test(low)) {
    dir = "gave"; verb = /\bgave\b/i;
    // "gave tip 50", "gave donation 100" or "gave milk money 40" are spends, not loans.
    const rest = text.replace(verb, " ").replace(/\b(to|for)\b/gi, " ");
    const p = parseEntry(rest, now);
    if (p.ok && (guessCategory(p.value.note, new Map()) !== "other" || NOT_PEOPLE.test(p.value.note))) return null;
  }
  if (!dir || !verb) return null;
  const p = parseEntry(text.replace(verb, " "), now);
  if (!p.ok) return { ok: false, code: "debtNoAmount", error: "Add the amount, like lent ravi 500." };
  const person = p.value.note.replace(/\b(to|from|back|me|the|by|with)\b/gi, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 3).join(" ");
  if (!person) return { ok: false, code: "debtNoPerson", error: "Add who it was, like lent ravi 500." };
  return { ok: true, value: { person: titleCase(person), dir, amountPaise: p.value.amountPaise, date: p.value.date } };
}

export interface Balance {
  key: string; name: string; paise: number; last: string; count: number;
  /** When the current balance started (the day it last went from settled to owing), and what it's for. */
  since: string; notes: string[];
}

/** Per person: positive = they owe you, negative = you owe them. Settled people (0) stay listed, last. */
export function balances(debts: Debt[]): Balance[] {
  const m = new Map<string, Balance>();
  for (const d of [...debts].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))) {
    const k = personKey(d.person);
    const b = m.get(k) ?? { key: k, name: d.person, paise: 0, last: d.date, count: 0, since: d.date, notes: [] };
    const before = b.paise;
    b.paise += d.dir === "gave" ? d.amountPaise : -d.amountPaise;
    if (before === 0 || Math.sign(before) !== Math.sign(b.paise)) { b.since = d.date; b.notes = []; }
    if (d.note && Math.sign(b.paise) === (d.dir === "gave" ? 1 : -1) && !b.notes.includes(d.note)) b.notes.push(d.note);
    b.name = d.person; b.last = d.date; b.count++;
    m.set(k, b);
  }
  return [...m.values()].sort((a, b) => (a.paise === 0) !== (b.paise === 0) ? (a.paise === 0 ? 1 : -1) : b.last.localeCompare(a.last));
}

export const owedToYou = (bs: Balance[]) => bs.reduce((s, b) => s + Math.max(b.paise, 0), 0);
export const youOwe = (bs: Balance[]) => bs.reduce((s, b) => s + Math.max(-b.paise, 0), 0);

/** Whole days between two YYYY-MM-DD dates. */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** WhatsApp link with the message ready; the person picks the chat (no phone number needed). */
export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** The oldest money owed to you, if it's been a while: for the Home nudge. */
export function oldestOwed(debts: Debt[], now: string, minDays = 14): Balance | null {
  return balances(debts).filter(b => b.paise > 0 && daysBetween(b.since, now) >= minDays).sort((a, b) => a.since.localeCompare(b.since))[0] ?? null;
}

/** A UPI ID: name@bank. */
export const UPI_ID = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9]{1,32}$/;
