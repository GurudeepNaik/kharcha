// Monthly repeats: which entries are due, given the rules and today's date. Pure, so it's easy to test.
import { addMonths, monthOf, validDate } from "./dates";
import type { Expense, Repeat } from "./types";

const MAX_CATCH_UP = 24; // months; an app left unopened for years shouldn't flood the list

/** The date in `month` for a rule's day, moved back to the month's last day when needed (31 → 30 Nov). */
export function dayIn(month: string, day: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  for (let d = day; d >= 28; d--) { const v = validDate(y, m, d); if (v) return v; }
  return validDate(y, m, Math.min(day, 28))!;
}

/** The entry id for a rule in a month. Fixed, so running twice (or in two tabs) never makes a duplicate. */
export const repeatEntryId = (ruleId: string, month: string) => `r-${ruleId}-${month}`;

/**
 * Entries now due for every rule (months after `lastMonth`, up to today), and the rules moved forward.
 * A month whose day hasn't come yet waits.
 */
export function dueRepeats(rules: Repeat[], now: string, at: string): { entries: Expense[]; rules: Repeat[] } {
  const entries: Expense[] = [];
  const moved: Repeat[] = [];
  const current = monthOf(now);
  for (const r of rules) {
    let month = r.lastMonth, last = r.lastMonth, n = 0;
    while (month < current && n < MAX_CATCH_UP) {
      month = addMonths(month, 1);
      const date = dayIn(month, r.day);
      if (date > now) break;
      entries.push({
        id: repeatEntryId(r.id, month), amountPaise: r.amountPaise, note: r.note, category: r.category, method: r.method,
        date, createdAt: at, updatedAt: at, repeatId: r.id,
      });
      last = month; n++;
    }
    if (last !== r.lastMonth) moved.push({ ...r, lastMonth: last });
  }
  return { entries, rules: moved };
}

/** The rule an entry starts: same amount and details, on the entry's day, starting from the entry's month. */
export function repeatFrom(e: Expense, id: string, at: string): Repeat {
  return { id, amountPaise: e.amountPaise, note: e.note, category: e.category, method: e.method, day: Number(e.date.slice(8)), lastMonth: monthOf(e.date), createdAt: at };
}

/** When the next one will be added. */
export const nextDate = (r: Repeat) => dayIn(addMonths(r.lastMonth, 1), r.day);
