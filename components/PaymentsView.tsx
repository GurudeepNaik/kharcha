"use client";

// Payments: everything that comes in or goes out each month, ticked off one by one.
import { useState } from "react";
import { addMonths, monthOf, today } from "@/lib/dates";
import { dateText, monthText, useI18n } from "@/lib/i18n";
import { readRupees, rupees } from "@/lib/money";
import {
  PRESETS, anyTime, dayIn, dueIn, isMoneyIn, loanState, looksMonthly, monthTotals, paidIn, payMoreTip, statusOf, suggestedAmount,
  type PlanItem, type PlanKind, type Status,
} from "@/lib/plan";
import { newId } from "@/lib/store";
import type { Expense } from "@/lib/types";
import type { Account } from "@/lib/wealth";
import { Icon, Sheet, SheetHead, Svg, btnLine, btnPrimary, card } from "./ui";

/** Interest makes paise; loan figures and totals read better in whole rupees. */
const whole = (p: number) => Math.round(p / 100) * 100;

type Props = {
  items: PlanItem[]; rows: Expense[]; now: string; accounts: Account[];
  onPay: (it: PlanItem, paise: number, date: string, accountId: string | null) => Promise<void>;
  onSkip: (it: PlanItem, month: string, skip: boolean) => Promise<void>;
  onRemovePayment: (e: Expense) => Promise<void>;
  onSaveItem: (it: PlanItem) => Promise<void>;
  onDeleteItem: (it: PlanItem) => Promise<void>;
};
const GROUPS: PlanKind[] = ["income", "loan", "invest", "insurance", "bill"];
const groupOf = (k: PlanKind): PlanKind => (k === "goldloan" ? "loan" : k);

