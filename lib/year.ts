// Year in review (January to December).
import type { Category } from "./categories";
import { byCategory, incomes, invests, spends, sum } from "./totals";
import type { Expense } from "./types";

export interface YearReview {
  year: number; count: number;
  moneyIn: number; spent: number; invested: number; left: number;
  /** Share of money in that wasn't spent (invested or left), 0–100; null with no money in. */
  keptPct: number | null;
  topCats: { category: Category; paise: number }[];
  months: { month: string; spent: number }[];
  highest: { month: string; spent: number } | null;
  lowest: { month: string; spent: number } | null;
  biggest: Expense | null;
  investByCat: { category: Category; paise: number }[];
  noSpendDays: number;
}

export function yearReview(rows: Expense[], year: number, now: string): YearReview {
  const ys = String(year);
  const all = rows.filter(e => e.date.startsWith(ys));
  const s = spends(all), inn = incomes(all), inv = invests(all);
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = `${ys}-${String(i + 1).padStart(2, "0")}`;
    return { month: m, spent: sum(s.filter(e => e.date.startsWith(m))) };
  });
  // Only months that have started (and had any entries) compete for lowest.
  const started = months.filter(m => m.month <= now.slice(0, 7) && all.some(e => e.date.startsWith(m.month)));
  const sorted = [...started].sort((a, b) => b.spent - a.spent);
  const moneyIn = sum(inn), spent = sum(s), invested = sum(inv);
  // Days so far this year with no spend at all.
  const last = now.startsWith(ys) ? now : `${ys}-12-31`;
  const first = `${ys}-01-01`;
  const dayCount = Math.round((Date.parse(last) - Date.parse(first)) / 86_400_000) + 1;
  const spendDays = new Set(s.map(e => e.date)).size;
  return {
    year, count: all.length, moneyIn, spent, invested, left: moneyIn - spent - invested,
    keptPct: moneyIn > 0 ? Math.max(0, Math.round(((moneyIn - spent) / moneyIn) * 100)) : null,
    topCats: byCategory(s).slice(0, 5).map(c => ({ category: c.category, paise: c.paise })),
    months,
    highest: sorted[0] ?? null,
    lowest: sorted.length > 1 ? sorted[sorted.length - 1]! : null,
    biggest: [...s].sort((a, b) => b.amountPaise - a.amountPaise)[0] ?? null,
    investByCat: byCategory(inv).map(c => ({ category: c.category, paise: c.paise })),
    noSpendDays: all.length ? Math.max(dayCount - spendDays, 0) : 0,
  };
}
