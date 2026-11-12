"use client";

// One-series column chart: thin columns from one baseline, 4px rounded tops, a 2px gap,
// tap or hover a column for its value, and a table view of the same numbers.
import { useId, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { rupees } from "@/lib/money";

export interface Bar { key: string; label: string; short: string; paise: number; current?: boolean }

export function BarChart({ title, bars, height = 112, labelEvery = 1, testid }: { title: string; bars: Bar[]; height?: number; labelEvery?: number; testid?: string }) {
  const { t } = useI18n();
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const id = useId();
  const max = Math.max(...bars.map(b => b.paise), 1);
  const shown = active !== null ? bars[active] : bars.find(b => b.current) ?? bars[bars.length - 1];

  return (
    <figure className="rounded-2xl border border-line bg-card p-4" data-testid={testid}>
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{title}</span>
        <button type="button" onClick={() => setTable(v => !v)} aria-expanded={table} aria-controls={`${id}-table`}
          className="press min-h-11 shrink-0 rounded-lg px-2 text-[13px] font-medium text-muted underline underline-offset-2">
          {table ? t.month.hideTable : t.month.table}
        </button>
      </figcaption>
      {/* The value under the finger (or the latest), in text tokens, never the bar colour. */}
      <p className="num mt-0.5 min-h-5 text-[13px] text-muted" aria-live="polite">{shown ? t.month.tip(shown.label, shown.paise) : ""}</p>

      <div className="mt-2 flex items-end gap-[2px]" style={{ height }} role="img" aria-label={`${title}. ${bars.map(b => `${b.label} ${rupees(b.paise)}`).join(", ")}`}
        onPointerLeave={() => setActive(null)}>
        {bars.map((b, i) => (
          <div key={b.key} className="flex h-full min-w-0 flex-1 cursor-pointer items-end justify-center"
            onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} aria-hidden>
            <div className="w-full max-w-6 rounded-t-[4px]"
              style={{ height: b.paise ? `${Math.max((b.paise / max) * 100, 2)}%` : "1px", background: b.paise ? "var(--chart)" : "var(--line)", opacity: active === null || active === i ? 1 : 0.45 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] border-t border-line pt-1" aria-hidden>
        {bars.map((b, i) => (
          <span key={b.key} className={`num min-w-0 flex-1 text-center text-[11px] ${active === i ? "font-semibold text-fg" : "text-muted"}`}>
            {i % labelEvery === 0 || i === bars.length - 1 ? b.short : ""}
          </span>
        ))}
      </div>

      {table && (
        <table id={`${id}-table`} className="num mt-3 w-full text-[14px]">
          <thead><tr className="text-left text-muted"><th className="py-1 font-medium">{labelEvery > 1 ? t.month.day : t.month.monthCol}</th><th className="py-1 text-right font-medium">{t.month.spentCol}</th></tr></thead>
          <tbody className="divide-y divide-line">{bars.map(b => <tr key={b.key}><td className="py-1">{b.label}</td><td className="py-1 text-right">{rupees(b.paise)}</td></tr>)}</tbody>
        </table>
      )}
    </figure>
  );
}
