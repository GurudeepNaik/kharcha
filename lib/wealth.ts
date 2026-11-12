// Accounts (cash, bank, credit card), transfers between them, what you own (net worth) and savings goals.
// All of it is typed in by the person; nothing is fetched.
import { addMonths, monthOf } from "./dates";
import { kindOf } from "./categories";
import type { Expense } from "./types";

export type AccountType = "cash" | "bank" | "card";
export interface Account {
  id: string; name: string; type: AccountType;
  /** Balance on `openingDate` before any entries that day. For a card it's negative: what you owed. */
  openingPaise: number; openingDate: string;
  createdAt: string; updatedAt: string;
}
export interface Transfer { id: string; from: string; to: string; amountPaise: number; date: string; note: string; createdAt: string; updatedAt: string }

export type HoldingKind = "fd" | "ppf" | "epf" | "nps" | "mf" | "stocks" | "gold" | "property" | "other" | "loan";
export const HOLDING_KINDS: HoldingKind[] = ["fd", "ppf", "epf", "nps", "mf", "stocks", "gold", "property", "other", "loan"];
export interface Holding { id: string; name: string; kind: HoldingKind; valuePaise: number; createdAt: string; updatedAt: string }
export const isLiability = (k: HoldingKind) => k === "loan";

export interface Goal { id: string; name: string; targetPaise: number; byMonth: string | null; added: { date: string; paise: number }[]; createdAt: string; updatedAt: string }

/** Balance of an account now: opening balance, plus money in, minus spends and investments, plus/minus transfers. */
export function balanceOf(a: Account, rows: Expense[], transfers: Transfer[]): number {
  let b = a.openingPaise;
  for (const e of rows) {
    if (e.accountId !== a.id || e.date < a.openingDate) continue;
    b += kindOf(e.category) === "in" ? e.amountPaise : -e.amountPaise;
  }
  for (const t of transfers) {
    if (t.date < a.openingDate) continue;
    if (t.to === a.id) b += t.amountPaise;
    if (t.from === a.id) b -= t.amountPaise;
  }
  return b;
}

/** Card spending this month (what will show on the coming bill, roughly). */
export const cardThisMonth = (a: Account, rows: Expense[], now: string) =>
  rows.filter(e => e.accountId === a.id && monthOf(e.date) === monthOf(now) && kindOf(e.category) !== "in").reduce((s, e) => s + e.amountPaise, 0);

export function netWorth(accounts: Account[], rows: Expense[], transfers: Transfer[], holdings: Holding[]) {
  const acc = accounts.reduce((s, a) => s + balanceOf(a, rows, transfers), 0);
  const owned = holdings.filter(h => !isLiability(h.kind)).reduce((s, h) => s + h.valuePaise, 0);
  const owed = holdings.filter(h => isLiability(h.kind)).reduce((s, h) => s + h.valuePaise, 0);
  return { accounts: acc, owned, owed, total: acc + owned - owed };
}

/** Saved so far, what's left, and how much a month it takes to finish by the target month. */
export function goalProgress(g: Goal, now: string) {
  const saved = g.added.reduce((s, x) => s + x.paise, 0);
  const left = Math.max(g.targetPaise - saved, 0);
  let months: number | null = null;
  if (g.byMonth) {
    let n = 0, m = monthOf(now);
    while (m <= g.byMonth && n < 600) { n++; m = addMonths(m, 1); }
    months = n; // this month counts
  }
  const perMonth = months === null ? null : months > 0 ? Math.ceil(left / months / 100) * 100 : left;
  return { saved, left, done: saved >= g.targetPaise, months, perMonth, share: g.targetPaise ? Math.min(saved / g.targetPaise, 1) : 0 };
}
