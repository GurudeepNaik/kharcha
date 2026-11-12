// Comparisons over time, all on spends only.
import { addDays, addMonths, monthOf } from "./dates";
import { spends, sum } from "./totals";
import type { Expense } from "./types";

/** Spend for each day of the month (index 0 = day 1), up to today when it's the current month. */
export function dailySpend(rows: Expense[], month: string, now: string): number[] {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const days = new Date(y, m, 0).getDate();
  const upto = monthOf(now) === month ? Number(now.slice(8)) : days;
  const out = Array.from({ length: upto }, () => 0);
  for (const e of spends(rows)) if (monthOf(e.date) === month) { const d = Number(e.date.slice(8)); if (d <= upto) out[d - 1]! += e.amountPaise; }
  return out;
}

/** Spend per month for the `n` months ending with `month`, oldest first. */
export function monthTotals(rows: Expense[], month: string, n = 6): { month: string; paise: number }[] {
  const out = Array.from({ length: n }, (_, i) => ({ month: addMonths(month, i - n + 1), paise: 0 }));
  const idx = new Map(out.map((o, i) => [o.month, i]));
  for (const e of spends(rows)) { const i = idx.get(monthOf(e.date)); if (i !== undefined) out[i]!.paise += e.amountPaise; }
  return out;
}

/**
 * This month so far against last month up to the same day (a fair comparison mid-month).
 * Null when there's nothing last month to compare with.
 */
export function vsLastMonth(rows: Expense[], month: string, now: string): { now: number; then: number } | null {
  const prev = addMonths(month, -1);
  const isCurrent = monthOf(now) === month;
  const day = isCurrent ? Number(now.slice(8)) : 31;
  const s = spends(rows);
  const prevRows = s.filter(e => monthOf(e.date) === prev);
  if (!prevRows.length) return null;
  const cut = isCurrent ? addDays(`${prev}-01`, day - 1) : `${prev}-31`;
  // addDays past the month end rolls into this month; clamp to last month.
  const limit = cut.slice(0, 7) === prev ? cut : `${prev}-31`;
  return { now: sum(s.filter(e => monthOf(e.date) === month && (!isCurrent || e.date <= now))), then: sum(prevRows.filter(e => e.date <= limit)) };
}