export function PaymentsView(p: Props) {
  const i = useI18n();
  const { t } = i;
  const P = t.pay;
  const current = monthOf(p.now);
  const [month, setMonth] = useState(current);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<null | { item?: PlanItem; seed?: Partial<PlanItem> }>(null);
  const tot = monthTotals(p.items, p.rows, month, p.now);
  const suggestions = month === current ? looksMonthly(p.rows, p.items, p.now) : [];
  const openItem = p.items.find(x => x.id === open) ?? null;
  const earliest = p.items.reduce((m, x) => (x.startMonth < m ? x.startMonth : m), current);

  const statusText = (it: PlanItem, st: Status) => {
    const pays = paidIn(it, p.rows, month);
    const got = pays.reduce((s, e) => s + e.amountPaise, 0);
    const lastDate = pays.map(e => e.date).sort().at(-1);
    if (st === "paid") return isMoneyIn(it) ? P.receivedOn(got, dateText(lastDate!, i)) : P.paid(got, dateText(lastDate!, i));
    if (st === "skipped") return P.skipped;
    if (anyTime(it)) return P.anyTime;
    if (st === "notDue") { let m = month; for (let k = 0; k < 12 && !dueIn(it, m); k++) m = addMonths(m, 1); return P.notDue(dateText(dayIn(m, it.day), i)); }
    const d = dateText(dayIn(month, it.day), i);
    return st === "overdue" ? P.overdue(d) : it.autoPay ? `${P.due(d)} · ${P.auto}` : P.due(d);
  };

  return (
    <section aria-labelledby="pay-title" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setMonth(m => addMonths(m, -1))} disabled={month <= earliest} aria-label={t.month.prev} className="press grid size-11 place-items-center rounded-full border border-line bg-card disabled:opacity-35"><Svg>{Icon.left}</Svg></button>
        <h1 id="pay-title" className="text-center text-lg font-bold" aria-live="polite"><span className="sr-only">{P.title}: </span>{monthText(month, i)}</h1>
        <button type="button" onClick={() => setMonth(m => addMonths(m, 1))} disabled={month >= addMonths(current, 1)} aria-label={t.month.next} className="press grid size-11 place-items-center rounded-full border border-line bg-card disabled:opacity-35"><Svg>{Icon.right}</Svg></button>
      </div>

      {p.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-6 text-center">
          <p className="text-[15px]">{P.empty}</p>
          <button type="button" onClick={() => setForm({})} className={`${btnPrimary} mt-4`} data-testid="plan-add-empty">{P.add}</button>
        </div>
      ) : (
        <>
          <div className={`${card} p-4`} data-testid="plan-summary">
            {tot.expectedIn > 0 && <p className="num text-[14px] text-muted">{t.home.moneyIn}: <strong className="text-accent">{tot.received ? P.received(tot.received) : P.expected(tot.expectedIn)}</strong></p>}
            <p className="num mt-1 text-xl font-bold">{P.progress(whole(tot.paid), whole(tot.toPay))}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-soft" aria-hidden><div className="bar h-full rounded-full bg-accent" style={{ width: `${tot.toPay ? Math.max(Math.min(tot.paid / tot.toPay, 1) * 100, tot.paid ? 1.5 : 0) : 0}%` }} /></div>
            <p className="num mt-1.5 text-[14px] text-muted">{P.done(tot.done, tot.count)}</p>
            {tot.expectedIn > 0 && (
              <p className={`num mt-2 border-t border-line pt-2 text-[14px] font-medium ${tot.expectedIn - tot.toPay < 0 ? "text-bad" : ""}`} data-testid="plan-free">
                {tot.expectedIn - tot.toPay >= 0 ? P.free(whole(Math.max(tot.received, tot.expectedIn) - tot.toPay)) : P.short(whole(tot.toPay - tot.expectedIn))}
              </p>
            )}
          </div>

          {suggestions.length > 0 && (
            <div className={`${card} p-4`} data-testid="looks-monthly">
              <h2 className="font-semibold">{P.looks}</h2>
              <ul className="mt-1 divide-y divide-line">
                {suggestions.map(s => (
                  <li key={s.name} className="flex items-center gap-3 py-2">
                    <span className="num min-w-0 flex-1 text-[14px]">{P.looksText(s.name, s.amountPaise, s.months.length)}</span>
                    <button type="button" className="press min-h-11 shrink-0 rounded-xl border border-line px-4 text-[14px] font-semibold"
                      onClick={() => setForm({ seed: { name: s.name, kind: "bill", category: s.category, amountPaise: s.amountPaise, day: s.day } })}>{P.looksAdd}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {GROUPS.map(g => {
            const list = p.items.filter(it => groupOf(it.kind) === g).map(it => ({ it, st: statusOf(it, p.rows, month, p.now) }))
              .sort((a, b) => (a.st === "notDue" ? 1 : 0) - (b.st === "notDue" ? 1 : 0) || a.it.day - b.it.day);
            if (!list.length) return null;
            return (
              <section key={g} aria-label={P.groups[g]}>
                <h2 className="mb-2 px-1 text-sm font-semibold text-muted">{P.groups[g]}</h2>
                <ul className={`divide-y divide-line overflow-hidden ${card}`} data-testid={`plan-${g}`}>
                  {list.map(({ it, st }) => {
                    const amt = st === "paid" ? paidIn(it, p.rows, month).reduce((s, e) => s + e.amountPaise, 0) : suggestedAmount(it, p.rows, p.now);
                    const ls = it.loan ? loanState(it, p.rows, p.now) : null;
                    return (
                      <li key={it.id}>
                        <button type="button" onClick={() => setOpen(it.id)} data-plan={it.name}
                          className={`press flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-soft/60 ${st === "notDue" ? "opacity-60" : ""}`}>
                          <StatusDot st={st} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-medium">{it.name}</span>
                            <span className={`block truncate text-[13px] ${st === "overdue" ? "font-medium text-bad" : "text-muted"}`}>{statusText(it, st)}</span>
                            {ls && <span className="num block truncate text-[12px] text-muted">{P.left(whole(ls.totalPaise))}</span>}
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-1">
                            {amt ? <span className={`num text-[15px] font-semibold ${isMoneyIn(it) ? "text-accent" : ""}`}>{rupees(amt)}</span> : null}
                            {(st === "due" || st === "overdue") && (
                              <span className={`rounded-full px-3 py-0.5 text-[13px] font-semibold ${st === "overdue" ? "bg-bad-soft text-bad" : "bg-accent-soft text-fg"}`}>{isMoneyIn(it) ? P.receiveBtn : P.payBtn}</span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          <button type="button" onClick={() => setForm({})} className={`${btnLine} w-full`} data-testid="plan-add">+ {P.add}</button>
        </>
      )}

      <Sheet open={!!openItem} onClose={() => setOpen(null)} label={openItem?.name ?? ""}>
        {openItem && <PaySheet {...p} it={openItem} month={month} onClose={() => setOpen(null)} onEdit={() => { setOpen(null); setForm({ item: openItem }); }} />}
      </Sheet>
      <Sheet open={!!form} onClose={() => setForm(null)} label={P.add}>
        {form && <ItemForm item={form.item} seed={form.seed} accounts={p.accounts} now={p.now} onClose={() => setForm(null)}
          onSave={async it => { await p.onSaveItem(it); setForm(null); }}
          onDelete={form.item ? async () => { await p.onDeleteItem(form.item!); setForm(null); } : undefined} />}
      </Sheet>
    </section>
  );
}

function StatusDot({ st }: { st: Status }) {
  const cls = st === "paid" ? "bg-accent text-accent-fg" : st === "overdue" ? "bg-bad text-white" : st === "skipped" ? "bg-soft text-muted" : "border-2 border-line";
  return (
    <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-full text-[14px] font-bold ${cls}`}>
      {st === "paid" ? "✓" : st === "overdue" ? "!" : st === "skipped" ? "–" : ""}
    </span>
  );
}

function PaySheet({ it, month, rows, now, accounts, onPay, onSkip, onRemovePayment, onClose, onEdit }: Props & { it: PlanItem; month: string; onClose: () => void; onEdit: () => void }) {
  const i = useI18n();
  const { t } = i;
  const P = t.pay;
  const st = statusOf(it, rows, month, now);
  const sugg = suggestedAmount(it, rows, now);
  const [amount, setAmount] = useState(sugg ? String(sugg / 100) : "");
  const defaultDate = month === monthOf(now) ? now : month < monthOf(now) ? dayIn(month, it.day) : now;
  const [date, setDate] = useState(defaultDate);
  const [account, setAccount] = useState(it.accountId ?? "");
  const [err, setErr] = useState<string | null>(null);
  const pays = paidIn(it, rows, month);
  const ls = it.loan ? loanState(it, rows, now) : null;
  const tip = it.kind === "loan" ? payMoreTip(it, rows, now) : null;
  const inMoney = isMoneyIn(it);

  return (
    <form noValidate onSubmit={async e => {
      e.preventDefault();
      const r = readRupees(amount);
      if (!r.ok) { setErr(t.err[r.code]); return; }
      if (!date || date > today()) { setErr(t.err.pickDate); return; }
      await onPay(it, r.paise, date, account || null); onClose();
    }}>
      <SheetHead title={it.name} onClose={onClose} />

      {ls && (
        <div className="mb-3 rounded-xl bg-soft p-3 text-[14px]" data-testid="loan-info">
          {it.kind === "goldloan" ? (
            <>
              <p className="num font-semibold">{P.goldClose(whole(ls.totalPaise))}</p>
              <p className="num">{P.goldLeft(whole(ls.principalPaise))} · {P.goldInt(whole(ls.interestPaise))}</p>
              <p className="num text-muted">{P.goldMonthly(whole(ls.monthlyInterestPaise))}</p>
              <p className="text-muted">{P.goldHow}</p>
              {it.loan?.endBy && <p className={`num ${it.loan.endBy <= dayIn(addMonths(monthOf(now), 1), Number(now.slice(8))) ? "font-semibold text-bad" : "text-muted"}`}>{it.loan.endBy <= dayIn(addMonths(monthOf(now), 1), Number(now.slice(8))) ? P.endSoon(dateText(it.loan.endBy, i)) : P.endBy(dateText(it.loan.endBy, i))}</p>}
            </>
          ) : ls.totalPaise === 0 ? <p className="font-semibold text-accent">{P.cleared}</p> : (
            <>
              <p className="num font-semibold">{P.left(whole(ls.totalPaise))}</p>
              <p className="num">{P.monthInt(whole(ls.monthlyInterestPaise))}</p>
              {ls.projection ? (
                <>
                  <p className="num">{P.months(ls.projection.months, monthText(ls.projection.endMonth, i))}</p>
                  <p className="num text-muted">{P.intLeft(whole(ls.projection.interestPaise))}</p>
                </>
              ) : <p className="font-medium text-bad">{P.never}</p>}
              {tip && <p className="num mt-1 font-medium text-accent" data-testid="loan-tip">{P.tip(tip.extraPaise, tip.monthsSooner, whole(tip.interestSaved))}</p>}
            </>
          )}
          {ls.paidPaise > 0 && <p className="num mt-1 text-muted">{P.paidSoFar(ls.paidPaise)}</p>}
        </div>
      )}

      {pays.length > 0 && (
        <div className="mb-3">
          <p className="text-sm font-medium">{P.thisMonth}</p>
          <ul className="divide-y divide-line">
            {pays.map(e => (
              <li key={e.id} className="flex items-center gap-3 py-1.5 text-[14px]">
                <span className="num flex-1">{rupees(e.amountPaise)} · {dateText(e.date, i)}</span>
                <button type="button" onClick={() => void onRemovePayment(e)} className="press min-h-11 rounded-lg px-3 font-semibold text-bad">{P.remove}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3">
        <div>
          <label htmlFor="pay-amount" className="mb-1 block text-sm font-medium">{inMoney ? P.amountIn : P.amount}</label>
          <input id="pay-amount" value={amount} onChange={e => { setAmount(e.target.value); setErr(null); }} inputMode="decimal" autoComplete="off" aria-invalid={!!err || undefined} className="field num" />
        </div>
        <div>
          <label htmlFor="pay-date" className="mb-1 block text-sm font-medium">{P.date}</label>
          <input id="pay-date" type="date" value={date} max={today()} onChange={e => { setDate(e.target.value); setErr(null); }} className="field num" />
        </div>
      </div>
      {accounts.length > 0 && (
        <label className="mt-3 block text-sm font-medium">{inMoney ? P.into : P.from}
          <select value={account} onChange={e => setAccount(e.target.value)} className="field mt-1">
            <option value="">{t.wealth.noAccount}</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
      )}
      {err && <p role="alert" className="mt-2 text-sm font-medium text-bad">{err}</p>}

      <button type="submit" className={`${btnPrimary} mt-4 w-full`} data-testid="pay-go">{inMoney ? P.markReceived : P.markPaid}</button>
      <div className="mt-2 flex gap-2">
        {st !== "paid" && st !== "notDue" && (
          <button type="button" onClick={async () => { await onSkip(it, month, st !== "skipped"); onClose(); }} className={`${btnLine} flex-1`} data-testid="pay-skip">
            {st === "skipped" ? P.unskip : P.skip}
          </button>
        )}
        <button type="button" onClick={onEdit} className={`${btnLine} flex-1`}>{P.edit}</button>
      </div>
    </form>
  );
}

type TypeKey = "salary" | "loan" | "goldloan" | "sip" | "insurance" | "bill";
const TYPE_KIND: Record<TypeKey, PlanKind> = { salary: "income", loan: "loan", goldloan: "goldloan", sip: "invest", insurance: "insurance", bill: "bill" };
const typeOf = (k: PlanKind): TypeKey => (k === "income" ? "salary" : k === "invest" ? "sip" : (k as TypeKey));

function ItemForm({ item, seed, accounts, now, onClose, onSave, onDelete }: {
  item?: PlanItem; seed?: Partial<PlanItem>; accounts: Account[]; now: string;
  onClose: () => void; onSave: (it: PlanItem) => Promise<void>; onDelete?: () => Promise<void>;
}) {
  const { t } = useI18n();
  const P = t.pay;
  const base = item ?? (seed ? { ...seed } as Partial<PlanItem> : undefined);
  const [type, setType] = useState<TypeKey | null>(base?.kind ? typeOf(base.kind) : null);
  const [name, setName] = useState(base?.name ?? "");
  const [category, setCategory] = useState(base?.category ?? "bills");
  const [amount, setAmount] = useState(base?.amountPaise ? String(base.amountPaise / 100) : "");
  const [day, setDay] = useState(String(base?.day ?? Number(now.slice(8))));
  const [every, setEvery] = useState<PlanItem["every"]>(base?.every ?? 1);
  const [first, setFirst] = useState(base?.startMonth ?? monthOf(now));
  const [auto, setAuto] = useState(base?.autoPay ?? false);
  const [account, setAccount] = useState(base?.accountId ?? "");
  const [principal, setPrincipal] = useState(item?.loan ? String(item.loan.principalPaise / 100) : "");
  const [rate, setRate] = useState(item?.loan ? String(item.loan.ratePct) : "");
  const [endBy, setEndBy] = useState(item?.loan?.endBy ?? "");
  const [err, setErr] = useState<string | null>(null);

  const pick = (k: string) => {
    const pr = PRESETS.find(x => x.key === k)!;
    setName(pr.name); setCategory(pr.category); setEvery(pr.every); setAuto(pr.autoPay);
  };
  const chooseType = (k: TypeKey) => {
    setType(k);
    const preset = k === "salary" ? "salary" : k === "loan" ? "loan" : k === "goldloan" ? "goldloan" : k === "sip" ? "sip" : k === "insurance" ? "term" : null;
    if (preset) pick(preset); else { setCategory("bills"); setEvery(1); }
  };

  if (!type) {
    return (
      <div>
        <SheetHead title={P.add} onClose={onClose} />
        <div className="grid grid-cols-2 gap-2" data-testid="plan-types">
          {(Object.keys(TYPE_KIND) as TypeKey[]).map(k => (
            <button key={k} type="button" onClick={() => chooseType(k)} className="press flex min-h-20 flex-col items-start justify-center rounded-xl border border-line p-3 text-left hover:border-accent">
              <span className="font-semibold">{P.types[k]}</span>
              <span className="text-[12px] text-muted">{P.typeHelp[k]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const kind = TYPE_KIND[type];
  const isLoan = kind === "loan" || kind === "goldloan";
  const picks = type === "bill" ? ["electricity", "mobile", "family", "wifi", "netflix", "chatgpt", "bike", "car"] : type === "insurance" ? ["term", "lic", "health"] : [];
  const amountOptional = type === "bill" || kind === "goldloan";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) return setErr(P.errName);
    const d = Number(day);
    if (!Number.isInteger(d) || d < 1 || d > 31) return setErr(P.errDay);
    let amt: number | null = null;
    if (amount.trim() && kind !== "goldloan") { const r = readRupees(amount); if (!r.ok) return setErr(t.err[r.code]); amt = r.paise; }
    else if (!amountOptional) { const r = readRupees(amount); if (!r.ok) return setErr(t.err[r.code]); }
    let loan: PlanItem["loan"] = null;
    if (isLoan) {
      const pr = readRupees(principal); if (!pr.ok) return setErr(t.err[pr.code]);
      const rt = Number(rate.replace(",", "."));
      if (!rate.trim() || !Number.isFinite(rt) || rt < 0 || rt > 60) return setErr(P.errRate);
      const same = item?.loan && item.loan.principalPaise === pr.paise && item.loan.ratePct === rt;
      loan = { principalPaise: pr.paise, ratePct: Math.round(rt * 100) / 100, since: same ? item!.loan!.since : now, endBy: kind === "goldloan" && endBy ? endBy : null };
    }
    const at = new Date().toISOString();
    await onSave({
      id: item?.id ?? newId(), name: name.trim().slice(0, 40), kind, category: kind === "income" ? "salary" : isLoan ? "rent" : kind === "invest" ? "sip" : category,
      amountPaise: amt, day: d, every: kind === "insurance" ? every : 1, startMonth: kind === "insurance" ? first : item?.startMonth ?? monthOf(now),
      autoPay: amt !== null && !isLoan && auto, handledThrough: item?.handledThrough ?? null, skips: item?.skips ?? [], accountId: account || null, loan,
      createdAt: item?.createdAt ?? at, updatedAt: at,
    });
  }

  const F = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => (
    <div className="mt-3"><label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>{children}</div>
  );
  return (
    <form noValidate onSubmit={submit}>
      <SheetHead title={item ? item.name : P.types[type]} onClose={onClose} />
      {picks.length > 0 && (
        <div role="group" aria-label={P.picks} className="flex flex-wrap gap-1.5" data-testid="plan-picks">
          {picks.map(k => {
            const pr = PRESETS.find(x => x.key === k)!;
            return <button key={k} type="button" aria-pressed={name === pr.name} onClick={() => pick(k)} className="press min-h-9 rounded-full border border-line px-3 text-[14px] font-medium aria-pressed:border-accent aria-pressed:bg-accent-soft">{pr.name}</button>;
          })}
        </div>
      )}
      {F({ id: "pl-name", label: P.name, children: <input id="pl-name" value={name} onChange={e => setName(e.target.value)} maxLength={40} className="field" /> })}
      {isLoan && F({ id: "pl-principal", label: P.principal, children: <input id="pl-principal" value={principal} onChange={e => setPrincipal(e.target.value)} inputMode="decimal" className="field num" /> })}
      {isLoan && F({ id: "pl-rate", label: P.rate, children: <input id="pl-rate" value={rate} onChange={e => setRate(e.target.value)} inputMode="decimal" className="field num" placeholder="12.5" /> })}
      {kind !== "goldloan" && F({ id: "pl-amount", label: kind === "loan" ? P.emi : amountOptional ? P.amountVaries : P.amountEach, children: (
        <>
          <input id="pl-amount" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" className="field num" />
          {amountOptional && <p className="mt-1 text-[12px] text-muted">{P.amountHint}</p>}
        </>
      ) })}
      {kind === "goldloan" && F({ id: "pl-end", label: P.endBy2, children: <input id="pl-end" type="date" value={endBy} onChange={e => setEndBy(e.target.value)} className="field num" /> })}
      {kind !== "goldloan" && F({ id: "pl-day", label: P.day, children: <input id="pl-day" value={day} onChange={e => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" className="field num" /> })}
      {kind === "insurance" && (
        <div className="grid grid-cols-2 gap-3">
          {F({ id: "pl-every", label: P.every, children: (
            <select id="pl-every" value={every} onChange={e => setEvery(Number(e.target.value) as PlanItem["every"])} className="field">
              <option value={1}>{P.every1}</option><option value={3}>{P.every3}</option><option value={6}>{P.every6}</option><option value={12}>{P.every12}</option>
            </select>
          ) })}
          {F({ id: "pl-first", label: P.first, children: <input id="pl-first" type="month" value={first} onChange={e => setFirst(e.target.value || monthOf(now))} className="field num" /> })}
        </div>
      )}
      {accounts.length > 0 && F({ id: "pl-acct", label: kind === "income" ? P.into : P.from, children: (
        <select id="pl-acct" value={account} onChange={e => setAccount(e.target.value)} className="field">
          <option value="">{t.wealth.noAccount}</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      ) })}
      {!isLoan && kind !== "income" && (
        <label className="mt-3 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-3 has-checked:border-accent has-checked:bg-accent-soft">
          <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} className="size-5 accent-[var(--accent)]" data-testid="pl-auto" />
          <span className="text-[14px]"><span className="font-medium">{P.autoPay}</span><span className="block text-[12px] text-muted">{P.autoHint}</span></span>
        </label>
      )}
      {err && <p role="alert" className="mt-2 text-sm font-medium text-bad">{err}</p>}
      <div className="mt-5 flex gap-2">
        {onDelete && <button type="button" onClick={() => void onDelete()} className={`${btnLine} text-bad`}>{t.delete}</button>}
        {!item && <button type="button" onClick={() => setType(null)} className={btnLine}>{P.back}</button>}
        <button type="submit" className={`${btnPrimary} flex-1`} data-testid="plan-save">{t.save}</button>
      </div>
    </form>
  );
}
