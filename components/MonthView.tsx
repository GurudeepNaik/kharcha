"use client";

// Where the month's money went: totals, how it compares with last month, spend per day, the last
// six months, and one row per category (with its budget when one is set).
import { useState } from "react";
import { type Category, type SpendCategory } from "@/lib/categories";
import { addMonths, monthOf } from "@/lib/dates";
import { monthText, useI18n } from "@/lib/i18n";
import { rupees } from "@/lib/money";
import { byCategory, incomes, inMonth, invests, spends, sum } from "@/lib/totals";
import { dailySpend, monthTotals, vsLastMonth } from "@/lib/trends";
import type { Expense, Repeat, Settings } from "@/lib/types";
import { insights, type Insight } from "@/lib/insights";
import { dateText } from "@/lib/i18n";
import { BarChart } from "./BarChart";
import { LimitLine } from "./LimitLine";
import { TaxCard } from "./TaxCard";
import { Icon, SpendRow, Svg, card } from "./ui";
import { YearView } from "./YearView";

type Props = {
  rows: Expense[]; now: string; settings: Settings; repeats: Repeat[]; onOpen: (e: Expense) => void; isRepeating: (e: Expense) => boolean;
  onSettings: (s: Partial<Settings>) => Promise<void>;
};

/** Month or Year, switched at the top. */
export function MonthView(props: Props) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"month" | "year">("month");
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label={`${t.year.month} / ${t.year.year}`} className="mx-auto grid max-w-xs grid-cols-2 rounded-full border border-line bg-card p-1">
        {(["month", "year"] as const).map(m => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} data-testid={`mode-${m}`}
            className="press min-h-10 rounded-full text-[14px] font-semibold text-muted aria-checked:bg-accent aria-checked:text-accent-fg">{m === "month" ? t.year.month : t.year.year}</button>
        ))}
      </div>
      {mode === "month" ? <MonthBody {...props} /> : <YearView rows={props.rows} now={props.now} />}
    </div>
  );
}

function MonthBody({ rows, now, settings, repeats, onOpen, isRepeating, onSettings }: Props) {
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
  const inv = invests(all);
  const invested = sum(inv);
  const left = moneyIn - total - invested;
  // Investments and insurance by type: this month and everything so far.
  const invAll = byCategory(invests(rows));
  const invMonth = new Map(byCategory(inv).map(c => [c.category, c.paise]));
  const cats = byCategory(list);
  const vs = vsLastMonth(rows, month, now);
  const daily = dailySpend(rows, month, now);
  const six = monthTotals(rows, month, 6);
  const isCurrent = month === current;
  const notes = insights(rows, month, now, repeats, settings.monthlyLimitPaise);
  const noteText = (n: Insight): string => {
    switch (n.kind) {
      case "catUp": return t.notes.catUp(t.cat[n.category], n.pct, n.now, n.then);
      case "catDown": return t.notes.catDown(t.cat[n.category], n.pct, n.now, n.then);
      case "often": return t.notes.often(n.note, n.count, n.paise);
      case "repeats": return t.notes.repeats(n.count, n.paise);
      case "pace": return n.limit && n.projected > n.limit ? t.notes.paceOver(n.projected, n.limit) : t.notes.pace(n.projected);
      case "biggest": return t.notes.biggest(n.note || t.cat[n.category], n.paise, dateText(n.date, i));
    }
  };

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
        {(moneyIn > 0 || invested > 0) && (
          <dl className="mt-3 space-y-1 border-t border-line pt-3" data-testid="month-in">
            {moneyIn > 0 && <div className="flex justify-between gap-3"><dt className="text-sm text-muted">{t.month.moneyIn}</dt><dd className="num font-bold text-accent">+{rupees(moneyIn)}</dd></div>}
            {invested > 0 && <div className="flex justify-between gap-3"><dt className="text-sm text-muted">{t.home.invested}</dt><dd className="num font-bold">{rupees(invested)}</dd></div>}
            {moneyIn > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-sm text-muted">{left >= 0 ? t.month.saved : t.month.overspent}</dt>
                <dd className={`num font-bold ${left < 0 ? "text-bad" : ""}`} data-testid="month-left">{rupees(Math.abs(left))}</dd>
              </div>
            )}
          </dl>
        )}
        {isCurrent && settings.monthlyLimitPaise && <LimitLine spent={total} limit={settings.monthlyLimitPaise} month={month} now={now} />}
      </div>

      {notes.length > 0 && (
        <section aria-labelledby="notes-title" className={`${card} p-4`} data-testid="notes">
          <h2 id="notes-title" className="font-semibold">{t.notes.title}</h2>
          <ul className="mt-1.5 space-y-1.5 text-[14px]">
            {notes.map((n, k) => (
              <li key={k} className={`num flex gap-2 ${n.kind === "pace" && n.limit && n.projected > n.limit ? "font-medium text-bad" : ""}`}>
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />{noteText(n)}
              </li>
            ))}
          </ul>
        </section>
      )}

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

      {invAll.length > 0 && (
        <section aria-labelledby="inv-title" className={`${card} p-4`} data-testid="invest-summary">
          <h2 id="inv-title" className="font-semibold">{t.home.invested}</h2>
          <table className="num mt-2 w-full text-[14px]">
            <thead><tr className="text-left text-[13px] text-muted"><th className="py-1 font-medium"><span className="sr-only">{t.add.category}</span></th><th className="py-1 text-right font-medium">{t.month.thisMonth}</th><th className="py-1 text-right font-medium">{t.month.allTime}</th></tr></thead>
            <tbody className="divide-y divide-line">
              {invAll.map(c => (
                <tr key={c.category}><td className="py-1.5 pe-2">{t.cat[c.category]}</td><td className="py-1.5 text-right">{invMonth.get(c.category) ? rupees(invMonth.get(c.category)!) : "–"}</td><td className="py-1.5 text-right font-semibold">{rupees(c.paise)}</td></tr>
              ))}
            </tbody>
          </table>
          {inv.length > 0 && (
            <ul className="-mx-4 mt-2 divide-y divide-line border-t border-line">
              {inv.map(e => <SpendRow key={e.id} e={e} onOpen={onOpen} repeating={isRepeating(e)} />)}
            </ul>
          )}
        </section>
      )}

      <TaxCard key={month} rows={rows} month={month} now={now} settings={settings} onSettings={onSettings} onOpen={onOpen} />

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
