import { isIncomeCategory, isInvestCategory, type Category } from "./categories";
import { monthOf } from "./dates";
import type { Expense } from "./types";

/** Newest day first; within a day, the latest entry first. */
export const sortRows = (rows: Expense[]) =>
  [...rows].sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));

export const sum = (rows: Expense[]) => rows.reduce((s, e) => s + e.amountPaise, 0);
export const isIncome = (e: Expense) => isIncomeCategory(e.category);
export const isInvest = (e: Expense) => isInvestCategory(e.category);
/** Day-to-day spending only: not money in, not investments or insurance. */
export const spends = (rows: Expense[]) => rows.filter(e => !isIncome(e) && !isInvest(e));
/** Investments and insurance. */
export const invests = (rows: Expense[]) => rows.filter(isInvest);
/** Money in only. */
export const incomes = (rows: Expense[]) => rows.filter(isIncome);
export const onDay = (rows: Expense[], date: string) => rows.filter(e => e.date === date);
export const inMonth = (rows: Expense[], month: string) => rows.filter(e => monthOf(e.date) === month);

/** Category totals for a month, biggest first, only categories with spends. */
export function byCategory(rows: Expense[]): { category: Category; paise: number; count: number }[] {
  const m = new Map<Category, { paise: number; count: number }>();
  for (const e of rows) { const t = m.get(e.category) ?? { paise: 0, count: 0 }; t.paise += e.amountPaise; t.count++; m.set(e.category, t); }
  return [...m].map(([category, t]) => ({ category, ...t })).sort((a, b) => b.paise - a.paise);
}

/** Rows grouped by day, newest day first (rows are already sorted). `paise` is what was spent that day. */
export function byDay(rows: Expense[]): { date: string; rows: Expense[]; paise: number }[] {
  const out: { date: string; rows: Expense[]; paise: number }[] = [];
  for (const e of rows) {
    const spent = isIncome(e) || isInvest(e) ? 0 : e.amountPaise;
    const last = out[out.length - 1];
    if (last && last.date === e.date) { last.rows.push(e); last.paise += spent; }
    else out.push({ date: e.date, rows: [e], paise: spent });
  }
  return out;
}
