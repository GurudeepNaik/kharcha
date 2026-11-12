"use client";

// Change or delete one entry.
import { useEffect, useRef, useState } from "react";
import { getPhoto } from "@/lib/store";
import type { Account } from "@/lib/wealth";
import { useI18n } from "@/lib/i18n";
import { TAX_TAGS, suggestTax, type TaxTag } from "@/lib/tax";
import { CATEGORIES, type Category } from "@/lib/categories";
import { plainAmount, readRupees } from "@/lib/money";
import type { Method } from "@/lib/parse";
import type { Expense } from "@/lib/types";
import { Sheet, SheetHead } from "./ui";

type SaveFn = (e: Expense, categoryChanged: boolean, everyMonth: boolean) => Promise<void>;
type SkipFn = (e: Expense) => Promise<void>;

export function EditSheet({ expense, planName, now, onClose, onSave, onDelete, onSkip, accounts, onPhoto }: {
  expense: Expense | null;
  /** The Payments item this entry pays, if any. */
  planName: string | null;
  now: string;
  onClose: () => void;
  onSave: SaveFn;
  onDelete: (e: Expense) => Promise<void>;
  onSkip: SkipFn;
  accounts: Account[];
  onPhoto: (e: Expense, file: Blob | null) => Promise<void>;
}) {
  const { t } = useI18n();
  return (
    <Sheet open={!!expense} onClose={onClose} label={t.edit.title}>
      {expense && <Form key={expense.id} e={expense} planName={planName} now={now} onClose={onClose} onSave={onSave} onDelete={onDelete} onSkip={onSkip} accounts={accounts} onPhoto={onPhoto} />}
    </Sheet>
  );
}

