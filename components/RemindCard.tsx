"use client";

// Payments: reminders before things are due. A calendar file (works everywhere) and phone notifications.
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { rupees } from "@/lib/money";
import { notifyPermission } from "@/lib/notify";
import type { PlanItem } from "@/lib/plan";
import { calendarFile } from "@/lib/remind";
import { btnLine, card } from "./ui";

export function RemindCard({ items, now, notify, onNotify, say }: {
  items: PlanItem[]; now: string; notify: boolean; onNotify: (on: boolean) => Promise<NotificationPermission | "unsupported">; say: (s: string) => void;
}) {
  const { t } = useI18n();
  const R = t.remind;
  const [perm, setPerm] = useState<NotificationPermission | "unsupported" | null>(null);
  useEffect(() => setPerm(notifyPermission()), []);
  const on = notify && perm === "granted";

  function calendar() {
    const { text, count } = calendarFile(items, now, it => R.event(it.name, it.amountPaise ? rupees(it.amountPaise) : ""), location.origin);
    if (!count) { say(R.calNone); return; }
    const url = URL.createObjectURL(new Blob([text], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url; a.download = "kharcha-payments.ics";
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    say(R.calSaved(count));
  }

  return (
    <section aria-labelledby="remind-title" className={`${card} p-4`} data-testid="remind">
      <h2 id="remind-title" className="font-semibold">{R.title}</h2>
      <p className="mt-0.5 text-[14px] text-muted">{R.help}</p>
      <button type="button" onClick={calendar} className={`${btnLine} mt-3 w-full`} data-testid="remind-calendar">{R.calendar}</button>
      <p className="mt-1 text-[13px] text-muted">{R.calendarHelp}</p>
      {perm !== null && (
        <div className="mt-3 border-t border-line pt-3">
          {perm === "unsupported" ? <p className="text-[13px] text-muted">{R.unsupported}</p> : (
            <>
              <button type="button" role="switch" aria-checked={on} disabled={perm === "denied"} data-testid="remind-notify"
                onClick={async () => setPerm(await onNotify(!on))}
                className="press flex min-h-11 w-full items-center justify-between gap-3 text-left disabled:opacity-60">
                <span className="font-medium">{R.notify}</span>
                <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${on ? "bg-accent text-accent-fg" : "bg-soft text-muted"}`}>{on ? R.on : R.off}</span>
              </button>
              <p className="mt-1 text-[13px] text-muted">{perm === "denied" ? R.blocked : R.notifyHelp}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
