"use client";

// Where the month's money went: totals, how it compares with last month, spend per day, the last
// six months, and one row per category (with its budget when one is set).
import { useState } from "react";
import { type Category, type SpendCategory } from "@/lib/categories";
import { addMonths, monthOf } from "@/lib/dates";
import { monthText, useI18n } from "@/lib/i18n";
import { rupees } from "@/lib/money";
import { byCategory, incomes, inMonth, spends, sum } from "@/lib/totals";
import { dailySpend, monthTotals, vsLastMonth } from "@/lib/trends";
import type { Expense, Settings } from "@/lib/types";
import { BarChart } from "./BarChart";
import { LimitLine } from "./LimitLine";
import { Icon, SpendRow, Svg, card } from "./ui";

export function MonthView({ rows, now, settings, onOpen, isRepeating }: {
  rows: Expense[]; now: string; settings: Settings; onOpen: (e: Expense) => void; isRepeating: (e: Expense) => boolean;
}) {
  const i = useI18n();
  const { t } = i;
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
  const vs = vsLastMonth(rows, month, now);
  const daily = dailySpend(rows, month, now);
  const six = monthTotals(rows, month, 6);
  const isCurrent = month === current;

  const go = (n: number) => { setMonth(m => addMonths(m, n)); setOpen(null); };
  const name = monthText(month, i);

  let compare: string | null = null;
  if (vs && vs.then > 0) {
    const d = vs.now - vs.then, pct = Math.round((Math.abs(d) / vs.then) * 100);
    compare = d === 0 ? t.month.same : isCurrent ? (d > 0 ? t.month.more(d, pct) : t.month.less(-d, pct)) : d > 0 ? t.month.moreFull(d, pct) : t.month.lessFull(-d, pct);
  }

  return (
    <section aria-labelledby="month-title" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => go(-1)} disabled={month <= earliest} aria-label={t.month.prev}
          className="press grid size-11 place-items-center rounded-full border border-line bg-card disabled:opacity-35"><Svg>{Icon.left}</Svg></button>
        <h1 id="month-title" className="text-lg font-bold" aria-live="polite">{name}</h1>
        <button type="button" onClick={() => go(1)} disabled={month >= current} aria-label={t.month.next}
          className="press grid size-11 place-items-center rounded-full border border-line bg-card disabled:opacity-35"><Svg>{Icon.right}</Svg></button>
      </div>

      <div className={`${card} p-4`}>
        <p className="text-sm text-muted">{t.month.spentIn(monthText(month, i).split(" ")[0]!)}</p>
        <p className="num mt-0.5 text-3xl font-bold" data-testid="month-total">{rupees(total)}</p>
        <p className="mt-0.5 text-sm text-muted">{t.month.count(list.length)}</p>
        {compare && <p className="num mt-2 text-sm" data-testid="vs-last">{compare}</p>}
        {moneyIn > 0 && (
          <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3" data-testid="month-in">
            <div><dt className="text-sm text-muted">{t.month.moneyIn}</dt><dd className="num text-lg font-bold text-accent">+{rupees(moneyIn)}</dd></div>
            <div>
              <dt className="text-sm text-muted">{moneyIn >= total ? t.month.saved : t.month.overspent}</dt>
              <dd className={`num text-lg font-bold ${moneyIn < total ? "text-bad" : ""}`}>{rupees(Math.abs(moneyIn - total))}</dd>
            </div>
          </dl>
        )}
        {isCurrent && settings.monthlyLimitPaise && <LimitLine spent={total} limit={settings.monthlyLimitPaise} month={month} now={now} />}
      </div>

      {total > 0 && (
        <BarChart testid="daily-chart" title={t.month.daily} labelEvery={5} height={96}
          bars={daily.map((p, d) => ({ key: String(d + 1), label: `${d + 1} ${monthText(month, i, true)}`, short: String(d + 1), paise: p, current: isCurrent && d === daily.length - 1 }))} />
      )}

      {cats.length === 0 ? (
        <p className="text-center text-muted">{t.month.none(name)}</p>
      ) : (
        <ul className={`overflow-hidden ${card}`} aria-label={t.month.byCat}>
          {cats.map(c => {
            const budget = settings.categoryLimits[c.category as SpendCategory];
            const share = budget ? Math.min(c.paise / budget, 1) : total ? c.paise / total : 0;
            const pct = Math.round((total ? c.paise / total : 0) * 100);
            const over = budget ? c.paise > budget : false;
            const near = budget ? !over && c.paise / budget >= 0.85 : false;
            const isOpen = open === c.category;
            return (
              <li key={c.category} className="border-b border-line last:border-b-0">
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.category)}
                  className="press block w-full px-4 py-3 text-left hover:bg-soft/60">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{t.cat[c.category]} <span className="text-[13px] font-normal text-muted">· {c.count}</span></span>
                    <span className="num font-semibold">
                      {rupees(c.paise)}{" "}
                      <span className={`text-[13px] font-normal ${over ? "font-semibold text-bad" : "text-muted"}`}>{budget ? t.month.ofBudget(budget) : `${pct < 1 ? "<1" : pct}%`}</span>
                    </span>
                  </span>
                  <span className="mt-2 block h-2 overflow-hidden rounded-full bg-soft" aria-hidden>
                    <span className={`bar block h-full rounded-full ${over ? "bg-bad" : near ? "bg-warn" : "bg-accent"}`} style={{ width: `${Math.max(share * 100, 1.5)}%` }} />
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

      {six.some(m => m.paise > 0) && (
        <BarChart testid="six-chart" title={t.month.six}
          bars={six.map(m => ({ key: m.month, label: monthText(m.month, i), short: monthText(m.month, i, true), paise: m.paise, current: m.month === month }))} />
      )}

      {money.length > 0 && (
        <section aria-labelledby="in-title">
          <h2 id="in-title" className="mb-2 px-1 text-sm font-semibold text-muted">{t.month.moneyIn}</h2>
          <ul className={`divide-y divide-line overflow-hidden ${card}`}>
            {money.map(e => <SpendRow key={e.id} e={e} onOpen={onOpen} repeating={isRepeating(e)} />)}
          </ul>
        </section>
      )}
    </section>
  );
}
