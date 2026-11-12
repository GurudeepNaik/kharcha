"use client";

// Change or delete one entry.
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { CATEGORIES, type Category } from "@/lib/categories";
import { plainAmount, readRupees } from "@/lib/money";
import type { Method } from "@/lib/parse";
import type { Expense } from "@/lib/types";
import { Sheet, SheetHead } from "./ui";

type SaveFn = (e: Expense, categoryChanged: boolean, everyMonth: boolean) => Promise<void>;

export function EditSheet({ expense, repeating, now, onClose, onSave, onDelete }: {
  expense: Expense | null;
  /** This entry's monthly repeat is still on. */
  repeating: boolean;
  now: string;
  onClose: () => void;
  onSave: SaveFn;
  onDelete: (e: Expense) => Promise<void>;
}) {
  const { t } = useI18n();
  return (
    <Sheet open={!!expense} onClose={onClose} label={t.edit.title}>
      {expense && <Form key={expense.id} e={expense} repeating={repeating} now={now} onClose={onClose} onSave={onSave} onDelete={onDelete} />}
    </Sheet>
  );
}

function Form({ e, repeating, now, onClose, onSave, onDelete }: {
  e: Expense; repeating: boolean; now: string; onClose: () => void;
  onSave: SaveFn;
  onDelete: (e: Expense) => Promise<void>;
}) {
  const { t } = useI18n();
  const [amount, setAmount] = useState(plainAmount(e.amountPaise));
  const [note, setNote] = useState(e.note);
  const [category, setCategory] = useState<Category>(e.category);
  const [date, setDate] = useState(e.date);
  const [method, setMethod] = useState<Method | null>(e.method);
  const [monthly, setMonthly] = useState(repeating);
  const [error, setError] = useState<{ field: "amount" | "date"; text: string } | null>(null);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const a = readRupees(amount);
    if (!a.ok) { setError({ field: "amount", text: t.err[a.code] }); document.getElementById("edit-amount")?.focus(); return; }
    if (!date || date > now) { setError({ field: "date", text: t.err.pickDate }); return; }
    await onSave({ ...e, amountPaise: a.paise, note: note.trim().slice(0, 60), category, date, method, updatedAt: new Date().toISOString() }, category !== e.category, monthly);
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

      <label className="mt-4 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-3 has-checked:border-accent has-checked:bg-accent-soft">
        <input type="checkbox" checked={monthly} onChange={x => setMonthly(x.target.checked)} className="size-5 accent-[var(--accent)]" />
        <span className="text-[15px]">
          <span className="font-medium">{t.everyMonth}</span>
          <span className="block text-[13px] text-muted">{t.edit.everyHint(Number(date.slice(8)) || "–")}</span>
        </span>
      </label>

      <div className="mt-5 flex gap-2">
        <button type="button" onClick={() => void onDelete(e)} className="press min-h-12 rounded-xl border border-line px-4 font-semibold text-bad">{t.delete}</button>
        <button type="submit" className="press min-h-12 flex-1 rounded-xl bg-accent font-semibold text-accent-fg">{t.edit.save}</button>
      </div>
    </form>
  );
}
