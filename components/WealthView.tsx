"use client";

// Net worth, accounts (cash, bank, credit card) with balances and transfers, what you own, and savings goals.
import { useState } from "react";
import { dateText, monthText, useI18n } from "@/lib/i18n";
import { readRupees, rupees } from "@/lib/money";
import { newId } from "@/lib/store";
import type { Expense, Settings } from "@/lib/types";
import {
  HOLDING_KINDS, balanceOf, cardThisMonth, goalProgress, isLiability, netWorth,
  type Account, type AccountType, type Goal, type Holding, type HoldingKind, type Transfer,
} from "@/lib/wealth";
import { Sheet, SheetHead, btnLine, btnPrimary, card } from "./ui";

export type ListName = "accounts" | "transfers" | "holdings" | "goals";
type Item = Account | Transfer | Holding | Goal;

export function WealthView({ rows, now, accounts, transfers, holdings, goals, settings, onSave, onDelete, onSettings, say }: {
  rows: Expense[]; now: string; accounts: Account[]; transfers: Transfer[]; holdings: Holding[]; goals: Goal[]; settings: Settings;
  onSave: (list: ListName, item: Item) => Promise<void>;
  onDelete: (list: ListName, id: string) => Promise<void>;
  onSettings: (s: Partial<Settings>) => Promise<void>;
  say: (t: string) => void;
}) {
  const i = useI18n();
  const { t } = i;
  const w = t.wealth;
  const nw = netWorth(accounts, rows, transfers, holdings);
  const [sheet, setSheet] = useState<null | { kind: "account"; item?: Account } | { kind: "move" } | { kind: "holding"; item?: Holding } | { kind: "goal"; item?: Goal } | { kind: "addMoney"; item: Goal }>(null);
  const at = () => new Date().toISOString();
  const close = () => setSheet(null);

  return (
    <section aria-labelledby="wealth-title" className="space-y-4">
      <h1 id="wealth-title" className="text-lg font-bold">{w.title}</h1>

      <div className={`${card} p-4`} data-testid="networth">
        <p className="text-sm text-muted">{w.netWorth}</p>
        <p className={`num mt-0.5 text-3xl font-bold ${nw.total < 0 ? "text-bad" : ""}`} data-testid="networth-total">{nw.total < 0 ? "−" : ""}{rupees(Math.abs(nw.total))}</p>
        <dl className="mt-3 space-y-1 border-t border-line pt-3 text-[14px]">
          <div className="flex justify-between gap-3"><dt className="text-muted">{w.accounts}</dt><dd className="num font-semibold">{nw.accounts < 0 ? "−" : ""}{rupees(Math.abs(nw.accounts))}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">{w.owned}</dt><dd className="num font-semibold">{rupees(nw.owned)}</dd></div>
          {nw.owed > 0 && <div className="flex justify-between gap-3"><dt className="text-muted">{w.owed}</dt><dd className="num font-semibold text-bad">−{rupees(nw.owed)}</dd></div>}
        </dl>
        <p className="mt-2 text-[12px] text-muted">{w.netHelp}</p>
      </div>

      {/* Accounts */}
      <div className={`${card} p-4`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{w.accounts}</h2>
          <div className="flex gap-2">
            {accounts.length >= 2 && <button type="button" onClick={() => setSheet({ kind: "move" })} className="press min-h-11 rounded-xl border border-line px-3 text-[14px] font-semibold">{w.move}</button>}
            <button type="button" onClick={() => setSheet({ kind: "account" })} className="press min-h-11 rounded-xl bg-accent px-3 text-[14px] font-semibold text-accent-fg" data-testid="add-account">{w.addAccount}</button>
          </div>
        </div>
        {accounts.length === 0 ? <p className="mt-1 text-sm text-muted">{w.accountsEmpty}</p> : (
          <ul className="mt-2 divide-y divide-line" data-testid="accounts">
            {accounts.map(a => {
              const b = balanceOf(a, rows, transfers);
              return (
                <li key={a.id}>
                  <button type="button" onClick={() => setSheet({ kind: "account", item: a })} className="press flex min-h-14 w-full items-center gap-3 py-2 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{a.name}</span>
                      <span className="block text-[13px] text-muted">{a.type === "card" ? `${w.card} · ${w.cardMonth(cardThisMonth(a, rows, now))}` : a.type === "cash" ? w.cash : w.bank}
                        {settings.upiAccount === a.id ? ` · ${w.upi}` : ""}{settings.cashAccount === a.id ? ` · ${w.cashPay}` : ""}</span>
                    </span>
                    <span className={`num shrink-0 font-semibold ${b < 0 ? "text-bad" : ""}`}>{a.type === "card" && b <= 0 ? w.owes(-b) : `${b < 0 ? "−" : ""}${rupees(Math.abs(b))}`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {accounts.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line pt-3">
            {([["upiAccount", w.upi], ["cashAccount", w.cashPay]] as const).map(([k, label]) => (
              <label key={k} className="text-[13px] font-medium">
                {w.useFor}: {label}
                <select value={settings[k] ?? ""} onChange={e => void onSettings({ [k]: e.target.value || null })} className="field mt-1 min-h-11 py-2 text-[14px]" data-testid={k}>
                  <option value="">{w.none}</option>
                  {accounts.filter(a => (k === "cashAccount" ? a.type === "cash" : a.type !== "cash")).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* What you own */}
      <div className={`${card} p-4`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{w.holdings}</h2>
          <button type="button" onClick={() => setSheet({ kind: "holding" })} className="press min-h-11 rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-fg" data-testid="add-holding">{w.add}</button>
        </div>
        <p className="mt-0.5 text-[13px] text-muted">{w.holdingsHelp}</p>
        {holdings.length > 0 && (
          <ul className="mt-2 divide-y divide-line" data-testid="holdings">
            {[...holdings].sort((a, b) => b.valuePaise - a.valuePaise).map(h => (
              <li key={h.id}>
                <button type="button" onClick={() => setSheet({ kind: "holding", item: h })} className="press flex min-h-14 w-full items-center gap-3 py-2 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{h.name}</span>
                    <span className="block text-[13px] text-muted">{w.kinds[h.kind]} · {w.updated(dateText(h.updatedAt.slice(0, 10), i))}</span>
                  </span>
                  <span className={`num shrink-0 font-semibold ${isLiability(h.kind) ? "text-bad" : ""}`}>{isLiability(h.kind) ? "−" : ""}{rupees(h.valuePaise)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Goals */}
      <div className={`${card} p-4`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{w.goals}</h2>
          <button type="button" onClick={() => setSheet({ kind: "goal" })} className="press min-h-11 rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-fg" data-testid="add-goal">{w.addGoal}</button>
        </div>
        {goals.length === 0 ? <p className="mt-1 text-sm text-muted">{w.goalsEmpty}</p> : (
          <ul className="mt-2 space-y-4" data-testid="goals">
            {goals.map(g => {
              const p = goalProgress(g, now);
              return (
                <li key={g.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <button type="button" onClick={() => setSheet({ kind: "goal", item: g })} className="min-w-0 truncate text-left font-medium underline-offset-2 hover:underline">{g.name}</button>
                    <span className="num shrink-0 text-[13px] text-muted">{g.byMonth ? monthText(g.byMonth, i) : ""}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-soft" aria-hidden><div className="bar h-full rounded-full bg-accent" style={{ width: `${Math.max(p.share * 100, p.saved ? 1.5 : 0)}%` }} /></div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="num text-[13px]" data-testid="goal-progress">
                      {w.saved(p.saved, g.targetPaise)}
                      {p.done ? <strong className="ms-1 text-accent">{w.reached}</strong> : p.perMonth !== null && p.months !== null ? <span className="block text-muted">{w.perMonth(p.perMonth, p.months)}</span> : null}
                    </span>
                    {!p.done && <button type="button" onClick={() => setSheet({ kind: "addMoney", item: g })} className="press min-h-11 shrink-0 rounded-xl border border-line px-3 text-[14px] font-semibold">{w.addMoney}</button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Sheet open={!!sheet} onClose={close} label={sheet?.kind ?? ""}>
        {sheet?.kind === "account" && <AccountForm item={sheet.item} now={now} onClose={close}
          onSave={async a => { await onSave("accounts", a); close(); }} onDelete={sheet.item ? async () => { await onDelete("accounts", sheet.item!.id); close(); } : undefined} />}
        {sheet?.kind === "move" && <MoveForm accounts={accounts} now={now} onClose={close}
          onSave={async x => { await onSave("transfers", { ...x, id: newId(), createdAt: at(), updatedAt: at() }); close(); say(w.moved); }} />}
        {sheet?.kind === "holding" && <HoldingForm item={sheet.item} onClose={close}
          onSave={async h => { await onSave("holdings", h); close(); }} onDelete={sheet.item ? async () => { await onDelete("holdings", sheet.item!.id); close(); } : undefined} />}
        {sheet?.kind === "goal" && <GoalForm item={sheet.item} onClose={close}
          onSave={async g => { await onSave("goals", g); close(); }} onDelete={sheet.item ? async () => { await onDelete("goals", sheet.item!.id); close(); } : undefined} />}
        {sheet?.kind === "addMoney" && <AmountForm title={`${w.addMoney}: ${sheet.item.name}`} onClose={close}
          onSave={async p => { const g = sheet.item; await onSave("goals", { ...g, added: [...g.added, { date: now, paise: p }], updatedAt: at() }); close(); }} />}
      </Sheet>
    </section>
  );
}

function useAmount(initial = "") {
  const { t } = useI18n();
  const [v, setV] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const read = (allowZero = false) => {
    if (allowZero && v.trim() && Number(v.replace(/[₹,\s]/g, "")) === 0) return 0;
    const r = readRupees(v);
    if (!r.ok) { setErr(t.err[r.code]); return null; }
    setErr(null); return r.paise;
  };
  return { v, setV: (x: string) => { setV(x); setErr(null); }, err, read };
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="mt-3"><label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>{children}</div>;
}

function Buttons({ onDelete }: { onDelete?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mt-5 flex gap-2">
      {onDelete && <button type="button" onClick={onDelete} className={`${btnLine} text-bad`}>{t.delete}</button>}
      <button type="submit" className={`${btnPrimary} flex-1`}>{t.save}</button>
    </div>
  );
}

function AccountForm({ item, now, onClose, onSave, onDelete }: { item?: Account; now: string; onClose: () => void; onSave: (a: Account) => Promise<void>; onDelete?: () => Promise<void> }) {
  const { t } = useI18n(); const w = t.wealth;
  const [name, setName] = useState(item?.name ?? "");
  const [type, setType] = useState<AccountType>(item?.type ?? "bank");
  const amt = useAmount(item ? String(Math.abs(item.openingPaise) / 100) : "");
  const [nameErr, setNameErr] = useState(false);
  return (
    <form noValidate onSubmit={async e => {
      e.preventDefault();
      if (!name.trim()) { setNameErr(true); return; }
      const p = amt.read(true); if (p === null) return;
      const at = new Date().toISOString();
      await onSave({ id: item?.id ?? newId(), name: name.trim().slice(0, 40), type, openingPaise: type === "card" ? -p : p, openingDate: item?.openingDate ?? now, createdAt: item?.createdAt ?? at, updatedAt: at });
    }}>
      <SheetHead title={item ? item.name : w.addAccount} onClose={onClose} />
      <fieldset><legend className="mb-1.5 text-sm font-medium">{w.type}</legend>
        <div className="grid grid-cols-3 gap-2">
          {(["bank", "cash", "card"] as const).map(k => (
            <label key={k} className="press flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-line px-1 text-center text-[14px] font-medium has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-accent">
              <input type="radio" name="atype" value={k} checked={type === k} onChange={() => setType(k)} className="sr-only" />{w[k]}
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="a-name" label={w.name}><input id="a-name" value={name} onChange={e => { setName(e.target.value); setNameErr(false); }} maxLength={40} aria-invalid={nameErr || undefined} className="field" placeholder={type === "bank" ? "e.g. SBI savings" : type === "card" ? "e.g. HDFC card" : ""} /></Field>
      <Field id="a-open" label={type === "card" ? w.owedNow : w.balanceNow}><input id="a-open" value={amt.v} onChange={e => amt.setV(e.target.value)} inputMode="decimal" aria-invalid={!!amt.err || undefined} className="field num" /></Field>
      {(amt.err || nameErr) && <p role="alert" className="mt-2 text-sm font-medium text-bad">{amt.err ?? t.err.noName}</p>}
      <Buttons onDelete={onDelete} />
    </form>
  );
}

function MoveForm({ accounts, now, onClose, onSave }: { accounts: Account[]; now: string; onClose: () => void; onSave: (x: Omit<Transfer, "id" | "createdAt" | "updatedAt">) => Promise<void> }) {
  const { t } = useI18n(); const w = t.wealth;
  const [from, setFrom] = useState(accounts.find(a => a.type === "bank")?.id ?? accounts[0]!.id);
  const [to, setTo] = useState(accounts.find(a => a.id !== from)?.id ?? "");
  const amt = useAmount();
  return (
    <form noValidate onSubmit={async e => { e.preventDefault(); const p = amt.read(); if (p === null || from === to) return; await onSave({ from, to, amountPaise: p, date: now, note: "" }); }}>
      <SheetHead title={w.move} onClose={onClose} />
      <p className="text-[13px] text-muted">{w.moveHint}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field id="m-from" label={w.from}><select id="m-from" value={from} onChange={e => setFrom(e.target.value)} className="field">{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field id="m-to" label={w.to}><select id="m-to" value={to} onChange={e => setTo(e.target.value)} className="field">{accounts.filter(a => a.id !== from).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      </div>
      <Field id="m-amt" label={w.amount}><input id="m-amt" value={amt.v} onChange={e => amt.setV(e.target.value)} inputMode="decimal" aria-invalid={!!amt.err || undefined} className="field num" /></Field>
      {amt.err && <p role="alert" className="mt-2 text-sm font-medium text-bad">{amt.err}</p>}
      <Buttons />
    </form>
  );
}

function HoldingForm({ item, onClose, onSave, onDelete }: { item?: Holding; onClose: () => void; onSave: (h: Holding) => Promise<void>; onDelete?: () => Promise<void> }) {
  const { t } = useI18n(); const w = t.wealth;
  const [name, setName] = useState(item?.name ?? "");
  const [kind, setKind] = useState<HoldingKind>(item?.kind ?? "fd");
  const amt = useAmount(item ? String(item.valuePaise / 100) : "");
  return (
    <form noValidate onSubmit={async e => {
      e.preventDefault();
      const p = amt.read(true); if (p === null) return;
      const at = new Date().toISOString();
      await onSave({ id: item?.id ?? newId(), name: (name.trim() || w.kinds[kind]).slice(0, 40), kind, valuePaise: p, createdAt: item?.createdAt ?? at, updatedAt: at });
    }}>
      <SheetHead title={item ? item.name : w.holdings} onClose={onClose} />
      <Field id="h-kind" label={w.kind}><select id="h-kind" value={kind} onChange={e => setKind(e.target.value as HoldingKind)} className="field">{HOLDING_KINDS.map(k => <option key={k} value={k}>{w.kinds[k]}</option>)}</select></Field>
      <Field id="h-name" label={w.name}><input id="h-name" value={name} onChange={e => setName(e.target.value)} maxLength={40} className="field" placeholder={w.kinds[kind]} /></Field>
      <Field id="h-val" label={w.value}><input id="h-val" value={amt.v} onChange={e => amt.setV(e.target.value)} inputMode="decimal" aria-invalid={!!amt.err || undefined} className="field num" /></Field>
      {amt.err && <p role="alert" className="mt-2 text-sm font-medium text-bad">{amt.err}</p>}
      <Buttons onDelete={onDelete} />
    </form>
  );
}

function GoalForm({ item, onClose, onSave, onDelete }: { item?: Goal; onClose: () => void; onSave: (g: Goal) => Promise<void>; onDelete?: () => Promise<void> }) {
  const { t } = useI18n(); const w = t.wealth;
  const [name, setName] = useState(item?.name ?? "");
  const [by, setBy] = useState(item?.byMonth ?? "");
  const amt = useAmount(item ? String(item.targetPaise / 100) : "");
  const [nameErr, setNameErr] = useState(false);
  return (
    <form noValidate onSubmit={async e => {
      e.preventDefault();
      if (!name.trim()) { setNameErr(true); return; }
      const p = amt.read(); if (p === null) return;
      const at = new Date().toISOString();
      await onSave({ id: item?.id ?? newId(), name: name.trim().slice(0, 40), targetPaise: p, byMonth: /^\d{4}-\d{2}$/.test(by) ? by : null, added: item?.added ?? [], createdAt: item?.createdAt ?? at, updatedAt: at });
    }}>
      <SheetHead title={item ? item.name : w.addGoal} onClose={onClose} />
      <Field id="g-name" label={w.goalName}><input id="g-name" value={name} onChange={e => { setName(e.target.value); setNameErr(false); }} maxLength={40} aria-invalid={nameErr || undefined} className="field" placeholder="e.g. Bike" /></Field>
      <Field id="g-target" label={w.target}><input id="g-target" value={amt.v} onChange={e => amt.setV(e.target.value)} inputMode="decimal" aria-invalid={!!amt.err || undefined} className="field num" /></Field>
      <Field id="g-by" label={w.by}><input id="g-by" type="month" value={by} onChange={e => setBy(e.target.value)} className="field num" /></Field>
      {(amt.err || nameErr) && <p role="alert" className="mt-2 text-sm font-medium text-bad">{amt.err ?? t.err.noName}</p>}
      <Buttons onDelete={onDelete} />
    </form>
  );
}

function AmountForm({ title, onClose, onSave }: { title: string; onClose: () => void; onSave: (paise: number) => Promise<void> }) {
  const { t } = useI18n();
  const amt = useAmount();
  return (
    <form noValidate onSubmit={async e => { e.preventDefault(); const p = amt.read(); if (p !== null) await onSave(p); }}>
      <SheetHead title={title} onClose={onClose} />
      <Field id="am" label={t.wealth.amount}><input id="am" value={amt.v} onChange={e => amt.setV(e.target.value)} inputMode="decimal" autoFocus aria-invalid={!!amt.err || undefined} className="field num" /></Field>
      {amt.err && <p role="alert" className="mt-2 text-sm font-medium text-bad">{amt.err}</p>}
      <Buttons />
    </form>
  );
}