function Form({ e, planName, now, onClose, onSave, onDelete, onSkip, accounts, onPhoto }: {
  e: Expense; planName: string | null; now: string; onClose: () => void;
  onSave: SaveFn;
  onDelete: (e: Expense) => Promise<void>;
  onSkip: SkipFn;
  accounts: Account[];
  onPhoto: (e: Expense, file: Blob | null) => Promise<void>;
}) {
  const { t } = useI18n();
  const [amount, setAmount] = useState(plainAmount(e.amountPaise));
  const [note, setNote] = useState(e.note);
  const [category, setCategory] = useState<Category>(e.category);
  const [date, setDate] = useState(e.date);
  const [method, setMethod] = useState<Method | null>(e.method);
  const [monthly, setMonthly] = useState(false);
  const [tax, setTax] = useState<TaxTag | "">(e.tax ?? "");
  const [account, setAccount] = useState(e.accountId ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let url: string | null = null, live = true;
    if (e.photo) void getPhoto(e.id).then(b => { if (b && live) { url = URL.createObjectURL(b); setPhotoUrl(url); } });
    else setPhotoUrl(null);
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [e.id, e.photo]);
  const [error, setError] = useState<{ field: "amount" | "date"; text: string } | null>(null);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const a = readRupees(amount);
    if (!a.ok) { setError({ field: "amount", text: t.err[a.code] }); document.getElementById("edit-amount")?.focus(); return; }
    if (!date || date > now) { setError({ field: "date", text: t.err.pickDate }); return; }
    const next: Expense = { ...e, amountPaise: a.paise, note: note.trim().slice(0, 60), category, date, method, updatedAt: new Date().toISOString() };
    if (tax) next.tax = tax; else delete next.tax;
    if (account) next.accountId = account; else delete next.accountId;
    await onSave(next, category !== e.category, monthly);
  }

  return (
    <form onSubmit={submit} noValidate>
      <SheetHead title={t.edit.title} onClose={onClose} />
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
        <div>
          <label htmlFor="edit-amount" className="mb-1 block text-sm font-medium">{t.edit.amount}</label>
          <input id="edit-amount" value={amount} onChange={x => { setAmount(x.target.value); setError(null); }} inputMode="decimal" autoComplete="off"
            aria-invalid={error?.field === "amount" || undefined} aria-describedby={error?.field === "amount" ? "edit-error" : undefined}
            className="field num" />
        </div>
        <div>
          <label htmlFor="edit-date" className="mb-1 block text-sm font-medium">{t.edit.date}</label>
          <input id="edit-date" type="date" value={date} max={now} onChange={x => { setDate(x.target.value); setError(null); }}
            aria-invalid={error?.field === "date" || undefined} className="field num" />
        </div>
      </div>
      {error && <p id="edit-error" role="alert" className="mt-2 text-sm font-medium text-bad">{error.text}</p>}

      <label htmlFor="edit-note" className="mt-3 mb-1 block text-sm font-medium">{t.edit.note}</label>
      <input id="edit-note" value={note} onChange={x => setNote(x.target.value)} maxLength={60} autoComplete="off" className="field" />

      <fieldset className="mt-3">
        <legend className="mb-1.5 text-sm font-medium">{t.edit.category}</legend>
        {(["spend", "in", "invest"] as const).map(k => (
        <div key={k} className={k !== "spend" ? "mt-3" : ""}>
        <p className="mb-1 text-[13px] text-muted">{k === "spend" ? t.add.spent : k === "in" ? t.add.in : t.add.invest}</p>
        <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
          {CATEGORIES.filter(c => c.kind === k).map(c => (
            <label key={c.key} className="press flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-line px-2 text-center text-[14px] font-medium has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-accent">
              <input type="radio" name="category" value={c.key} checked={category === c.key} onChange={() => setCategory(c.key)} className="sr-only" />
              {t.cat[c.key]}
            </label>
          ))}
        </div>
        </div>
        ))}
      </fieldset>

      <fieldset className="mt-3">
        <legend className="mb-1.5 text-sm font-medium">{t.edit.paidBy}</legend>
        <div className="grid grid-cols-3 gap-2">
          {([[null, t.notSet], ["cash", t.cash], ["upi", t.upi]] as const).map(([m, label]) => (
            <label key={label} className="press flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-line text-[14px] font-medium has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-accent">
              <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor="edit-tax" className="mt-3 mb-1 block text-sm font-medium">{t.tax.edit}</label>
      <select id="edit-tax" value={tax} onChange={x => setTax(x.target.value as TaxTag | "")} className="field">
        <option value="">{t.tax.auto(t.tax[suggestTax({ ...e, category, note })])}</option>
        {TAX_TAGS.map(k => <option key={k} value={k}>{t.tax[k]}</option>)}
      </select>

      {planName ? (
        <p className="mt-4 rounded-xl bg-soft px-3 py-2.5 text-[14px]" data-testid="part-of">{t.pay.partOf(planName)}</p>
      ) : (
      <label className="mt-4 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-3 has-checked:border-accent has-checked:bg-accent-soft">
        <input type="checkbox" checked={monthly} onChange={x => setMonthly(x.target.checked)} className="size-5 accent-[var(--accent)]" />
        <span className="text-[15px]">
          <span className="font-medium">{t.everyMonth}</span>
          <span className="block text-[13px] text-muted">{t.edit.everyHint(Number(date.slice(8)) || "–")}</span>
        </span>
      </label>
      )}

      {accounts.length > 0 && (
        <>
          <label htmlFor="edit-account" className="mt-3 mb-1 block text-sm font-medium">{t.wealth.account}</label>
          <select id="edit-account" value={account} onChange={x => setAccount(x.target.value)} className="field">
            <option value="">{t.wealth.noAccount}</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </>
      )}

      <div className="mt-3 flex items-center gap-3" data-testid="photo">
        {photoUrl ? (
          <>
            <button type="button" onClick={() => setViewing(true)} className="press shrink-0 overflow-hidden rounded-lg border border-line" aria-label={t.photo.view}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt={t.photo.alt} className="h-16 w-12 object-cover object-top" />
            </button>
            <button type="button" onClick={() => setViewing(true)} className="press min-h-11 rounded-xl border border-line px-3 text-[14px] font-semibold">{t.photo.view}</button>
            <button type="button" onClick={() => void onPhoto(e, null)} className="press min-h-11 rounded-xl px-3 text-[14px] font-semibold text-bad">{t.photo.remove}</button>
          </>
        ) : (
          <button type="button" onClick={() => photoInput.current?.click()} className="press min-h-11 rounded-xl border border-line px-3 text-[14px] font-semibold">{t.photo.add}</button>
        )}
        <input ref={photoInput} type="file" accept="image/*" className="hidden" aria-hidden tabIndex={-1} data-testid="photo-input"
          onChange={x => { const f = x.target.files?.[0]; x.target.value = ""; if (f) void onPhoto({ ...e, amountPaise: e.amountPaise }, f); }} />
      </div>
      {viewing && photoUrl && (
        <div role="dialog" aria-label={t.photo.alt} className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-3" onClick={() => setViewing(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt={t.photo.alt} className="max-h-full max-w-full rounded-lg" />
          <button type="button" onClick={() => setViewing(false)} className="press absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 min-h-11 rounded-full bg-white px-4 font-semibold text-black">{t.close}</button>
        </div>
      )}

      {planName && (
        <button type="button" onClick={() => void onSkip(e)} data-testid="skip-this"
          className="press mt-4 min-h-12 w-full rounded-xl border border-line font-semibold">{t.edit.skipThis}</button>
      )}

      <div className="mt-5 flex gap-2">
        <button type="button" onClick={() => void onDelete(e)} className="press min-h-12 rounded-xl border border-line px-4 font-semibold text-bad">{t.delete}</button>
        <button type="submit" className="press min-h-12 flex-1 rounded-xl bg-accent font-semibold text-accent-fg">{t.edit.save}</button>
      </div>
    </form>
  );
}
