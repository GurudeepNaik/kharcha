"use client";

// Tax saving for one financial year: how much of each deduction limit is used, and which entries count.
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { fyOf, fyRange, prevFy, taxSummary, type TaxLine } from "@/lib/tax";
import type { Expense, Settings } from "@/lib/types";
import { Icon, SpendRow, Svg, card } from "./ui";

export function TaxCard({ rows, month, now, settings, onSettings, onOpen }: {
  rows: Expense[]; month: string; now: string; settings: Settings;
  onSettings: (s: Partial<Settings>) => Promise<void>; onOpen: (e: Expense) => void;
}) {
  const { t } = useI18n();
  const [fy, setFy] = useState(() => fyOf(`${month}-01`));
  const [open, setOpen] = useState<TaxLine["tag"] | null>(null);
  const lines = taxSummary(rows, fy, { self: settings.seniorSelf, parents: settings.seniorParents });
  const current = fyOf(now);
  const earliest = rows.length ? fyOf(rows[rows.length - 1]!.date) : current;
  const any = lines.some(l => l.paid > 0);
  const next = fyOf(`${fyRange(fy).to.slice(0, 4)}-06-01`);

  return (
    <section aria-labelledby="tax-title" className={`${card} p-4`} data-testid="tax">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => { setFy(prevFy(fy)); setOpen(null); }} disabled={fy <= earliest} aria-label={t.tax.prev}
          className="press grid size-11 shrink-0 place-items-center rounded-full disabled:opacity-30"><Svg size={20}>{Icon.left}</Svg></button>
        <h2 id="tax-title" className="text-center font-semibold" aria-live="polite">{t.tax.title(fy)}</h2>
        <button type="button" onClick={() => { setFy(next); setOpen(null); }} disabled={fy >= current} aria-label={t.tax.next}
          className="press grid size-11 shrink-0 place-items-center rounded-full disabled:opacity-30"><Svg size={20}>{Icon.right}</Svg></button>
      </div>
      <p className="mt-1 text-[13px] text-muted">{t.tax.oldOnly}</p>

      {!any ? (
        <p className="mt-3 text-sm text-muted">{t.tax.empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {lines.filter(l => l.paid > 0 || l.tag === "c").map(l => {
            const share = Math.min(l.counted / l.limit, 1);
            const isOpen = open === l.tag;
            return (
              <li key={l.tag} data-testid={`tax-${l.tag}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-medium">{t.tax[l.tag]}</span>
                  <span className="num shrink-0 text-[14px] font-semibold">{t.tax.of(l.counted, l.limit)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-soft" aria-hidden>
                  <div className="bar h-full rounded-full bg-accent" style={{ width: `${Math.max(share * 100, l.counted ? 1.5 : 0)}%` }} />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="num text-[13px] text-muted">
                    {l.tag === "nps" && l.paid > l.limit ? t.tax.npsSpill(l.paid - l.limit) : l.paid > l.limit ? t.tax.over(l.paid - l.limit) : l.counted >= l.limit ? t.tax.full : t.tax.more(l.limit - l.counted)}
                  </span>
                  {l.rows.length > 0 && (
                    <button type="button" onClick={() => setOpen(isOpen ? null : l.tag)} aria-expanded={isOpen}
                      className="press min-h-11 shrink-0 rounded-lg px-2 text-[13px] font-medium underline underline-offset-2">
                      {isOpen ? t.tax.hide : t.tax.show}
                    </button>
                  )}
                </div>
                {isOpen && <ul className="-mx-4 mt-1 divide-y divide-line border-y border-line">{l.rows.map(e => <SpendRow key={e.id} e={e} onOpen={onOpen} />)}</ul>}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 space-y-1 border-t border-line pt-3">
        {([["seniorSelf", t.tax.seniorSelf], ["seniorParents", t.tax.seniorParents]] as const).map(([k, label]) => (
          <label key={k} className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px]">
            <input type="checkbox" checked={settings[k]} onChange={e => void onSettings({ [k]: e.target.checked })} className="size-5 accent-[var(--accent)]" data-testid={k} />
            {label}
          </label>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-muted">{t.tax.adviser}</p>
    </section>
  );
}
