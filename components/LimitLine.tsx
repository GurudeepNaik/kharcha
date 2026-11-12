"use client";

import { daysLeft } from "@/lib/dates";
import { useI18n } from "@/lib/i18n";

/** "₹4,200 left of ₹20,000 · 19 days to go" with a bar, or how far over the limit the month is. */
export function LimitLine({ spent, limit, month, now }: { spent: number; limit: number; month: string; now: string }) {
  const { t } = useI18n();
  const left = limit - spent;
  const days = daysLeft(month, now);
  const used = Math.min(spent / limit, 1);
  const over = left < 0;
  const near = !over && used >= 0.85;
  return (
    <div className="mt-3" data-testid="limit">
      <div className="h-2 overflow-hidden rounded-full bg-soft" aria-hidden>
        <div className={`bar h-full rounded-full ${over ? "bg-bad" : near ? "bg-warn" : "bg-accent"}`} style={{ width: `${Math.max(used * 100, 1.5)}%` }} />
      </div>
      <p className={`num mt-1.5 text-sm ${over ? "font-semibold text-bad" : "text-muted"}`}>
        {over ? t.limit.over(-left, limit) : <>{t.limit.left(left, limit)}{days ? ` · ${days === 1 ? t.limit.lastDay : t.limit.days(days)}` : ""}</>}
      </p>
    </div>
  );
}
