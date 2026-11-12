"use client";

// Change or delete one spend.
import { useState } from "react";
import { CATEGORIES, type Category } from "@/lib/categories";
import { plainAmount, readRupees } from "@/lib/money";
import type { Method } from "@/lib/parse";
import type { Expense } from "@/lib/types";
import { Sheet, SheetHead } from "./ui";

export function EditSheet({ expense, now, onClose, onSave, onDelete }: {
  expense: Expense | null;
  now: string;
  onClose: () => void;
  onSave: (e: Expense, categoryChanged: boolean) => Promise<void>;
  onDelete: (e: Expense) => Promise<void>;
}) {
  return (
    <Sheet open={!!expense} onClose={onClose} label="Change this spend">
      {expense && <Form key={expense.id} e={expense} now={now} onClose={onClose} onSave={onSave} onDelete={onDelete} />}
    </Sheet>
  );
}

function Form({ e, now, onClose, onSave, onDelete }: {
  e: Expense; now: string; onClose: () => void;
  onSave: (e: Expense, categoryChanged: boolean) => Promise<void>;
  onDelete: (e: Expense) => Promise<void>;
}) {
  const [amount, setAmount] = useState(plainAmount(e.amountPaise));
  const [note, setNote] = useState(e.note);
  const [category, setCategory] = useState<Category>(e.category);
  const [date, setDate] = useState(e.date);
  const [method, setMethod] = useState<Method | null>(e.method);
  const [error, setError] = useState<{ field: "amount" | "date"; text: string } | null>(null);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const a = readRupees(amount);
    if (!a.ok) { setError({ field: "amount", text: a.error }); document.getElementById("edit-amount")?.focus(); return; }
    if (!date || date > now) { setError({ field: "date", text: "Pick today or an earlier date." }); return; }
    await onSave({ ...e, amountPaise: a.paise, note: note.trim().slice(0, 60), category, date, method, updatedAt: new Date().toISOString() }, category !== e.category);
  }

  return (
    <form onSubmit={submit} noValidate>
      <SheetHead title="Change this spend" onClose={onClose} />
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
        <div>
          <label htmlFor="edit-amount" className="mb-1 block text-sm font-medium">Amount (₹)</label>
          <input id="edit-amount" value={amount} onChange={x => { setAmount(x.target.value); setError(null); }} inputMode="decimal" autoComplete="off"
            aria-invalid={error?.field === "amount" || undefined} aria-describedby={error?.field === "amount" ? "edit-error" : undefined}
            className="field num" />
        </div>
        <div>
          <label htmlFor="edit-date" className="mb-1 block text-sm font-medium">Date</label>
          <input id="edit-date" type="date" value={date} max={now} onChange={x => { setDate(x.target.value); setError(null); }}
            aria-invalid={error?.field === "date" || undefined} className="field num" />
        </div>
      </div>
      {error && <p id="edit-error" role="alert" className="mt-2 text-sm font-medium text-bad">{error.text}</p>}

      <label htmlFor="edit-note" className="mt-3 mb-1 block text-sm font-medium">What for</label>
      <input id="edit-note" value={note} onChange={x => setNote(x.target.value)} maxLength={60} autoComplete="off" className="field" />

      <fieldset className="mt-3">
        <legend className="mb-1.5 text-sm font-medium">Category</legend>
        <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-4">
          {CATEGORIES.map(c => (
            <label key={c.key} className="press flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-line px-2 text-center text-[14px] font-medium has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-accent">
              <input type="radio" name="category" value={c.key} checked={category === c.key} onChange={() => setCategory(c.key)} className="sr-only" />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-3">
        <legend className="mb-1.5 text-sm font-medium">Paid by</legend>
        <div className="grid grid-cols-3 gap-2">
          {([[null, "Not set"], ["cash", "Cash"], ["upi", "UPI"]] as const).map(([m, label]) => (
            <label key={label} className="press flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-line text-[14px] font-medium has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-accent">
              <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 flex gap-2">
        <button type="button" onClick={() => void onDelete(e)} className="press min-h-12 rounded-xl border border-line px-4 font-semibold text-bad">Delete</button>
        <button type="submit" className="press min-h-12 flex-1 rounded-xl bg-accent font-semibold text-accent-fg">Save changes</button>
      </div>
    </form>
  );
}
