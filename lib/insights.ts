// Short notes about the month, worked out on the phone: what changed, where money keeps going, what's coming.
import { kindOf, type Category } from "./categories";
import { addDays, addMonths, monthOf } from "./dates";
import { byCategory, inMonth, spends, sum } from "./totals";
import type { Expense } from "./types";

export type Insight =
  | { kind: "catUp" | "catDown"; category: Category; now: number; then: number; pct: number }
  | { kind: "often"; note: string; count: number; paise: number }
  | { kind: "repeats"; count: number; paise: number }
  | { kind: "pace"; projected: number; limit: number | null }
  | { kind: "biggest"; note: string; category: Category; paise: number; date: string };

const MIN_NOW = 500_00, MIN_THEN = 200_00, MIN_PCT = 30;

export function insights(rows: Expense[], month: string, now: string, repeats: { category: Category; amountPaise: number }[], limit: number | null): Insight[] {
  const out: Insight[] = [];
  const isCurrent = monthOf(now) === month;
  const day = isCurrent ? Number(now.slice(8)) : 31;
  const cur = spends(inMonth(rows, month)).filter(e => !isCurrent || e.date <= now);
  const prevMonth = addMonths(month, -1);
  const cut = isCurrent ? addDays(`${prevMonth}-01`, day - 1) : `${prevMonth}-31`;
  const prev = spends(inMonth(rows, prevMonth)).filter(e => e.date <= (cut.startsWith(prevMonth) ? cut : `${prevMonth}-31`));

  // 1. Biggest change by category, against last month up to the same day.
  const prevBy = new Map(byCategory(prev).map(c => [c.category, c.paise]));
  const changes = byCategory(cur).map(c => ({ c, then: prevBy.get(c.category) ?? 0 }))
    .filter(x => x.c.paise >= MIN_NOW && x.then >= MIN_THEN)
    .map(x => ({ ...x, pct: Math.round(((x.c.paise - x.then) / x.then) * 100) }))
    .filter(x => Math.abs(x.pct) >= MIN_PCT)
    .sort((a, b) => Math.abs(b.c.paise - b.then) - Math.abs(a.c.paise - a.then));
  for (const x of changes.slice(0, 2)) out.push({ kind: x.pct > 0 ? "catUp" : "catDown", category: x.c.category, now: x.c.paise, then: x.then, pct: Math.abs(x.pct) });

  // 2. Where money keeps going: the same first word 3+ times this month.
  const often = new Map<string, { count: number; paise: number; label: string }>();
  for (const e of cur) {
    const w = e.note.trim().split(/\s+/)[0]?.toLowerCase();
    if (!w || w.length < 3) continue;
    const o = often.get(w) ?? { count: 0, paise: 0, label: e.note.trim().split(/\s+/)[0]! };
    o.count++; o.paise += e.amountPaise; often.set(w, o);
  }
  const top = [...often.values()].filter(o => o.count >= 3).sort((a, b) => b.paise - a.paise)[0];
  if (top) out.push({ kind: "often", note: top.label, count: top.count, paise: top.paise });

  // 3. What leaves every month on its own (spends, investments, insurance on Every month).
  const outRules = repeats.filter(r => kindOf(r.category) !== "in");
  if (outRules.length) out.push({ kind: "repeats", count: outRules.length, paise: outRules.reduce((s, r) => s + r.amountPaise, 0) });

  // 4. Where the month is heading (from the 5th, so a few days don't mislead).
  if (isCurrent && day >= 5 && cur.length) {
    const [y, m] = month.split("-").map(Number) as [number, number];
    const days = new Date(y, m, 0).getDate();
    out.push({ kind: "pace", projected: Math.round(sum(cur) / day * days / 100) * 100, limit });
  }

  // 5. The biggest single spend.
  const big = [...cur].sort((a, b) => b.amountPaise - a.amountPaise)[0];
  if (big && cur.length >= 3) out.push({ kind: "biggest", note: big.note, category: big.category, paise: big.amountPaise, date: big.date });
  return out;
}
