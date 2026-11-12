// "In hand": the money you have right now (bank + cash together), carried from month to month.
// You type it once; after that every money-in adds to it, every spend and investment takes from it,
// lending takes from it and borrowing adds to it. Spends on a credit card wait until the card is paid.
import { addMonths, monthOf } from "./dates";
import { kindOf } from "./categories";
import type { Debt } from "./debts";
import type { Expense } from "./types";
import type { Account, Transfer } from "./wealth";

/** What you said you had, on `date`, at the moment `at` (entries made before that are already in it). */
export interface InHand { paise: number; date: string; at: string }

type Dated = { date: string; createdAt: string };
/** After the starting point: a later day, or the same day but noted after you typed the amount. */
const after = (x: Dated, s: InHand) => x.date > s.date || (x.date === s.date && x.createdAt > s.at);

/** Every change to in-hand money after the starting point, as signed paise with its date. */
function moves(s: InHand, rows: Expense[], debts: Debt[], accounts: Account[], transfers: Transfer[]) {
  const card = new Set(accounts.filter(a => a.type === "card").map(a => a.id));
  const out: { date: string; paise: number; kind: "in" | "out" }[] = [];
  for (const e of rows) {
    if (!after(e, s) || (e.accountId && card.has(e.accountId))) continue;
    const inn = kindOf(e.category) === "in";
    out.push({ date: e.date, paise: inn ? e.amountPaise : -e.amountPaise, kind: inn ? "in" : "out" });
  }
  for (const d of debts) {
    if (!after(d, s)) continue;
    out.push({ date: d.date, paise: d.dir === "got" ? d.amountPaise : -d.amountPaise, kind: d.dir === "got" ? "in" : "out" });
  }
  // Paying the card bill from the bank is when card spends leave your hand.
  for (const t of transfers) {
    if (!after(t, s) || card.has(t.from) === card.has(t.to)) continue;
    out.push({ date: t.date, paise: card.has(t.to) ? -t.amountPaise : t.amountPaise, kind: card.has(t.to) ? "out" : "in" });
  }
  return out;
}

export interface InHandState {
  now: number;
  /** This month: what came over from last month (null in the month you started), what came in and went out. */
  month: string; broughtIn: number | null; cameIn: number; wentOut: number;
}

export function inHandState(s: InHand, rows: Expense[], debts: Debt[], accounts: Account[], transfers: Transfer[], today: string): InHandState {
  const m = monthOf(today), ms = moves(s, rows, debts, accounts, transfers);
  const now = s.paise + ms.reduce((a, x) => a + x.paise, 0);
  const startedThisMonth = monthOf(s.date) === m;
  const broughtIn = startedThisMonth ? null : s.paise + ms.filter(x => x.date < `${m}-01`).reduce((a, x) => a + x.paise, 0);
  const cur = ms.filter(x => monthOf(x.date) === m);
  return {
    now, month: m, broughtIn,
    cameIn: cur.filter(x => x.kind === "in").reduce((a, x) => a + x.paise, 0),
    wentOut: -cur.filter(x => x.kind === "out").reduce((a, x) => a + x.paise, 0),
  };
}

/** Start and end of a past or current month. Null for months before you set the amount. */
export function monthInHand(s: InHand, rows: Expense[], debts: Debt[], accounts: Account[], transfers: Transfer[], month: string, today: string) {
  const first = monthOf(s.date);
  if (month < first || month > monthOf(today)) return null;
  const ms = moves(s, rows, debts, accounts, transfers);
  const upTo = (end: string) => s.paise + ms.filter(x => x.date < end).reduce((a, x) => a + x.paise, 0);
  const next = `${addMonths(month, 1)}-01`;
  return { start: month === first ? null : upTo(`${month}-01`), end: upTo(next), current: month === monthOf(today) };
}

export function validInHand(v: unknown): InHand | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.paise !== "number" || !Number.isInteger(o.paise) || Math.abs(o.paise) > 100_00_00_000_00) return null;
  if (typeof o.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.date) || typeof o.at !== "string" || Number.isNaN(Date.parse(o.at))) return null;
  return { paise: o.paise, date: o.date, at: o.at };
}
