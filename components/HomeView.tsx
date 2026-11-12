"use client";

// Home: today and this month at a glance, budget warnings, and recent entries (with search and filters).
import { useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { CATEGORIES, type SpendCategory } from "@/lib/categories";
import { monthOf } from "@/lib/dates";
import { dateText, dayText, monthText, useI18n } from "@/lib/i18n";
import { dueSoon, monthTotals, type PlanItem } from "@/lib/plan";
import { rupees } from "@/lib/money";
import { EMPTY_FILTER, filterRows, isFiltering, type Filter } from "@/lib/search";
import { byCategory, byDay, incomes, inMonth, invests, onDay, spends, sum } from "@/lib/totals";
import type { Expense, Settings } from "@/lib/types";
import { InHandCard } from "./InHandCard";
import { LimitLine } from "./LimitLine";
import type { Debt } from "@/lib/debts";
import type { InHand } from "@/lib/inhand";
import type { Account, Transfer } from "@/lib/wealth";
import { Icon, SpendRow, Svg, card } from "./ui";

const PAGE = 60;
const DAY_MS = 86_400_000;

export function HomeView({ rows, debts, accounts, transfers, onInHand, now, settings, plan, onSkip, onPayments, onOpen, onMonth, onBackup, isRepeating }: {
  rows: Expense[]; debts: Debt[]; accounts: Account[]; transfers: Transfer[]; onInHand: (v: InHand) => Promise<void>;
  now: string; settings: Settings; plan: PlanItem[]; onSkip: (it: PlanItem, month: string, skip: boolean) => Promise<void>; onPayments: () => void;
  onOpen: (e: Expense) => void; onMonth: () => void; onBackup: () => void; isRepeating: (e: Expense) => boolean;
}) {
  const i = useI18n();
  const { t } = i;
  const [shown, setShown] = useState(PAGE);
  const [searching, setSearching] = useState(false);
  const [f, setF] = useState<Filter>(EMPTY_FILTER);

  const month = monthOf(now);
  const monthRows = inMonth(rows, month);
  const todaySpent = sum(spends(onDay(rows, now)));
  const monthSpent = sum(spends(monthRows));
  const monthIn = sum(incomes(monthRows));
  const monthInvest = sum(invests(monthRows));
  const left = monthIn - monthSpent - monthInvest;
  const oldest = rows.length ? Date.parse(rows.reduce((a, e) => (e.createdAt < a ? e.createdAt : a), rows[0]!.createdAt)) : Date.now();
  const since = settings.lastBackupAt ? Date.parse(settings.lastBackupAt) : oldest;
  const needBackup = rows.length >= 20 && Date.now() - since >= 30 * DAY_MS;

  // Categories at 85% or more of their budget this month.
  const warnings = byCategory(spends(monthRows))
    .map(c => ({ ...c, budget: settings.categoryLimits[c.category as SpendCategory] ?? 0 }))
    .filter(c => c.budget > 0 && c.paise >= c.budget * 0.85);

  const soon = dueSoon(plan, rows, now, 7);
  const pt = monthTotals(plan, rows, monthOf(now), now);
  const filtering = searching && isFiltering(f);
  const list = filtering ? filterRows(rows, f) : rows;
  const days = byDay(list.slice(0, shown));
  const months = [...new Set(rows.map(e => monthOf(e.date)))];
  const set = (p: Partial<Filter>) => { setF(cur => ({ ...cur, ...p })); setShown(PAGE); };
  const sel = "field min-h-11 py-2 text-[14px]";

  return (
    <>
      <h1 className="sr-only">{t.home.h1(APP_NAME)}</h1>
      <div className="grid grid-cols-2 gap-3">
        <div className={`${card} p-4`}>
          <p className="text-sm text-muted">{t.home.spentToday}</p>
          <p className="num mt-0.5 text-2xl font-bold" data-testid="today-total">{rupees(todaySpent)}</p>
        </div>
        <button type="button" onClick={onMonth} className={`press ${card} p-4 text-left`}>
          <p className="text-sm text-muted">{t.home.spentMonth}</p>
          <p className="num mt-0.5 text-2xl font-bold" data-testid="home-month-total">{rupees(monthSpent)}</p>
        </button>
      </div>
      <InHandCard value={settings.inHand} rows={rows} debts={debts} accounts={accounts} transfers={transfers} now={now} onSet={onInHand} />
      {(monthIn > 0 || monthInvest > 0) && (
        <dl className={`mt-3 space-y-1.5 ${card} p-4`} data-testid="money-in">
          {monthIn > 0 && <div className="flex items-baseline justify-between gap-3"><dt className="text-sm text-muted">{t.home.moneyIn}</dt><dd className="num text-lg font-bold text-accent">+{rupees(monthIn)}</dd></div>}
          {monthInvest > 0 && <div className="flex items-baseline justify-between gap-3"><dt className="text-sm text-muted">{t.home.invested}</dt><dd className="num text-lg font-bold" data-testid="invested">{rupees(monthInvest)}</dd></div>}
          {monthIn > 0 && (
            <div className="flex items-baseline justify-between gap-3 border-t border-line pt-1.5">
              <dt className="text-sm text-muted">{left >= 0 ? t.home.left : t.home.overspent}</dt>
              <dd className={`num text-lg font-bold ${left < 0 ? "text-bad" : ""}`} data-testid="left">{rupees(Math.abs(left))}</dd>
            </div>
          )}
        </dl>
      )}
      {settings.monthlyLimitPaise && (
        <div className={`mt-3 ${card} px-4 pt-1 pb-3`}>
          <LimitLine spent={monthSpent} limit={settings.monthlyLimitPaise} month={month} now={now} />
        </div>
      )}
      {warnings.length > 0 && (
        <ul className={`mt-3 space-y-1 ${card} p-3 ps-4 text-[14px]`} data-testid="budget-warnings">
          {warnings.map(w => (
            <li key={w.category} className={`num flex items-center gap-2 ${w.paise > w.budget ? "font-semibold text-bad" : "text-fg"}`}>
              <span aria-hidden className={`size-2 shrink-0 rounded-full ${w.paise > w.budget ? "bg-bad" : "bg-warn"}`} />
              {w.paise > w.budget ? t.home.budgetOver(t.cat[w.category], w.paise - w.budget, w.budget) : t.home.budgetNear(t.cat[w.category], w.budget - w.paise, w.budget)}
            </li>
          ))}
        </ul>
      )}

      {pt.count > 0 && (
        <button type="button" onClick={onPayments} className={`press mt-3 block w-full ${card} p-4 text-left`} data-testid="home-payments">
          <span className="flex items-baseline justify-between gap-2"><span className="font-semibold">{t.pay.home}</span><span className="text-[13px] font-semibold text-accent">{t.pay.open} ›</span></span>
          <span className="num mt-0.5 block text-[14px] text-muted">{t.pay.homeText(pt.done, pt.count, pt.left)}</span>
          <span className="mt-2 block h-2 overflow-hidden rounded-full bg-soft" aria-hidden><span className="bar block h-full rounded-full bg-accent" style={{ width: `${pt.toPay ? Math.max(Math.min(pt.paid / pt.toPay, 1) * 100, pt.paid ? 1.5 : 0) : 0}%` }} /></span>
        </button>
      )}

      {soon.length > 0 && (
        <section aria-labelledby="soon-title" className={`mt-3 ${card} p-4`} data-testid="upcoming">
          <h2 id="soon-title" className="font-semibold">{t.home.upcoming}</h2>
          <p className="text-[13px] text-muted">{t.home.upcomingHelp}</p>
          <ul className="mt-1 divide-y divide-line">
            {soon.map(({ it, date }) => (
              <li key={it.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{it.name} {it.amountPaise ? <span className="num">{rupees(it.amountPaise)}</span> : null}</span>
                  <span className="block text-[13px] text-muted">{dateText(date, i)}{it.autoPay ? ` · ${t.pay.auto}` : ""}</span>
                </span>
                <button type="button" onClick={() => void onSkip(it, monthOf(date), true)} className="press min-h-11 shrink-0 rounded-xl border border-line px-4 text-[14px] font-semibold">{t.home.skip}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {needBackup && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-warn-soft p-3 ps-4 text-[14px]" role="note">
          <p className="flex-1">{t.home.backupNudge}</p>
          <button type="button" onClick={onBackup} className="press min-h-11 shrink-0 rounded-xl bg-card px-3 font-semibold">{t.home.backupBtn}</button>
        </div>
      )}

      <section aria-labelledby="recent" className="mt-6">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 id="recent" className="text-sm font-semibold text-muted">{t.home.recent}</h2>
          {rows.length > 0 && (
            <button type="button" onClick={() => { setSearching(s => !s); setF(EMPTY_FILTER); }} aria-expanded={searching} aria-controls="search-panel"
              aria-label={t.search.open} className={`press grid size-11 place-items-center rounded-full ${searching ? "bg-accent-soft text-fg" : "text-muted"}`}>
              <Svg size={20}>{Icon.search}</Svg>
            </button>
          )}
        </div>

        {searching && (
          <div id="search-panel" role="search" className={`mb-3 ${card} p-3`}>
            <label htmlFor="q" className="sr-only">{t.search.label}</label>
            <input id="q" type="search" value={f.q} onChange={e => set({ q: e.target.value })} placeholder={t.search.placeholder} autoComplete="off" className="field" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select aria-label={t.add.category} value={f.category} onChange={e => set({ category: e.target.value as Filter["category"] })} className={sel}>
                <option value="">{t.search.anyCat}</option>
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{t.cat[c.key]}</option>)}
              </select>
              <select aria-label={t.add.paidBy} value={f.method} onChange={e => set({ method: e.target.value as Filter["method"] })} className={sel}>
                <option value="">{t.search.anyPay}</option><option value="upi">{t.upi}</option><option value="cash">{t.cash}</option><option value="none">{t.notSet}</option>
              </select>
              <select aria-label={t.search.kindAll} value={f.kind} onChange={e => set({ kind: e.target.value as Filter["kind"] })} className={sel}>
                <option value="">{t.search.kindAll}</option><option value="out">{t.search.kindOut}</option><option value="in">{t.search.kindIn}</option><option value="invest">{t.search.kindInvest}</option>
              </select>
              <select aria-label={t.search.anyMonth} value={f.month} onChange={e => set({ month: e.target.value })} className={sel}>
                <option value="">{t.search.anyMonth}</option>
                {months.map(m => <option key={m} value={m}>{monthText(m, i)}</option>)}
              </select>
            </div>
            {isFiltering(f) && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="num text-[14px] font-medium" aria-live="polite" data-testid="search-summary">{t.search.results(list.length, sum(spends(list)), sum(incomes(list)))}</p>
                <button type="button" onClick={() => setF(EMPTY_FILTER)} className="press min-h-11 shrink-0 rounded-xl px-3 text-[14px] font-semibold underline underline-offset-2">{t.search.clear}</button>
              </div>
            )}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-6 text-center">
            <p className="font-medium">{t.home.empty}</p>
            <p className="mt-1 text-sm text-muted">{t.home.emptyHint}</p>
          </div>
        ) : filtering && list.length === 0 ? (
          <p className="py-6 text-center text-muted">{t.search.none}</p>
        ) : (
          <div className="space-y-3" data-testid="recent-list">
            {days.map(d => (
              <div key={d.date} className={`overflow-hidden ${card}`}>
                <h3 className="flex items-baseline justify-between border-b border-line px-4 py-2 text-[13px] font-semibold text-muted">
                  <span>{dayText(d.date, now, i)}</span>{d.paise > 0 && <span className="num">{t.home.daySpent(d.paise)}</span>}
                </h3>
                <ul className="divide-y divide-line">{d.rows.map(e => <SpendRow key={e.id} e={e} onOpen={onOpen} repeating={isRepeating(e)} />)}</ul>
              </div>
            ))}
            {list.length > shown && (
              <button type="button" onClick={() => setShown(s => s + PAGE)} className={`press min-h-12 w-full ${card} font-semibold`}>{t.home.older}</button>
            )}
          </div>
        )}
      </section>
    </>
  );
}
