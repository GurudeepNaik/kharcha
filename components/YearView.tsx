"use client";

// Year in review (January to December).
import { useState } from "react";
import { dateText, monthText, useI18n } from "@/lib/i18n";
import { rupees } from "@/lib/money";
import { yearReview } from "@/lib/year";
import type { Expense } from "@/lib/types";
import { BarChart } from "./BarChart";
import { Icon, Svg, card } from "./ui";

export function YearView({ rows, now }: { rows: Expense[]; now: string }) {
  const i = useI18n();
  const { t } = i;
  const thisYear = Number(now.slice(0, 4));
  const first = rows.length ? Number(rows[rows.length - 1]!.date.slice(0, 4)) : thisYear;
  const [year, setYear] = useState(thisYear);
  const y = yearReview(rows, year, now);
  const max = Math.max(...y.topCats.map(c => c.paise), 1);

  return (
    <div className="space-y-4" data-testid="year">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setYear(v => v - 1)} disabled={year <= first} aria-label={t.year.prev} className="press grid size-11 place-items-center rounded-full border border-line bg-card disabled:opacity-35"><Svg>{Icon.left}</Svg></button>
        <h2 className="text-lg font-bold" aria-live="polite">{t.year.title(year)}</h2>
        <button type="button" onClick={() => setYear(v => v + 1)} disabled={year >= thisYear} aria-label={t.year.next} className="press grid size-11 place-items-center rounded-full border border-line bg-card disabled:opacity-35"><Svg>{Icon.right}</Svg></button>
      </div>

      {y.count === 0 ? <p className="text-center text-muted">{t.year.none(year)}</p> : (
        <>
          <div className={`${card} p-4`}>
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="text-sm text-muted">{t.home.moneyIn}</dt><dd className="num text-xl font-bold text-accent" data-testid="year-in">+{rupees(y.moneyIn)}</dd></div>
              <div><dt className="text-sm text-muted">{t.add.spent}</dt><dd className="num text-xl font-bold" data-testid="year-spent">{rupees(y.spent)}</dd></div>
              <div><dt className="text-sm text-muted">{t.home.invested}</dt><dd className="num text-xl font-bold">{rupees(y.invested)}</dd></div>
              <div><dt className="text-sm text-muted">{y.left >= 0 ? t.month.saved : t.month.overspent}</dt><dd className={`num text-xl font-bold ${y.left < 0 ? "text-bad" : ""}`}>{rupees(Math.abs(y.left))}</dd></div>
            </dl>
            <ul className="mt-3 space-y-1 border-t border-line pt-3 text-[14px]">
              {y.keptPct !== null && <li className="font-medium">{t.year.kept(y.keptPct)}</li>}
              {y.highest && <li className="num">{t.year.highest(monthText(y.highest.month, i), y.highest.spent)}</li>}
              {y.lowest && <li className="num">{t.year.lowest(monthText(y.lowest.month, i), y.lowest.spent)}</li>}
              {y.biggest && <li className="num">{t.notes.biggest(y.biggest.note || t.cat[y.biggest.category], y.biggest.amountPaise, dateText(y.biggest.date, i))}</li>}
              <li>{t.year.noSpend(y.noSpendDays)} · {t.year.entries(y.count)}</li>
            </ul>
          </div>

          <BarChart testid="year-chart" title={t.year.months}
            bars={y.months.map(m => ({ key: m.month, label: monthText(m.month, i), short: monthText(m.month, i, true).slice(0, 3), paise: m.spent, current: m.month === now.slice(0, 7) }))} />

          {y.topCats.length > 0 && (
            <div className={`${card} p-4`}>
              <h3 className="font-semibold">{t.year.top}</h3>
              <ul className="mt-2 space-y-2">
                {y.topCats.map(c => (
                  <li key={c.category}>
                    <div className="flex justify-between gap-3 text-[14px]"><span>{t.cat[c.category]}</span><span className="num font-semibold">{rupees(c.paise)}</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-soft" aria-hidden><div className="bar h-full rounded-full bg-accent" style={{ width: `${Math.max((c.paise / max) * 100, 1.5)}%` }} /></div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {y.investByCat.length > 0 && (
            <div className={`${card} p-4`}>
              <h3 className="font-semibold">{t.home.invested}</h3>
              <ul className="mt-2 divide-y divide-line text-[14px]">
                {y.investByCat.map(c => <li key={c.category} className="flex justify-between gap-3 py-1.5"><span>{t.cat[c.category]}</span><span className="num font-semibold">{rupees(c.paise)}</span></li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
