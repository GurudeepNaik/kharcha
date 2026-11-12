"use client";

// Home: money in hand now (bank + cash), what came over from last month, and this month's in and out.
import { useState } from "react";
import { addMonths } from "@/lib/dates";
import type { Debt } from "@/lib/debts";
import { monthText, useI18n } from "@/lib/i18n";
import { inHandState, type InHand } from "@/lib/inhand";
import { readRupees, rupees } from "@/lib/money";
import type { Expense } from "@/lib/types";
import type { Account, Transfer } from "@/lib/wealth";
import { card } from "./ui";

export function InHandCard({ value, rows, debts, accounts, transfers, now, onSet }: {
  value: InHand | null; rows: Expense[]; debts: Debt[]; accounts: Account[]; transfers: Transfer[]; now: string;
  onSet: (v: InHand) => Promise<void>;
}) {
  const i = useI18n();
  const h = i.t.hand;
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const zero = v.trim() !== "" && Number(v.replace(/[₹,\s]/g, "")) === 0;
    const r = zero ? { ok: true as const, paise: 0 } : readRupees(v);
    if (!r.ok) { setErr(i.t.err[r.code]); return; }
    await onSet({ paise: r.paise, date: now, at: new Date().toISOString() });
    setEditing(false); setV(""); setErr(null);
  }

  const form = (title: string, help: string | null) => (
    <form onSubmit={save} className="mt-1" data-testid="inhand-form">
      <p className="font-semibold">{title}</p>
      {help && <p className="mt-0.5 text-[14px] text-muted">{help}</p>}
      <label htmlFor="inhand-amt" className="sr-only">{h.label}</label>
      <div className="mt-2 flex gap-2">
        <input id="inhand-amt" value={v} onChange={e => { setV(e.target.value); setErr(null); }} inputMode="decimal" placeholder="₹" autoComplete="off"
          aria-invalid={!!err || undefined} aria-describedby={err ? "inhand-err" : undefined} className="field num min-w-0 flex-1" />
        <button type="submit" className="press min-h-11 rounded-xl bg-accent px-4 font-semibold text-accent-fg" data-testid="inhand-save">{h.save}</button>
        {value && <button type="button" onClick={() => { setEditing(false); setErr(null); }} className="press min-h-11 rounded-xl border border-line px-3">{h.cancel}</button>}
      </div>
      {err && <p id="inhand-err" role="alert" className="mt-1 text-sm text-bad">{err}</p>}
    </form>
  );

  if (!value) return <div className={`mt-3 ${card} p-4`} data-testid="inhand">{form(h.ask, h.askHelp)}</div>;

  const s = inHandState(value, rows, debts, accounts, transfers, now);
  const parts = [
    s.broughtIn !== null ? h.brought(monthText(addMonths(s.month, -1), i).split(" ")[0]!, s.broughtIn) : null,
    s.cameIn ? h.cameIn(s.cameIn) : null,
    s.wentOut ? h.wentOut(s.wentOut) : null,
  ].filter(Boolean);
  return (
    <div className={`mt-3 ${card} p-4`} data-testid="inhand">
      {editing ? form(h.fixTitle, null) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-muted">{h.title}</p>
            <button type="button" onClick={() => { setV(String(s.now / 100)); setEditing(true); }} className="press -my-2 min-h-11 px-1 text-[13px] font-semibold text-accent" data-testid="inhand-fix">{h.fix}</button>
          </div>
          <p className={`num text-3xl font-bold ${s.now < 0 ? "text-bad" : ""}`} data-testid="inhand-now">{s.now < 0 ? "−" : ""}{rupees(Math.abs(s.now))}</p>
          {parts.length > 0 && <p className="num mt-1 text-[14px] text-muted" data-testid="inhand-month">{parts.join(" · ")}</p>}
        </>
      )}
    </div>
  );
}
