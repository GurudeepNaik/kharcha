"use client";

// The add box, docked at the bottom of Home within thumb reach: type "chai 20" or "salary 50000", check the preview, Save.
import { useMemo, useRef, useState } from "react";
import { CATEGORIES, isIncomeCategory, type Category } from "@/lib/categories";
import { rupees } from "@/lib/money";
import { parseEntry, type Method, type Parsed } from "@/lib/parse";

export function AddBox({ now, learned, typing, onAdd }: {
  now: string;
  learned: ReadonlyMap<string, Category>;
  typing: boolean;
  onAdd: (p: Parsed, pickedCategory: boolean, everyMonth: boolean) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [cat, setCat] = useState<Category | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [method, setMethod] = useState<Method | null | undefined>(undefined);
  const [monthly, setMonthly] = useState(false);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseEntry(text, now, learned), [text, now, learned]);
  const value: Parsed | null = parsed.ok
    ? {
        ...parsed.value,
        category: cat ?? parsed.value.category,
        date: date ?? parsed.value.date,
        // Paid by: what was tapped here, else what the line says ("upi", "cash"), else not set.
        method: method !== undefined ? method : parsed.value.method,
      }
    : null;
  const income = value ? isIncomeCategory(value.category) : false;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!value) { setTried(true); input.current?.focus(); return; }
    setSaving(true);
    try {
      await onAdd(value, cat !== null && parsed.ok && cat !== parsed.value.category, monthly);
      setText(""); setCat(null); setDate(null); setMethod(undefined); setMonthly(false); setTried(false);
      input.current?.focus();
    } finally { setSaving(false); }
  }

  const error = !parsed.ok && tried ? (text.trim() ? parsed.error : "Type what you spent, like chai 20.") : null;
  const pill = "press min-h-9 rounded-full border border-line px-3 text-[14px] font-medium aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-fg";

  return (
    <form onSubmit={save} noValidate data-typing={typing}
      className="dock fixed inset-x-0 z-30">
      <div className="mx-auto max-w-xl rounded-t-2xl border border-b-0 border-line bg-card px-3 pt-2.5 pb-3 shadow-[0_-6px_24px_rgb(0_0_0/0.08)]">
        <div id="entry-help" className="mb-2 px-1" aria-live="polite">
          {value ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`num me-1 text-xl font-bold ${income ? "text-accent" : ""}`} data-testid="preview-amount">
                {income ? "+" : ""}{rupees(value.amountPaise)}
              </span>
              <label className="chip">
                <span className="sr-only">Category</span>
                <select value={value.category} onChange={e => setCat(e.target.value as Category)} className="chip-select">
                  <optgroup label="Spent">{CATEGORIES.filter(c => !c.income).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</optgroup>
                  <optgroup label="Money in">{CATEGORIES.filter(c => c.income).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</optgroup>
                </select>
              </label>
              <label className="chip">
                <span className="sr-only">Date</span>
                <input type="date" value={value.date} max={now} onChange={e => { if (e.target.value && e.target.value <= now) setDate(e.target.value); }}
                  className="chip-select num" />
              </label>
              {(["cash", "upi"] as const).map(m => (
                <button key={m} type="button" aria-pressed={value.method === m} onClick={() => setMethod(value.method === m ? null : m)} className={pill}>
                  {m === "upi" ? "UPI" : "Cash"}
                </button>
              ))}
              <button type="button" aria-pressed={monthly} onClick={() => setMonthly(v => !v)} className={pill}>Every month</button>
            </div>
          ) : error ? (
            <p className="text-[14px] font-medium text-bad" role="alert">{error}</p>
          ) : typing && !text ? (
            <p className="text-[13px] leading-snug text-muted">Amount and what for, in any order. Add &ldquo;yesterday&rdquo; or 10/11, &ldquo;upi&rdquo; or &ldquo;cash&rdquo;. Start with + for money in.</p>
          ) : (
            <label htmlFor="entry" className="text-[14px] font-semibold">Add a spend or money in</label>
          )}
        </div>
        <div className="flex gap-2">
          {value || error || (typing && !text) ? <label htmlFor="entry" className="sr-only">Add a spend or money in</label> : null}
          <input ref={input} id="entry" value={text} onChange={e => { setText(e.target.value); setTried(false); }}
            placeholder="e.g. chai 20" autoComplete="off" spellCheck={false} enterKeyHint="done"
            aria-invalid={error ? true : undefined} aria-describedby="entry-help"
            className="field min-w-0 flex-1 text-[17px]" />
          <button type="submit" disabled={saving}
            className="press min-h-12 shrink-0 rounded-xl bg-accent px-5 text-[16px] font-semibold text-accent-fg disabled:opacity-60">
            Save
          </button>
        </div>
      </div>
    </form>
  );
}
