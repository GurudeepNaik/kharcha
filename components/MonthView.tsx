"use client";

// Where the month's money went: one row per category, biggest first.
import { useState } from "react";
import { categoryLabel, type Category } from "@/lib/categories";
import { addMonths, monthLabel, monthOf } from "@/lib/dates";
import { rupees } from "@/lib/money";
import { byCategory, incomes, inMonth, spends, sum } from "@/lib/totals";
import type { Expense, Settings } from "@/lib/types";
import { LimitLine } from "./LimitLine";
import { Icon, SpendRow, Svg } from "./ui";

export function MonthView({ rows, now, settings, onOpen, isRepeating }: {
  rows: Expense[]; now: string; settings: Settings; onOpen: (e: Expense) => void; isRepeating: (e: Expense) => boolean;
}) {
  const current = monthOf(now);
  const [month, setMonth] = useState(current);
  const [open, setOpen] = useState<Category | null>(null);
  const earliest = rows.length ? monthOf(rows[rows.length - 1]!.date) : current;
  const all = inMonth(rows, month);
  const list = spends(all);
  const money = incomes(all);
  const total = sum(list);
  const moneyIn = sum(money);
  const cats = byCategory(list);
  const inCats = byCategory(money);

  const go = (n: number) => { setMonth(m => addMonths(m, n)); setOpen(null); };

  return (
    <section aria-labelledby="month-title">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => go(-1)} disabled={month <= earliest} aria-label="Previous month"
          className="press grid size-11 place-items-center rounded-full border border-line bg-card disabled:opacity-35"><Svg>{Icon.left}</Svg></button>
        <h1 id="month-title" className="text-lg font-bold" aria-live="polite">{monthLabel(month)}</h1>
        <button type="button" onClick={() => go(1)} disabled={month >= current} aria-label="Next month"
          className="press grid size-11 place-items-center rounded-full border border-line bg-card disabled:opacity-35"><Svg>{Icon.right}</Svg></button>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-card p-4">
        <p className="text-sm text-muted">Spent in {monthLabel(month).split(" ")[0]}</p>
        <p className="num mt-0.5 text-3xl font-bold" data-testid="month-total">{rupees(total)}</p>
        <p className="mt-0.5 text-sm text-muted">{list.length === 1 ? "1 spend" : `${list.length} spends`}</p>
        {moneyIn > 0 && (
          <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3" data-testid="month-in">
            <div><dt className="text-sm text-muted">Money in</dt><dd className="num text-lg font-bold text-accent">+{rupees(moneyIn)}</dd></div>
            <div>
              <dt className="text-sm text-muted">{moneyIn >= total ? "Saved" : "Overspent"}</dt>
              <dd className={`num text-lg font-bold ${moneyIn < total ? "text-bad" : ""}`}>{rupees(Math.abs(moneyIn - total))}</dd>
            </div>
          </dl>
        )}
        {month === current && settings.monthlyLimitPaise && <LimitLine spent={total} limit={settings.monthlyLimitPaise} month={month} now={now} />}
      </div>

      {cats.length === 0 ? (
        <p className="mt-6 text-center text-muted">No spends noted in {monthLabel(month)}.</p>
      ) : (
        <ul className="mt-4 overflow-hidden rounded-2xl border border-line bg-card" aria-label="By category">
          {cats.map(c => {
            const share = total ? c.paise / total : 0;
            const pct = Math.round(share * 100);
            const isOpen = open === c.category;
            return (
              <li key={c.category} className="border-b border-line last:border-b-0">
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.category)}
                  className="press block w-full px-4 py-3 text-left hover:bg-soft/60">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{categoryLabel(c.category)} <span className="text-[13px] font-normal text-muted">· {c.count}</span></span>
                    <span className="num font-semibold">{rupees(c.paise)} <span className="text-[13px] font-normal text-muted">{pct < 1 ? "<1" : pct}%</span></span>
                  </span>
                  <span className="mt-2 block h-2 overflow-hidden rounded-full bg-soft" aria-hidden>
                    <span className="bar block h-full rounded-full bg-accent" style={{ width: `${Math.max(share * 100, 1.5)}%` }} />
                  </span>
                </button>
                {isOpen && (
                  <ul className="border-t border-line bg-bg/40">
                    {list.filter(e => e.category === c.category).map(e => <SpendRow key={e.id} e={e} onOpen={onOpen} repeating={isRepeating(e)} />)}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {inCats.length > 0 && (
        <section aria-labelledby="in-title" className="mt-6">
          <h2 id="in-title" className="mb-2 px-1 text-sm font-semibold text-muted">Money in</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {money.map(e => <SpendRow key={e.id} e={e} onOpen={onOpen} repeating={isRepeating(e)} />)}
          </ul>
        </section>
      )}
    </section>
  );
}
