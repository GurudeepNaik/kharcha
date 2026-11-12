import { daysLeft } from "@/lib/dates";
import { rupees } from "@/lib/money";

/** "₹4,200 left · 19 days to go" with a bar, or how far over the limit the month is. */
export function LimitLine({ spent, limit, month, now }: { spent: number; limit: number; month: string; now: string }) {
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
      <p className={`mt-1.5 text-sm ${over ? "font-semibold text-bad" : "text-muted"}`}>
        {over
          ? <>{rupees(-left)} over your {rupees(limit)} limit</>
          : <><span className="num font-semibold text-fg">{rupees(left)}</span> left of {rupees(limit)}{days ? ` · ${days === 1 ? "last day" : `${days} days to go`}` : ""}</>}
      </p>
    </div>
  );
}
